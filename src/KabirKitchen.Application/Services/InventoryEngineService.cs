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
    /// Deducts inventory for an order based on production type and recipes:
    /// - BatchProduced items: deduct from BranchProductStock and allocate from finished product lots (FEFO). Raw ingredients are NOT deducted.
    /// - MadeToOrder items: deduct required raw ingredients from BranchIngredientStock. If an ingredient is a SubRecipe, deduct from BranchSubRecipeStock without double-deducting its sub-ingredients.
    /// </summary>
    public async Task<Result> DeductIngredientsForOrderAsync(Order order)
    {
        var orderItems = await _context.OrderItems
            .Include(oi => oi.MenuItem)
            .Where(oi => oi.OrderId == order.Id)
            .ToListAsync();

        var lotService = new LotManagementService(_context);

        foreach (var item in orderItems)
        {
            if (item.MenuItem == null) continue;

            // ─── 1. BATCH-PRODUCED ITEMS: Deduct finished product stock only ───────────
            if (item.MenuItem.ProductionType == ProductionType.BatchProduced)
            {
                var productStock = await _context.BranchProductStocks
                    .FirstOrDefaultAsync(s => s.BranchId == order.BranchId &&
                                              s.MenuItemId == item.MenuItemId &&
                                              s.MenuItemVariantId == item.MenuItemVariantId);

                if (productStock == null)
                {
                    productStock = new BranchProductStock
                    {
                        BranchId = order.BranchId,
                        MenuItemId = item.MenuItemId,
                        MenuItemVariantId = item.MenuItemVariantId,
                        CurrentStockQuantity = 0,
                        ReservedQuantity = 0,
                        QuarantinedQuantity = 0,
                        MovingAverageCostPerUnit = 0
                    };
                    _context.BranchProductStocks.Add(productStock);
                }

                decimal qtyBefore = productStock.CurrentStockQuantity;
                productStock.CurrentStockQuantity -= item.Quantity;
                productStock.UpdatedAtUtc = DateTime.UtcNow;

                var productTxn = new ProductStockTransaction
                {
                    BranchId = order.BranchId,
                    MenuItemId = item.MenuItemId,
                    MenuItemVariantId = item.MenuItemVariantId,
                    BranchProductStockId = productStock.Id,
                    TransactionType = ProductStockTransactionType.PosSale,
                    QuantityChange = -item.Quantity,
                    QuantityBefore = qtyBefore,
                    QuantityAfter = productStock.CurrentStockQuantity,
                    UnitUsed = UnitType.Piece,
                    UnitCostAtTransaction = productStock.MovingAverageCostPerUnit,
                    TotalCost = item.Quantity * productStock.MovingAverageCostPerUnit,
                    OrderId = order.Id,
                    ReferenceDocumentType = "Order",
                    ReferenceDocumentNumber = order.OrderNumber,
                    Remarks = $"POS sale: {item.Quantity}x {item.ItemName}",
                    TransactionDateUtc = DateTime.UtcNow
                };
                _context.ProductStockTransactions.Add(productTxn);
                await _context.SaveChangesAsync();

                // Allocate from finished product lots (FEFO)
                var allocResult = await lotService.AllocateFinishedProductFefoAsync(
                    order.BranchId, item.MenuItemId, item.Quantity, productTxn.Id);
                if (allocResult.IsSuccess)
                {
                    foreach (var alloc in allocResult.Value)
                        _context.ProductLotAllocations.Add(alloc);
                    await _context.SaveChangesAsync();
                }

                // BatchProduced item stock has been deducted. Do NOT deduct raw ingredients.
                continue;
            }

            // ─── 2. MADE-TO-ORDER ITEMS: Deduct raw materials and sub-recipes ─────────
            var recipe = await _context.Recipes
                .Include(r => r.Ingredients)
                    .ThenInclude(ri => ri.Ingredient)
                .Include(r => r.Ingredients)
                    .ThenInclude(ri => ri.SubRecipe)
                .FirstOrDefaultAsync(r => r.MenuItemId == item.MenuItemId && r.MenuItemVariantId == item.MenuItemVariantId);

            if (recipe == null) continue;

            foreach (var ri in recipe.Ingredients)
            {
                decimal totalQtyForPortions = (ri.QuantityRequired * item.Quantity) / (recipe.YieldServings > 0 ? recipe.YieldServings : 1);

                // If linked to a SubRecipe: deduct intermediate stock from BranchSubRecipeStock
                if (ri.SubRecipeId.HasValue && ri.SubRecipe != null)
                {
                    decimal subQtyBase = UnitConverter.ConvertToBaseUnit(totalQtyForPortions, ri.UnitUsed, ri.SubRecipe.BaseUnit);

                    var subStock = await _context.BranchSubRecipeStocks
                        .FirstOrDefaultAsync(s => s.BranchId == order.BranchId && s.SubRecipeId == ri.SubRecipeId.Value);

                    if (subStock == null)
                    {
                        subStock = new BranchSubRecipeStock
                        {
                            BranchId = order.BranchId,
                            SubRecipeId = ri.SubRecipeId.Value,
                            CurrentStockQuantity = 0,
                            ReservedQuantity = 0,
                            QuarantinedQuantity = 0,
                            MovingAverageCostPerUnit = 0
                        };
                        _context.BranchSubRecipeStocks.Add(subStock);
                    }

                    decimal subBefore = subStock.CurrentStockQuantity;
                    subStock.CurrentStockQuantity -= subQtyBase;
                    subStock.UpdatedAtUtc = DateTime.UtcNow;

                    var subTxn = new SubRecipeStockTransaction
                    {
                        BranchId = order.BranchId,
                        SubRecipeId = ri.SubRecipeId.Value,
                        BranchSubRecipeStockId = subStock.Id,
                        TransactionType = SubRecipeTransactionType.ParentRecipeConsumption,
                        QuantityChange = -subQtyBase,
                        QuantityBefore = subBefore,
                        QuantityAfter = subStock.CurrentStockQuantity,
                        UnitUsed = ri.SubRecipe.BaseUnit,
                        UnitCostAtTransaction = subStock.MovingAverageCostPerUnit,
                        TotalCost = subQtyBase * subStock.MovingAverageCostPerUnit,
                        ParentOrderId = order.Id,
                        ReferenceDocumentType = "Order",
                        ReferenceDocumentNumber = order.OrderNumber,
                        Remarks = $"Consumption for {item.Quantity}x {item.ItemName}",
                        TransactionDateUtc = DateTime.UtcNow
                    };
                    _context.SubRecipeStockTransactions.Add(subTxn);
                    await _context.SaveChangesAsync();

                    // FEFO lot allocation for sub-recipe
                    var subAlloc = await lotService.AllocateSubRecipeFefoAsync(
                        order.BranchId, ri.SubRecipeId.Value, subQtyBase, subTxn.Id);
                    if (subAlloc.IsSuccess)
                    {
                        foreach (var a in subAlloc.Value)
                            _context.SubRecipeLotAllocations.Add(a);
                        await _context.SaveChangesAsync();
                    }

                    // Nested ingredients of already-produced sub-recipe are NOT deducted again.
                    continue;
                }

                // Raw ingredient deduction
                if (ri.Ingredient == null) continue;

                decimal qtyInBaseUnit = UnitConverter.ConvertToBaseUnit(totalQtyForPortions, ri.UnitUsed, ri.Ingredient.BaseUnit);
                
                // Add preparation loss factor
                qtyInBaseUnit *= (1.0m + ri.WastagePreparationLossPercent / 100.0m);

                var rawTxnResult = await RecordStockTransactionAsync(
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

                if (rawTxnResult.IsSuccess)
                {
                    // Allocate FEFO lots for raw ingredient
                    var rawAlloc = await lotService.AllocateRawMaterialFefoAsync(
                        order.BranchId, ri.IngredientId, qtyInBaseUnit, rawTxnResult.Value.Id);
                    if (rawAlloc.IsSuccess)
                    {
                        foreach (var a in rawAlloc.Value)
                            _context.IngredientLotAllocations.Add(a);
                        await _context.SaveChangesAsync();
                    }
                }
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
