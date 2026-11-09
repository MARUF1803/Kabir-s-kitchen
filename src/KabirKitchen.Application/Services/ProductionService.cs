using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Entities.Production;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public class ProductionService
{
    private readonly IApplicationDbContext _context;
    private readonly InventoryEngineService _inventoryEngine;
    private readonly SubRecipeService _subRecipeService;
    private readonly FinishedProductInventoryService _productStockService;
    private readonly LotManagementService _lotService;
    private readonly ReservoirService _reservoirService;

    public ProductionService(
        IApplicationDbContext context,
        InventoryEngineService inventoryEngine,
        SubRecipeService subRecipeService,
        FinishedProductInventoryService productStockService,
        LotManagementService lotService,
        ReservoirService reservoirService)
    {
        _context = context;
        _inventoryEngine = inventoryEngine;
        _subRecipeService = subRecipeService;
        _productStockService = productStockService;
        _lotService = lotService;
        _reservoirService = reservoirService;
    }

    public async Task<List<ProductionBatchDto>> GetProductionBatchesAsync(
        long? branchId = null,
        ProductionBatchStatus? status = null,
        CancellationToken ct = default)
    {
        var query = _context.ProductionBatches
            .Include(b => b.Branch)
            .Include(b => b.SubRecipe)
            .Include(b => b.MenuItem)
            .Include(b => b.ConsumedIngredients).ThenInclude(i => i.Ingredient)
            .Include(b => b.ConsumedSubRecipes).ThenInclude(sr => sr.SubRecipe)
            .Include(b => b.CostSnapshot)
            .OrderByDescending(b => b.CreatedAtUtc)
            .AsQueryable();

        if (branchId.HasValue && branchId.Value > 0)
            query = query.Where(b => b.BranchId == branchId.Value);

        if (status.HasValue)
            query = query.Where(b => b.Status == status.Value);

        var batches = await query.Take(50).ToListAsync(ct);
        return batches.Select(MapToDto).ToList();
    }

    public async Task<ProductionBatchDto?> GetProductionBatchByIdAsync(long id, CancellationToken ct = default)
    {
        var b = await _context.ProductionBatches
            .Include(b => b.Branch)
            .Include(b => b.SubRecipe)
            .Include(b => b.MenuItem)
            .Include(b => b.ConsumedIngredients).ThenInclude(i => i.Ingredient)
            .Include(b => b.ConsumedSubRecipes).ThenInclude(sr => sr.SubRecipe)
            .Include(b => b.CostSnapshot)
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        return b == null ? null : MapToDto(b);
    }

    public async Task<Result<ProductionBatchDto>> CreateProductionBatchAsync(
        CreateProductionBatchRequestDto dto,
        long userId,
        CancellationToken ct = default)
    {
        if (dto.PlannedQuantity <= 0)
            return Result<ProductionBatchDto>.Failure("Planned quantity must be greater than zero.");

        if (dto.TargetType == ProductionTargetType.SubRecipe && (!dto.SubRecipeId.HasValue || dto.MenuItemId.HasValue))
            return Result<ProductionBatchDto>.Failure("TargetType SubRecipe requires SubRecipeId and MenuItemId must be null.");

        if (dto.TargetType == ProductionTargetType.FinishedProduct && (!dto.MenuItemId.HasValue || dto.SubRecipeId.HasValue))
            return Result<ProductionBatchDto>.Failure("TargetType FinishedProduct requires MenuItemId and SubRecipeId must be null.");

        var branch = await _context.Branches.FindAsync(new object[] { dto.BranchId }, ct);
        if (branch == null) return Result<ProductionBatchDto>.Failure("Branch not found.");

        var datePrefix = DateTime.UtcNow.ToString("yyyyMMdd");
        var countToday = await _context.ProductionBatches
            .CountAsync(b => b.BatchNumber.StartsWith($"BATCH-{datePrefix}"), ct);
        var batchNumber = $"BATCH-{datePrefix}-{(countToday + 1):D3}";

        var batch = new ProductionBatch
        {
            BatchNumber = batchNumber,
            BranchId = dto.BranchId,
            TargetType = dto.TargetType,
            SubRecipeId = dto.SubRecipeId,
            MenuItemId = dto.MenuItemId,
            MenuItemVariantId = dto.MenuItemVariantId,
            PlannedQuantity = dto.PlannedQuantity,
            ScheduledStartUtc = dto.ScheduledStartUtc ?? DateTime.UtcNow,
            Status = ProductionBatchStatus.Planned,
            CreatedByUserId = userId,
            ProductionNotes = dto.ProductionNotes
        };

        // Populate planned recipe ingredients from BOM
        if (dto.TargetType == ProductionTargetType.SubRecipe)
        {
            var subRecipe = await _context.SubRecipes
                .Include(sr => sr.Ingredients).ThenInclude(i => i.Ingredient)
                .Include(sr => sr.Ingredients).ThenInclude(i => i.ChildSubRecipe)
                .FirstOrDefaultAsync(sr => sr.Id == dto.SubRecipeId!.Value, ct);

            if (subRecipe != null)
            {
                decimal scale = dto.PlannedQuantity / (subRecipe.StandardBatchYield > 0 ? subRecipe.StandardBatchYield : 1m);
                foreach (var bomItem in subRecipe.Ingredients)
                {
                    if (bomItem.IngredientId.HasValue && bomItem.Ingredient != null)
                    {
                        decimal plannedQty = bomItem.QuantityInBaseUnit * scale;
                        batch.ConsumedIngredients.Add(new ProductionBatchIngredient
                        {
                            IngredientId = bomItem.IngredientId.Value,
                            PlannedQuantity = plannedQty,
                            ActualQuantityConsumed = plannedQty,
                            UnitUsed = bomItem.Ingredient.BaseUnit,
                            QuantityInBaseUnit = plannedQty,
                            UnitCostSnapshot = bomItem.Ingredient.CurrentAverageCostPerBaseUnit,
                            TotalCost = plannedQty * bomItem.Ingredient.CurrentAverageCostPerBaseUnit
                        });
                    }
                    else if (bomItem.ChildSubRecipeId.HasValue && bomItem.ChildSubRecipe != null)
                    {
                        decimal plannedQty = bomItem.QuantityInBaseUnit * scale;
                        batch.ConsumedSubRecipes.Add(new ProductionBatchSubRecipe
                        {
                            SubRecipeId = bomItem.ChildSubRecipeId.Value,
                            PlannedQuantity = plannedQty,
                            ActualQuantityConsumed = plannedQty,
                            UnitUsed = bomItem.ChildSubRecipe.BaseUnit,
                            UnitCostSnapshot = 0,
                            TotalCost = 0
                        });
                    }
                }
            }
        }
        else if (dto.TargetType == ProductionTargetType.FinishedProduct)
        {
            var recipe = await _context.Recipes
                .Include(r => r.Ingredients).ThenInclude(ri => ri.Ingredient)
                .Include(r => r.Ingredients).ThenInclude(ri => ri.SubRecipe)
                .FirstOrDefaultAsync(r => r.MenuItemId == dto.MenuItemId!.Value &&
                                          r.MenuItemVariantId == dto.MenuItemVariantId, ct);

            if (recipe != null)
            {
                decimal scale = dto.PlannedQuantity / (recipe.YieldServings > 0 ? recipe.YieldServings : 1m);
                foreach (var ri in recipe.Ingredients)
                {
                    if (ri.SubRecipeId.HasValue && ri.SubRecipe != null)
                    {
                        decimal plannedQty = UnitConverter.ConvertToBaseUnit(ri.QuantityRequired * scale, ri.UnitUsed, ri.SubRecipe.BaseUnit);
                        batch.ConsumedSubRecipes.Add(new ProductionBatchSubRecipe
                        {
                            SubRecipeId = ri.SubRecipeId.Value,
                            PlannedQuantity = plannedQty,
                            ActualQuantityConsumed = plannedQty,
                            UnitUsed = ri.SubRecipe.BaseUnit,
                            UnitCostSnapshot = 0,
                            TotalCost = 0
                        });
                    }
                    else if (ri.Ingredient != null)
                    {
                        decimal plannedQty = UnitConverter.ConvertToBaseUnit(ri.QuantityRequired * scale, ri.UnitUsed, ri.Ingredient.BaseUnit);
                        batch.ConsumedIngredients.Add(new ProductionBatchIngredient
                        {
                            IngredientId = ri.IngredientId,
                            PlannedQuantity = plannedQty,
                            ActualQuantityConsumed = plannedQty,
                            UnitUsed = ri.Ingredient.BaseUnit,
                            QuantityInBaseUnit = plannedQty,
                            UnitCostSnapshot = ri.Ingredient.CurrentAverageCostPerBaseUnit,
                            TotalCost = plannedQty * ri.Ingredient.CurrentAverageCostPerBaseUnit
                        });
                    }
                }
            }
        }

        _context.ProductionBatches.Add(batch);
        await _context.SaveChangesAsync(ct);

        return Result<ProductionBatchDto>.Success(MapToDto(batch));
    }

    public async Task<Result<ProductionBatchDto>> StartProductionBatchAsync(long id, CancellationToken ct = default)
    {
        var batch = await _context.ProductionBatches.FindAsync(new object[] { id }, ct);
        if (batch == null) return Result<ProductionBatchDto>.Failure("Production batch not found.");
        if (batch.Status != ProductionBatchStatus.Planned && batch.Status != ProductionBatchStatus.Draft)
            return Result<ProductionBatchDto>.Failure($"Cannot start batch with status {batch.Status}.");

        batch.Status = ProductionBatchStatus.InProgress;
        batch.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return Result<ProductionBatchDto>.Success(MapToDto(batch));
    }

    public async Task<Result<ProductionBatchDto>> CompleteProductionBatchAsync(
        long id,
        CompleteProductionBatchRequestDto dto,
        long userId,
        CancellationToken ct = default)
    {
        var batch = await _context.ProductionBatches
            .Include(b => b.ConsumedIngredients).ThenInclude(i => i.Ingredient)
            .Include(b => b.ConsumedSubRecipes).ThenInclude(sr => sr.SubRecipe)
            .Include(b => b.SubRecipe)
            .Include(b => b.MenuItem)
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (batch == null) return Result<ProductionBatchDto>.Failure("Production batch not found.");
        if (batch.Status != ProductionBatchStatus.InProgress && batch.Status != ProductionBatchStatus.Planned)
            return Result<ProductionBatchDto>.Failure($"Cannot complete batch with status {batch.Status}.");

        if (dto.ActualProducedQuantity < 0)
            return Result<ProductionBatchDto>.Failure("Actual produced quantity cannot be negative.");
        if (dto.RejectedQuantity < 0)
            return Result<ProductionBatchDto>.Failure("Rejected quantity cannot be negative.");
        if (dto.RejectedQuantity > dto.ActualProducedQuantity)
            return Result<ProductionBatchDto>.Failure("Rejected quantity cannot exceed actual produced quantity.");

        decimal acceptedQuantity = dto.ActualProducedQuantity - dto.RejectedQuantity;

        batch.ActualProducedQuantity = dto.ActualProducedQuantity;
        batch.RejectedQuantity = dto.RejectedQuantity;
        batch.AcceptedQuantity = acceptedQuantity;
        batch.RejectionReason = dto.RejectionReason;
        batch.CompletedAtUtc = DateTime.UtcNow;
        batch.Status = ProductionBatchStatus.Completed;
        if (!string.IsNullOrWhiteSpace(dto.ProductionNotes))
            batch.ProductionNotes = dto.ProductionNotes;

        // Update actual consumed inputs if provided
        if (dto.ConsumedIngredients != null)
        {
            foreach (var input in dto.ConsumedIngredients)
            {
                var existing = batch.ConsumedIngredients.FirstOrDefault(i => i.IngredientId == input.IngredientId);
                if (existing != null)
                {
                    var ing = await _context.Ingredients.FindAsync(new object[] { input.IngredientId }, ct);
                    var baseUnit = ing?.BaseUnit ?? input.UnitUsed;
                    decimal qtyBase = UnitConverter.ConvertToBaseUnit(input.ActualQuantityConsumed, input.UnitUsed, baseUnit);
                    existing.ActualQuantityConsumed = input.ActualQuantityConsumed;
                    existing.QuantityInBaseUnit = qtyBase;
                    existing.UnitCostSnapshot = ing?.CurrentAverageCostPerBaseUnit ?? existing.UnitCostSnapshot;
                    existing.TotalCost = qtyBase * existing.UnitCostSnapshot;
                }
            }
        }

        if (dto.ConsumedSubRecipes != null)
        {
            foreach (var input in dto.ConsumedSubRecipes)
            {
                var existing = batch.ConsumedSubRecipes.FirstOrDefault(sr => sr.SubRecipeId == input.SubRecipeId);
                if (existing != null)
                {
                    existing.ActualQuantityConsumed = input.ActualQuantityConsumed;
                    var stock = await _context.BranchSubRecipeStocks
                        .FirstOrDefaultAsync(s => s.BranchId == batch.BranchId && s.SubRecipeId == input.SubRecipeId, ct);
                    existing.UnitCostSnapshot = stock?.MovingAverageCostPerUnit ?? 0;
                    existing.TotalCost = input.ActualQuantityConsumed * existing.UnitCostSnapshot;
                }
            }
        }

        // Handle reservoir absorption if applicable
        decimal reusableMaterialCost = 0;
        if (dto.EquipmentReservoirId.HasValue && dto.ReusableMaterialQuantityConsumed.HasValue && dto.ReusableMaterialQuantityConsumed.Value > 0)
        {
            var absResult = await _reservoirService.RecordBatchAbsorptionAsync(
                dto.EquipmentReservoirId.Value,
                dto.ReusableMaterialQuantityConsumed.Value,
                batch.Id,
                $"Absorbed in production batch {batch.BatchNumber}",
                userId,
                ct);

            if (absResult.IsSuccess)
                reusableMaterialCost = absResult.Value;
        }

        // Calculate Cost Snapshot
        decimal rawMaterialsCost = batch.ConsumedIngredients.Sum(i => i.TotalCost);
        decimal subRecipesCost = batch.ConsumedSubRecipes.Sum(sr => sr.TotalCost);
        decimal ingredientOnlyTotal = rawMaterialsCost + subRecipesCost + reusableMaterialCost;

        decimal fullProductionTotal = ingredientOnlyTotal +
                                      dto.DirectLaborCost +
                                      dto.UtilityCost +
                                      dto.PackagingCost +
                                      dto.OtherOverheadCost;

        decimal? ingredientUnitCost = acceptedQuantity > 0 ? (ingredientOnlyTotal / acceptedQuantity) : null;
        decimal? fullUnitCost = acceptedQuantity > 0 ? (fullProductionTotal / acceptedQuantity) : null;
        decimal totalSpoilageLoss = acceptedQuantity == 0 ? fullProductionTotal : (dto.RejectedQuantity * (fullUnitCost ?? 0));

        var snapshot = new ProductionBatchCostSnapshot
        {
            ProductionBatchId = batch.Id,
            RawMaterialsCostTotal = rawMaterialsCost,
            SubRecipesCostTotal = subRecipesCost,
            ReusableMaterialsCostTotal = reusableMaterialCost,
            DirectLaborCostTotal = dto.DirectLaborCost,
            UtilityCostTotal = dto.UtilityCost,
            PackagingCostTotal = dto.PackagingCost,
            OtherOverheadCostTotal = dto.OtherOverheadCost,
            PlannedQuantity = batch.PlannedQuantity,
            ActualProducedQuantity = dto.ActualProducedQuantity,
            RejectedQuantity = dto.RejectedQuantity,
            AcceptedQuantity = acceptedQuantity,
            IngredientOnlyTotalCost = ingredientOnlyTotal,
            IngredientOnlyUnitCost = ingredientUnitCost,
            FullProductionTotalCost = fullProductionTotal,
            FullProductionUnitCost = fullUnitCost,
            TotalBatchSpoilageLoss = totalSpoilageLoss,
            IsImmutable = false,
            SnapshotTimestampUtc = DateTime.UtcNow
        };

        batch.CostSnapshot = snapshot;
        batch.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return Result<ProductionBatchDto>.Success(MapToDto(batch));
    }

    /// <summary>
    /// Atomically posts a completed production batch to inventory ledgers:
    /// 1. Deducts consumed raw materials from BranchIngredientStock and FEFO lots.
    /// 2. Deducts consumed sub-recipes from BranchSubRecipeStock and FEFO lots.
    /// 3. Adds accepted output quantity to BranchSubRecipeStock or BranchProductStock.
    /// 4. Creates an InventoryLot for the accepted output quantity.
    /// 5. Locks the cost snapshot as immutable.
    /// 6. Idempotency guard prevents duplicate posting.
    /// </summary>
    public async Task<Result<ProductionBatchDto>> PostProductionBatchAsync(
        long id,
        string? idempotencyKey,
        long userId,
        DateTime? outputExpiryDateUtc = null,
        CancellationToken ct = default)
    {
        var batch = await _context.ProductionBatches
            .Include(b => b.ConsumedIngredients).ThenInclude(i => i.Ingredient)
            .Include(b => b.ConsumedSubRecipes).ThenInclude(sr => sr.SubRecipe)
            .Include(b => b.CostSnapshot)
            .Include(b => b.SubRecipe)
            .Include(b => b.MenuItem)
            .FirstOrDefaultAsync(b => b.Id == id, ct);

        if (batch == null) return Result<ProductionBatchDto>.Failure("Production batch not found.");

        // Idempotency check: if already posted or idempotency key already matches
        if (batch.IsPosted || batch.Status == ProductionBatchStatus.Posted)
            return Result<ProductionBatchDto>.Success(MapToDto(batch));

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var alreadyPosted = await _context.ProductionBatches
                .AnyAsync(b => b.IdempotencyKey == idempotencyKey && b.IsPosted, ct);
            if (alreadyPosted)
                return Result<ProductionBatchDto>.Success(MapToDto(batch));
            batch.IdempotencyKey = idempotencyKey;
        }

        if (batch.Status != ProductionBatchStatus.Completed)
            return Result<ProductionBatchDto>.Failure("Only completed batches can be posted to inventory.");

        decimal outputUnitCost = batch.CostSnapshot?.FullProductionUnitCost ?? 0m;

        // 1. Deduct consumed raw ingredients
        foreach (var ing in batch.ConsumedIngredients)
        {
            if (ing.ActualQuantityConsumed <= 0) continue;

            var txnResult = await _inventoryEngine.RecordStockTransactionAsync(
                batch.BranchId,
                ing.IngredientId,
                StockTransactionType.RecipeConsumption,
                -ing.QuantityInBaseUnit,
                ing.UnitUsed,
                ing.UnitCostSnapshot,
                "ProductionBatch",
                batch.BatchNumber,
                $"Consumed in production batch {batch.BatchNumber}",
                userId
            );

            if (txnResult.IsFailure)
                return Result<ProductionBatchDto>.Failure($"Failed to deduct ingredient {ing.IngredientId}: {txnResult.Error}");

            // FEFO lot allocation for raw material
            var allocResult = await _lotService.AllocateRawMaterialFefoAsync(
                batch.BranchId,
                ing.IngredientId,
                ing.QuantityInBaseUnit,
                txnResult.Value.Id,
                ct);

            if (allocResult.IsSuccess)
            {
                foreach (var alloc in allocResult.Value)
                    _context.IngredientLotAllocations.Add(alloc);
            }
        }

        // 2. Deduct consumed sub-recipes
        foreach (var sr in batch.ConsumedSubRecipes)
        {
            if (sr.ActualQuantityConsumed <= 0) continue;

            var txnResult = await _subRecipeService.RecordSubRecipeTransactionAsync(
                batch.BranchId,
                sr.SubRecipeId,
                SubRecipeTransactionType.ParentRecipeConsumption,
                -sr.ActualQuantityConsumed,
                sr.UnitUsed,
                sr.UnitCostSnapshot,
                "ProductionBatch",
                batch.BatchNumber,
                $"Consumed in production batch {batch.BatchNumber}",
                batch.Id,
                null,
                userId,
                ct);

            if (txnResult.IsFailure)
                return Result<ProductionBatchDto>.Failure($"Failed to deduct sub-recipe {sr.SubRecipeId}: {txnResult.Error}");

            // FEFO lot allocation for sub-recipe
            var allocResult = await _lotService.AllocateSubRecipeFefoAsync(
                batch.BranchId,
                sr.SubRecipeId,
                sr.ActualQuantityConsumed,
                txnResult.Value.Id,
                ct);

            if (allocResult.IsSuccess)
            {
                foreach (var alloc in allocResult.Value)
                    _context.SubRecipeLotAllocations.Add(alloc);
            }
        }

        // 3. Add accepted output to inventory
        if (batch.AcceptedQuantity > 0)
        {
            if (batch.TargetType == ProductionTargetType.SubRecipe && batch.SubRecipeId.HasValue)
            {
                var subRecipe = batch.SubRecipe ?? await _context.SubRecipes.FindAsync(new object[] { batch.SubRecipeId.Value }, ct);
                var subTxnResult = await _subRecipeService.RecordSubRecipeTransactionAsync(
                    batch.BranchId,
                    batch.SubRecipeId.Value,
                    SubRecipeTransactionType.ProductionAccepted,
                    batch.AcceptedQuantity,
                    subRecipe?.BaseUnit ?? UnitType.Kilogram,
                    outputUnitCost,
                    "ProductionBatch",
                    batch.BatchNumber,
                    $"Production accepted output from batch {batch.BatchNumber}",
                    batch.Id,
                    null,
                    userId,
                    ct);

                if (subTxnResult.IsFailure)
                    return Result<ProductionBatchDto>.Failure($"Failed to record sub-recipe stock: {subTxnResult.Error}");

                // Create InventoryLot for output
                var lotNumber = await _lotService.GenerateSubRecipeLotNumberAsync(ct);
                DateTime? expiry = outputExpiryDateUtc;
                if (!expiry.HasValue && subRecipe != null && subRecipe.HasExpiry)
                {
                    if (subRecipe.ShelfLifeHours.HasValue)
                        expiry = DateTime.UtcNow.AddHours(subRecipe.ShelfLifeHours.Value);
                    else if (subRecipe.ShelfLifeDays.HasValue)
                        expiry = DateTime.UtcNow.AddDays(subRecipe.ShelfLifeDays.Value);
                }

                var lot = _lotService.CreateSubRecipeLot(
                    lotNumber,
                    batch.BranchId,
                    batch.SubRecipeId.Value,
                    batch.AcceptedQuantity,
                    outputUnitCost,
                    expiry,
                    subRecipe?.HasExpiry ?? true,
                    batch.BatchNumber
                );
                _context.InventoryLots.Add(lot);
                await _context.SaveChangesAsync(ct);

                var alloc = LotManagementService.CreateSubRecipeReceiptAllocation(lot, subTxnResult.Value.Id);
                _context.SubRecipeLotAllocations.Add(alloc);
            }
            else if (batch.TargetType == ProductionTargetType.FinishedProduct && batch.MenuItemId.HasValue)
            {
                var prodTxnResult = await _productStockService.RecordProductStockTransactionAsync(
                    batch.BranchId,
                    batch.MenuItemId.Value,
                    batch.MenuItemVariantId,
                    ProductStockTransactionType.ProductionAccepted,
                    batch.AcceptedQuantity,
                    outputUnitCost,
                    "ProductionBatch",
                    batch.BatchNumber,
                    $"Production accepted output from batch {batch.BatchNumber}",
                    batch.Id,
                    null,
                    userId,
                    false,
                    ct);

                if (prodTxnResult.IsFailure)
                    return Result<ProductionBatchDto>.Failure($"Failed to record product stock: {prodTxnResult.Error}");

                // Create InventoryLot for output
                var lotNumber = await _lotService.GenerateFinishedProductLotNumberAsync(ct);
                var lot = _lotService.CreateFinishedProductLot(
                    lotNumber,
                    batch.BranchId,
                    batch.MenuItemId.Value,
                    batch.AcceptedQuantity,
                    outputUnitCost,
                    outputExpiryDateUtc,
                    true,
                    batch.BatchNumber
                );
                _context.InventoryLots.Add(lot);
                await _context.SaveChangesAsync(ct);

                var alloc = LotManagementService.CreateFinishedProductReceiptAllocation(lot, prodTxnResult.Value.Id);
                _context.ProductLotAllocations.Add(alloc);
            }
        }

        // Lock cost snapshot
        if (batch.CostSnapshot != null)
        {
            batch.CostSnapshot.IsImmutable = true;
        }

        batch.IsPosted = true;
        batch.PostedAtUtc = DateTime.UtcNow;
        batch.Status = ProductionBatchStatus.Posted;
        batch.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return Result<ProductionBatchDto>.Success(MapToDto(batch));
    }

    /// <summary>
    /// Cancels a production batch. If already posted, reversals must be performed.
    /// </summary>
    public async Task<Result> CancelProductionBatchAsync(long id, string reason, CancellationToken ct = default)
    {
        var batch = await _context.ProductionBatches.FindAsync(new object[] { id }, ct);
        if (batch == null) return Result.Failure("Production batch not found.");
        if (batch.IsPosted)
            return Result.Failure("Cannot directly cancel a posted batch. Perform an auditable production reversal instead.");

        batch.Status = ProductionBatchStatus.Cancelled;
        batch.RejectionReason = reason;
        batch.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        return Result.Success();
    }

    private static ProductionBatchDto MapToDto(ProductionBatch b)
    {
        return new ProductionBatchDto(
            b.Id,
            b.BatchNumber,
            b.BranchId,
            b.Branch?.Name ?? "",
            b.TargetType,
            b.SubRecipeId,
            b.SubRecipe?.Name,
            b.MenuItemId,
            b.MenuItem?.Name,
            b.MenuItemVariantId,
            null,
            b.Status,
            b.PlannedQuantity,
            b.ActualProducedQuantity,
            b.RejectedQuantity,
            b.AcceptedQuantity,
            b.ScheduledStartUtc,
            b.CompletedAtUtc,
            b.PostedAtUtc,
            b.CreatedByUserId,
            b.ProductionNotes,
            b.RejectionReason,
            b.IsPosted,
            b.ConsumedIngredients.Select(i => new ProductionBatchIngredientDto(
                i.Id,
                i.IngredientId,
                i.Ingredient?.Name ?? "",
                i.PlannedQuantity,
                i.ActualQuantityConsumed,
                i.UnitUsed,
                i.QuantityInBaseUnit,
                i.UnitCostSnapshot,
                i.TotalCost
            )).ToList(),
            b.ConsumedSubRecipes.Select(sr => new ProductionBatchSubRecipeDto(
                sr.Id,
                sr.SubRecipeId,
                sr.SubRecipe?.Name ?? "",
                sr.PlannedQuantity,
                sr.ActualQuantityConsumed,
                sr.UnitUsed,
                sr.UnitCostSnapshot,
                sr.TotalCost
            )).ToList(),
            b.CostSnapshot == null ? null : new ProductionBatchCostSnapshotDto(
                b.CostSnapshot.Id,
                b.CostSnapshot.ProductionBatchId,
                b.CostSnapshot.RawMaterialsCostTotal,
                b.CostSnapshot.SubRecipesCostTotal,
                b.CostSnapshot.ReusableMaterialsCostTotal,
                b.CostSnapshot.DirectLaborCostTotal,
                b.CostSnapshot.UtilityCostTotal,
                b.CostSnapshot.PackagingCostTotal,
                b.CostSnapshot.OtherOverheadCostTotal,
                b.CostSnapshot.PlannedQuantity,
                b.CostSnapshot.ActualProducedQuantity,
                b.CostSnapshot.RejectedQuantity,
                b.CostSnapshot.AcceptedQuantity,
                b.CostSnapshot.IngredientOnlyTotalCost,
                b.CostSnapshot.IngredientOnlyUnitCost,
                b.CostSnapshot.FullProductionTotalCost,
                b.CostSnapshot.FullProductionUnitCost,
                b.CostSnapshot.TotalBatchSpoilageLoss,
                b.CostSnapshot.IsImmutable,
                b.CostSnapshot.CorrectionOfSnapshotId,
                b.CostSnapshot.SnapshotTimestampUtc
            )
        );
    }
}
