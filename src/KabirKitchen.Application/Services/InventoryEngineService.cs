using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Entities.Orders;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public class InventoryEngineService
{
    private readonly IApplicationDbContext _context;

    public InventoryEngineService(IApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Audited double-entry inventory ledger operation. Direct mutation of stock is prohibited.
    /// </summary>
    public async Task<Result<StockTransaction>> RecordStockTransactionAsync(
        long branchId,
        long ingredientId,
        StockTransactionType transactionType,
        decimal quantityChange,
        UnitType unitUsed,
        decimal unitCost,
        string? referenceDocType,
        string? referenceDocNumber,
        string? remarks,
        long? performedByUserId)
    {
        var ingredient = await _context.Ingredients.FindAsync(ingredientId);
        if (ingredient == null)
            return Result<StockTransaction>.Failure("Ingredient not found.");

        var branchStock = await _context.BranchIngredientStocks
            .FirstOrDefaultAsync(s => s.BranchId == branchId && s.IngredientId == ingredientId);

        if (branchStock == null)
        {
            branchStock = new BranchIngredientStock
            {
                BranchId = branchId,
                IngredientId = ingredientId,
                CurrentStockQuantity = 0,
                ReservedQuantity = 0,
                LastPurchaseCostPerUnit = unitCost,
                MovingAverageCostPerUnit = unitCost
            };
            _context.BranchIngredientStocks.Add(branchStock);
        }

        // Convert the input quantity to the ingredient's base unit (kg, L, pcs)
        decimal qtyInBaseUnit = UnitConverter.ConvertToBaseUnit(quantityChange, unitUsed, ingredient.BaseUnit);

        // Update branch stock — ledger is the single source of truth.
        // Stock is allowed to go negative (e.g. emergency kitchen rush before restock).
        branchStock.CurrentStockQuantity += qtyInBaseUnit;

        if (transactionType == StockTransactionType.PurchaseGRN && unitCost > 0)
        {
            branchStock.LastPurchaseCostPerUnit = unitCost;

            // Weighted Moving Average Cost:
            // newAvg = (existingQty * oldAvg + newQty * newCost) / (existingQty + newQty)
            var existingQty = branchStock.CurrentStockQuantity - qtyInBaseUnit; // qty before this GRN
            var oldAvg = branchStock.MovingAverageCostPerUnit > 0
                ? branchStock.MovingAverageCostPerUnit
                : unitCost;
            var newAvg = existingQty > 0
                ? ((existingQty * oldAvg) + (qtyInBaseUnit * unitCost)) / (existingQty + qtyInBaseUnit)
                : unitCost;

            branchStock.MovingAverageCostPerUnit = newAvg;
            ingredient.CurrentAverageCostPerBaseUnit = newAvg;
        }

        branchStock.UpdatedAtUtc = DateTime.UtcNow;

        var transaction = new StockTransaction
        {
            BranchId = branchId,
            IngredientId = ingredientId,
            TransactionType = transactionType,
            QuantityChange = qtyInBaseUnit,
            UnitUsed = ingredient.BaseUnit,
            UnitCostAtTransaction = unitCost,
            TotalCost = Math.Abs(qtyInBaseUnit * unitCost),
            ReferenceDocumentType = referenceDocType,
            ReferenceDocumentNumber = referenceDocNumber,
            Remarks = remarks,
            PerformedByUserId = performedByUserId,
            TransactionDateUtc = DateTime.UtcNow
        };

        _context.StockTransactions.Add(transaction);
        await _context.SaveChangesAsync();

        return Result<StockTransaction>.Success(transaction);
    }

    /// <summary>
    /// Deducts all ingredients required for an order based on recipes.
    /// </summary>
    public async Task<Result> DeductIngredientsForOrderAsync(Order order)
    {
        var orderItems = await _context.OrderItems
            .Include(oi => oi.MenuItem)
            .Where(oi => oi.OrderId == order.Id)
            .ToListAsync();

        foreach (var item in orderItems)
        {
            var recipe = await _context.Recipes
                .Include(r => r.Ingredients)
                    .ThenInclude(ri => ri.Ingredient)
                .FirstOrDefaultAsync(r => r.MenuItemId == item.MenuItemId && r.MenuItemVariantId == item.MenuItemVariantId);

            if (recipe == null) continue;

            foreach (var ri in recipe.Ingredients)
            {
                if (ri.Ingredient == null) continue;

                // Total quantity for all portions of this item
                decimal totalQtyForPortions = (ri.QuantityRequired * item.Quantity) / (recipe.YieldServings > 0 ? recipe.YieldServings : 1);
                decimal qtyInBaseUnit = UnitConverter.ConvertToBaseUnit(totalQtyForPortions, ri.UnitUsed, ri.Ingredient.BaseUnit);
                
                // Add preparation loss factor
                qtyInBaseUnit *= (1.0m + ri.WastagePreparationLossPercent / 100.0m);

                await RecordStockTransactionAsync(
                    branchId: order.BranchId,
                    ingredientId: ri.IngredientId,
                    transactionType: StockTransactionType.RecipeConsumption,
                    quantityChange: -qtyInBaseUnit, // Negative for consumption
                    unitUsed: ri.Ingredient.BaseUnit,
                    unitCost: ri.Ingredient.CurrentAverageCostPerBaseUnit,
                    referenceDocType: "Order",
                    referenceDocNumber: order.OrderNumber,
                    remarks: $"Consumption for {item.Quantity}x {item.ItemName}",
                    performedByUserId: null
                );
            }
        }

        return Result.Success();
    }

    /// <summary>
    /// "What Can We Make?" reverse BOM engine.
    /// Scans branch on-hand raw ingredient stocks against all recipes to determine
    /// exactly how many portions of each menu item can be prepared right now.
    /// </summary>
    public async Task<List<WhatCanWeMakeItemDto>> CheckWhatCanWeMakeAsync(long branchId)
    {
        var branchStocks = await _context.BranchIngredientStocks
            .Include(s => s.Ingredient)
            .Where(s => s.BranchId == branchId)
            .ToDictionaryAsync(s => s.IngredientId, s => s.AvailableQuantity);

        var recipes = await _context.Recipes
            .Include(r => r.MenuItem)
            .Include(r => r.MenuItemVariant)
            .Include(r => r.Ingredients)
                .ThenInclude(ri => ri.Ingredient)
            .Where(r => r.MenuItem != null && r.MenuItem.IsActive)
            .ToListAsync();

        var results = new List<WhatCanWeMakeItemDto>();

        foreach (var recipe in recipes)
        {
            if (recipe.MenuItem == null || !recipe.Ingredients.Any()) continue;

            int maxPortions = int.MaxValue;
            var shortages = new List<IngredientShortageDto>();

            foreach (var ri in recipe.Ingredients)
            {
                if (ri.Ingredient == null) continue;

                decimal requiredPerPortionBase = UnitConverter.ConvertToBaseUnit(
                    ri.QuantityRequired / (recipe.YieldServings > 0 ? recipe.YieldServings : 1),
                    ri.UnitUsed,
                    ri.Ingredient.BaseUnit);

                branchStocks.TryGetValue(ri.IngredientId, out decimal availableStock);

                if (requiredPerPortionBase <= 0) continue;

                int possibleWithThisIngredient = (int)Math.Floor(availableStock / requiredPerPortionBase);

                if (possibleWithThisIngredient < maxPortions)
                {
                    maxPortions = possibleWithThisIngredient;
                }

                if (availableStock < requiredPerPortionBase)
                {
                    shortages.Add(new IngredientShortageDto(
                        ri.Ingredient.Name,
                        ri.QuantityRequired,
                        ri.UnitUsed,
                        availableStock,
                        requiredPerPortionBase - availableStock
                    ));
                }
            }

            if (maxPortions == int.MaxValue) maxPortions = 0;

            decimal price = recipe.MenuItemVariant != null && recipe.MenuItemVariant.AdditionalPrice > 0
                ? recipe.MenuItem.BasePrice + recipe.MenuItemVariant.AdditionalPrice
                : recipe.MenuItem.BasePrice;

            results.Add(new WhatCanWeMakeItemDto(
                recipe.MenuItemId,
                recipe.MenuItem.Name,
                recipe.MenuItemVariant?.VariantName,
                price,
                Math.Max(0, maxPortions),
                maxPortions > 0,
                shortages
            ));
        }

        return results.OrderByDescending(r => r.MaxPossiblePortions).ToList();
    }
}
