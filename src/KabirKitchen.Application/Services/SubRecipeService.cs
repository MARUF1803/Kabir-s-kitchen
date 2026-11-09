using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public class SubRecipeService
{
    private readonly IApplicationDbContext _context;

    public SubRecipeService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<SubRecipeDto>> GetAllSubRecipesAsync(CancellationToken ct = default)
    {
        var items = await _context.SubRecipes
            .Include(sr => sr.Ingredients)
                .ThenInclude(sri => sri.Ingredient)
            .Include(sr => sr.Ingredients)
                .ThenInclude(sri => sri.ChildSubRecipe)
            .Where(sr => !sr.IsDeleted && sr.IsActive)
            .OrderBy(sr => sr.Name)
            .ToListAsync(ct);

        return items.Select(MapToDto).ToList();
    }

    public async Task<SubRecipeDto?> GetSubRecipeByIdAsync(long id, CancellationToken ct = default)
    {
        var sr = await _context.SubRecipes
            .Include(s => s.Ingredients)
                .ThenInclude(sri => sri.Ingredient)
            .Include(s => s.Ingredients)
                .ThenInclude(sri => sri.ChildSubRecipe)
            .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, ct);

        return sr == null ? null : MapToDto(sr);
    }

    public async Task<Result<SubRecipeDto>> CreateSubRecipeAsync(CreateSubRecipeDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return Result<SubRecipeDto>.Failure("SubRecipe name is required.");
        if (string.IsNullOrWhiteSpace(dto.Code))
            return Result<SubRecipeDto>.Failure("SubRecipe code is required.");
        if (dto.StandardBatchYield <= 0)
            return Result<SubRecipeDto>.Failure("Standard batch yield must be greater than zero.");

        var codeExists = await _context.SubRecipes.AnyAsync(s => s.Code == dto.Code.Trim() && !s.IsDeleted, ct);
        if (codeExists)
            return Result<SubRecipeDto>.Failure($"SubRecipe code '{dto.Code}' already exists.");

        var subRecipe = new SubRecipe
        {
            Name = dto.Name.Trim(),
            Code = dto.Code.Trim(),
            Description = dto.Description?.Trim(),
            BaseUnit = dto.BaseUnit,
            StandardBatchYield = dto.StandardBatchYield,
            StorageCondition = dto.StorageCondition,
            ShelfLifeHours = dto.ShelfLifeHours,
            ShelfLifeDays = dto.ShelfLifeDays,
            HasExpiry = dto.HasExpiry,
            IsActive = true
        };

        if (dto.Ingredients != null && dto.Ingredients.Count > 0)
        {
            foreach (var ingDto in dto.Ingredients)
            {
                if (ingDto.Quantity <= 0)
                    return Result<SubRecipeDto>.Failure("Ingredient quantity must be positive.");

                // Validate exactly one: IngredientId OR ChildSubRecipeId
                if (ingDto.IngredientId.HasValue && ingDto.ChildSubRecipeId.HasValue)
                    return Result<SubRecipeDto>.Failure("SubRecipe BOM item cannot reference both a raw ingredient and a child sub-recipe.");
                if (!ingDto.IngredientId.HasValue && !ingDto.ChildSubRecipeId.HasValue)
                    return Result<SubRecipeDto>.Failure("SubRecipe BOM item must reference either a raw ingredient or a child sub-recipe.");

                decimal qtyInBaseUnit = ingDto.Quantity;
                if (ingDto.IngredientId.HasValue)
                {
                    var raw = await _context.Ingredients.FindAsync(new object[] { ingDto.IngredientId.Value }, ct);
                    if (raw == null) return Result<SubRecipeDto>.Failure($"Raw ingredient {ingDto.IngredientId} not found.");
                    qtyInBaseUnit = UnitConverter.ConvertToBaseUnit(ingDto.Quantity, ingDto.Unit, raw.BaseUnit);
                }
                else if (ingDto.ChildSubRecipeId.HasValue)
                {
                    var child = await _context.SubRecipes.FindAsync(new object[] { ingDto.ChildSubRecipeId.Value }, ct);
                    if (child == null) return Result<SubRecipeDto>.Failure($"Child sub-recipe {ingDto.ChildSubRecipeId} not found.");
                    qtyInBaseUnit = UnitConverter.ConvertToBaseUnit(ingDto.Quantity, ingDto.Unit, child.BaseUnit);
                }

                subRecipe.Ingredients.Add(new SubRecipeIngredient
                {
                    IngredientId = ingDto.IngredientId,
                    ChildSubRecipeId = ingDto.ChildSubRecipeId,
                    Quantity = ingDto.Quantity,
                    Unit = ingDto.Unit,
                    QuantityInBaseUnit = qtyInBaseUnit,
                    Notes = ingDto.Notes
                });
            }
        }

        _context.SubRecipes.Add(subRecipe);
        await _context.SaveChangesAsync(ct);

        return Result<SubRecipeDto>.Success(MapToDto(subRecipe));
    }

    public async Task<List<BranchSubRecipeStockDto>> GetBranchSubRecipeStocksAsync(long branchId, CancellationToken ct = default)
    {
        var stocks = await _context.BranchSubRecipeStocks
            .Include(s => s.Branch)
            .Include(s => s.SubRecipe)
            .Where(s => s.BranchId == branchId && s.SubRecipe != null && !s.SubRecipe.IsDeleted)
            .ToListAsync(ct);

        return stocks.Select(s => new BranchSubRecipeStockDto(
            s.Id,
            s.BranchId,
            s.Branch?.Name ?? "",
            s.SubRecipeId,
            s.SubRecipe?.Name ?? "",
            s.SubRecipe?.Code ?? "",
            s.SubRecipe?.BaseUnit ?? UnitType.Kilogram,
            s.CurrentStockQuantity,
            s.ReservedQuantity,
            s.QuarantinedQuantity,
            s.AvailableQuantity,
            s.MinimumAlertStock,
            s.MovingAverageCostPerUnit
        )).ToList();
    }

    public async Task<Result<SubRecipeStockTransaction>> RecordSubRecipeTransactionAsync(
        long branchId,
        long subRecipeId,
        SubRecipeTransactionType transactionType,
        decimal quantityChange,
        UnitType unitUsed,
        decimal unitCost,
        string? referenceDocType,
        string? referenceDocNumber,
        string? remarks,
        long? productionBatchId,
        long? parentOrderId,
        long? performedByUserId,
        CancellationToken ct = default)
    {
        var subRecipe = await _context.SubRecipes.FindAsync(new object[] { subRecipeId }, ct);
        if (subRecipe == null)
            return Result<SubRecipeStockTransaction>.Failure("SubRecipe not found.");

        var stock = await _context.BranchSubRecipeStocks
            .FirstOrDefaultAsync(s => s.BranchId == branchId && s.SubRecipeId == subRecipeId, ct);

        if (stock == null)
        {
            stock = new BranchSubRecipeStock
            {
                BranchId = branchId,
                SubRecipeId = subRecipeId,
                CurrentStockQuantity = 0,
                ReservedQuantity = 0,
                QuarantinedQuantity = 0,
                MovingAverageCostPerUnit = unitCost
            };
            _context.BranchSubRecipeStocks.Add(stock);
        }

        decimal qtyInBaseUnit = UnitConverter.ConvertToBaseUnit(quantityChange, unitUsed, subRecipe.BaseUnit);

        decimal quantityBefore = stock.CurrentStockQuantity;
        stock.CurrentStockQuantity += qtyInBaseUnit;
        decimal quantityAfter = stock.CurrentStockQuantity;

        if (transactionType == SubRecipeTransactionType.ProductionAccepted && unitCost > 0 && qtyInBaseUnit > 0)
        {
            var existingQty = quantityBefore;
            var oldAvg = stock.MovingAverageCostPerUnit > 0 ? stock.MovingAverageCostPerUnit : unitCost;
            var newAvg = existingQty > 0
                ? ((existingQty * oldAvg) + (qtyInBaseUnit * unitCost)) / (existingQty + qtyInBaseUnit)
                : unitCost;
            stock.MovingAverageCostPerUnit = newAvg;
        }

        stock.UpdatedAtUtc = DateTime.UtcNow;

        var txn = new SubRecipeStockTransaction
        {
            BranchId = branchId,
            SubRecipeId = subRecipeId,
            BranchSubRecipeStockId = stock.Id,
            TransactionType = transactionType,
            QuantityChange = qtyInBaseUnit,
            QuantityBefore = quantityBefore,
            QuantityAfter = quantityAfter,
            UnitUsed = subRecipe.BaseUnit,
            UnitCostAtTransaction = unitCost,
            TotalCost = Math.Abs(qtyInBaseUnit * unitCost),
            ProductionBatchId = productionBatchId,
            ParentOrderId = parentOrderId,
            ReferenceDocumentType = referenceDocType,
            ReferenceDocumentNumber = referenceDocNumber,
            Remarks = remarks,
            PerformedByUserId = performedByUserId,
            TransactionDateUtc = DateTime.UtcNow
        };

        _context.SubRecipeStockTransactions.Add(txn);
        await _context.SaveChangesAsync(ct);

        return Result<SubRecipeStockTransaction>.Success(txn);
    }

    private static SubRecipeDto MapToDto(SubRecipe sr)
    {
        return new SubRecipeDto(
            sr.Id,
            sr.Name,
            sr.Code,
            sr.Description,
            sr.BaseUnit,
            sr.StandardBatchYield,
            sr.StorageCondition,
            sr.ShelfLifeHours,
            sr.ShelfLifeDays,
            sr.HasExpiry,
            sr.IsActive,
            sr.Ingredients.Select(i => new SubRecipeIngredientDto(
                i.Id,
                i.SubRecipeId,
                i.IngredientId,
                i.Ingredient?.Name,
                i.ChildSubRecipeId,
                i.ChildSubRecipe?.Name,
                i.Quantity,
                i.Unit,
                i.QuantityInBaseUnit,
                i.Notes
            )).ToList()
        );
    }
}
