using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public class ReservoirService
{
    private readonly IApplicationDbContext _context;
    private readonly InventoryEngineService _inventoryEngine;

    public ReservoirService(
        IApplicationDbContext context,
        InventoryEngineService inventoryEngine)
    {
        _context = context;
        _inventoryEngine = inventoryEngine;
    }

    public async Task<List<EquipmentReservoirDto>> GetReservoirsByBranchAsync(long branchId, CancellationToken ct = default)
    {
        var items = await _context.EquipmentReservoirs
            .Include(r => r.Branch)
            .Include(r => r.Ingredient)
            .Where(r => r.BranchId == branchId && r.IsActive)
            .ToListAsync(ct);

        return items.Select(r => new EquipmentReservoirDto(
            r.Id,
            r.BranchId,
            r.Branch?.Name ?? "",
            r.EquipmentName,
            r.EquipmentCode,
            r.IngredientId,
            r.Ingredient?.Name ?? "",
            r.CurrentFluidQuantity,
            r.CurrentUnitCost,
            r.MaxCapacity,
            r.LastCleanedOrReplacedUtc,
            r.IsActive
        )).ToList();
    }

    public async Task<Result<EquipmentReservoirDto>> CreateReservoirAsync(
        long branchId,
        string equipmentName,
        string? equipmentCode,
        long ingredientId,
        decimal maxCapacity,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(equipmentName))
            return Result<EquipmentReservoirDto>.Failure("Equipment name is required.");
        if (maxCapacity <= 0)
            return Result<EquipmentReservoirDto>.Failure("Maximum capacity must be positive.");

        var ingredient = await _context.Ingredients.FindAsync(new object[] { ingredientId }, ct);
        if (ingredient == null)
            return Result<EquipmentReservoirDto>.Failure("Ingredient not found.");

        var reservoir = new EquipmentReservoir
        {
            BranchId = branchId,
            EquipmentName = equipmentName.Trim(),
            EquipmentCode = equipmentCode?.Trim(),
            IngredientId = ingredientId,
            CurrentFluidQuantity = 0,
            CurrentUnitCost = ingredient.CurrentAverageCostPerBaseUnit,
            MaxCapacity = maxCapacity,
            IsActive = true
        };

        _context.EquipmentReservoirs.Add(reservoir);
        await _context.SaveChangesAsync(ct);

        return Result<EquipmentReservoirDto>.Success(new EquipmentReservoirDto(
            reservoir.Id,
            reservoir.BranchId,
            "",
            reservoir.EquipmentName,
            reservoir.EquipmentCode,
            reservoir.IngredientId,
            ingredient.Name,
            reservoir.CurrentFluidQuantity,
            reservoir.CurrentUnitCost,
            reservoir.MaxCapacity,
            reservoir.LastCleanedOrReplacedUtc,
            reservoir.IsActive
        ));
    }

    /// <summary>
    /// Transfers fluid (e.g. frying oil) from storage inventory into an equipment reservoir.
    /// Preserves source lot traceability and recalculates the weighted-average unit cost.
    /// </summary>
    public async Task<Result<EquipmentReservoirTransactionDto>> TransferInFromStorageAsync(
        long reservoirId,
        decimal quantity,
        long? sourceLotId,
        string? remarks,
        long? userId,
        CancellationToken ct = default)
    {
        if (quantity <= 0)
            return Result<EquipmentReservoirTransactionDto>.Failure("Quantity must be positive.");

        var reservoir = await _context.EquipmentReservoirs
            .Include(r => r.Ingredient)
            .FirstOrDefaultAsync(r => r.Id == reservoirId, ct);

        if (reservoir == null)
            return Result<EquipmentReservoirTransactionDto>.Failure("Reservoir not found.");

        if (reservoir.CurrentFluidQuantity + quantity > reservoir.MaxCapacity)
            return Result<EquipmentReservoirTransactionDto>.Failure(
                $"Transfer exceeds reservoir capacity ({reservoir.MaxCapacity} {reservoir.Ingredient?.BaseUnit}).");

        decimal unitCost = reservoir.CurrentUnitCost;
        if (sourceLotId.HasValue)
        {
            var lot = await _context.InventoryLots.FindAsync(new object[] { sourceLotId.Value }, ct);
            if (lot != null && lot.UnitCost > 0)
            {
                unitCost = lot.UnitCost;
                // Deduct from lot
                if (lot.RemainingQuantity < quantity)
                    return Result<EquipmentReservoirTransactionDto>.Failure("Source lot has insufficient quantity.");
                lot.RemainingQuantity -= quantity;
                if (lot.RemainingQuantity == 0) lot.Status = InventoryLotStatus.Depleted;
            }
        }

        // Deduct raw material stock from storage
        var stockTxnResult = await _inventoryEngine.RecordStockTransactionAsync(
            reservoir.BranchId,
            reservoir.IngredientId,
            StockTransactionType.TransferOut,
            -quantity,
            reservoir.Ingredient?.BaseUnit ?? UnitType.Liter,
            unitCost,
            "EquipmentReservoir",
            reservoir.EquipmentCode ?? reservoir.Id.ToString(),
            $"Transferred into {reservoir.EquipmentName}. {remarks}",
            userId
        );

        if (stockTxnResult.IsFailure)
            return Result<EquipmentReservoirTransactionDto>.Failure($"Failed to deduct from storage: {stockTxnResult.Error}");

        decimal beforeQty = reservoir.CurrentFluidQuantity;
        decimal afterQty = beforeQty + quantity;

        // Recalculate weighted-average cost
        decimal newAvgCost = afterQty > 0
            ? ((beforeQty * reservoir.CurrentUnitCost) + (quantity * unitCost)) / afterQty
            : unitCost;

        reservoir.CurrentFluidQuantity = afterQty;
        reservoir.CurrentUnitCost = newAvgCost;
        reservoir.UpdatedAtUtc = DateTime.UtcNow;

        var txn = new EquipmentReservoirTransaction
        {
            EquipmentReservoirId = reservoirId,
            TransactionType = ReservoirTransactionType.TransferInFromStorage,
            QuantityChange = quantity,
            QuantityBefore = beforeQty,
            QuantityAfter = afterQty,
            UnitCostAtTransaction = unitCost,
            WeightedAverageCostAfter = newAvgCost,
            StockTransactionId = stockTxnResult.Value.Id,
            SourceInventoryLotId = sourceLotId,
            Remarks = remarks,
            PerformedByUserId = userId,
            TransactionDateUtc = DateTime.UtcNow
        };

        _context.EquipmentReservoirTransactions.Add(txn);
        await _context.SaveChangesAsync(ct);

        return Result<EquipmentReservoirTransactionDto>.Success(MapToDto(txn));
    }

    /// <summary>
    /// Records oil absorbed by food during production batch.
    /// Only the absorbed quantity/cost is charged to production.
    /// </summary>
    public async Task<Result<decimal>> RecordBatchAbsorptionAsync(
        long reservoirId,
        decimal quantityAbsorbed,
        long productionBatchId,
        string? remarks,
        long? userId,
        CancellationToken ct = default)
    {
        if (quantityAbsorbed <= 0)
            return Result<decimal>.Success(0);

        var reservoir = await _context.EquipmentReservoirs.FindAsync(new object[] { reservoirId }, ct);
        if (reservoir == null)
            return Result<decimal>.Failure("Reservoir not found.");

        if (reservoir.CurrentFluidQuantity < quantityAbsorbed)
            return Result<decimal>.Failure("Insufficient fluid in reservoir for batch absorption.");

        decimal beforeQty = reservoir.CurrentFluidQuantity;
        decimal afterQty = beforeQty - quantityAbsorbed;
        decimal costPerUnit = reservoir.CurrentUnitCost;
        decimal totalCost = quantityAbsorbed * costPerUnit;

        reservoir.CurrentFluidQuantity = afterQty;
        reservoir.UpdatedAtUtc = DateTime.UtcNow;

        var txn = new EquipmentReservoirTransaction
        {
            EquipmentReservoirId = reservoirId,
            TransactionType = ReservoirTransactionType.AbsorbedByBatch,
            QuantityChange = -quantityAbsorbed,
            QuantityBefore = beforeQty,
            QuantityAfter = afterQty,
            UnitCostAtTransaction = costPerUnit,
            WeightedAverageCostAfter = costPerUnit,
            ProductionBatchId = productionBatchId,
            Remarks = remarks ?? $"Absorbed by production batch {productionBatchId}",
            PerformedByUserId = userId,
            TransactionDateUtc = DateTime.UtcNow
        };

        _context.EquipmentReservoirTransactions.Add(txn);
        await _context.SaveChangesAsync(ct);

        return Result<decimal>.Success(totalCost);
    }

    /// <summary>
    /// Discards bottom sludge / burnt particulate.
    /// </summary>
    public async Task<Result<EquipmentReservoirTransactionDto>> DiscardSludgeAsync(
        long reservoirId,
        decimal quantityDiscarded,
        string? remarks,
        long? userId,
        CancellationToken ct = default)
    {
        if (quantityDiscarded <= 0)
            return Result<EquipmentReservoirTransactionDto>.Failure("Discard quantity must be positive.");

        var reservoir = await _context.EquipmentReservoirs.FindAsync(new object[] { reservoirId }, ct);
        if (reservoir == null)
            return Result<EquipmentReservoirTransactionDto>.Failure("Reservoir not found.");

        if (reservoir.CurrentFluidQuantity < quantityDiscarded)
            return Result<EquipmentReservoirTransactionDto>.Failure("Discard quantity exceeds reservoir fluid level.");

        decimal beforeQty = reservoir.CurrentFluidQuantity;
        decimal afterQty = beforeQty - quantityDiscarded;

        reservoir.CurrentFluidQuantity = afterQty;
        reservoir.UpdatedAtUtc = DateTime.UtcNow;

        var txn = new EquipmentReservoirTransaction
        {
            EquipmentReservoirId = reservoirId,
            TransactionType = ReservoirTransactionType.SludgeDiscarded,
            QuantityChange = -quantityDiscarded,
            QuantityBefore = beforeQty,
            QuantityAfter = afterQty,
            UnitCostAtTransaction = reservoir.CurrentUnitCost,
            WeightedAverageCostAfter = reservoir.CurrentUnitCost,
            Remarks = remarks ?? "Sludge removed",
            PerformedByUserId = userId,
            TransactionDateUtc = DateTime.UtcNow
        };

        _context.EquipmentReservoirTransactions.Add(txn);
        await _context.SaveChangesAsync(ct);

        return Result<EquipmentReservoirTransactionDto>.Success(MapToDto(txn));
    }

    /// <summary>
    /// Full drain of reservoir for oil replacement / cleaning.
    /// </summary>
    public async Task<Result<EquipmentReservoirTransactionDto>> FullDrainAsync(
        long reservoirId,
        string? remarks,
        long? userId,
        CancellationToken ct = default)
    {
        var reservoir = await _context.EquipmentReservoirs.FindAsync(new object[] { reservoirId }, ct);
        if (reservoir == null)
            return Result<EquipmentReservoirTransactionDto>.Failure("Reservoir not found.");

        decimal beforeQty = reservoir.CurrentFluidQuantity;
        reservoir.CurrentFluidQuantity = 0;
        reservoir.LastCleanedOrReplacedUtc = DateTime.UtcNow;
        reservoir.UpdatedAtUtc = DateTime.UtcNow;

        var txn = new EquipmentReservoirTransaction
        {
            EquipmentReservoirId = reservoirId,
            TransactionType = ReservoirTransactionType.FullDrainWastage,
            QuantityChange = -beforeQty,
            QuantityBefore = beforeQty,
            QuantityAfter = 0,
            UnitCostAtTransaction = reservoir.CurrentUnitCost,
            WeightedAverageCostAfter = 0,
            Remarks = remarks ?? "Full drain & clean",
            PerformedByUserId = userId,
            TransactionDateUtc = DateTime.UtcNow
        };

        _context.EquipmentReservoirTransactions.Add(txn);
        await _context.SaveChangesAsync(ct);

        return Result<EquipmentReservoirTransactionDto>.Success(MapToDto(txn));
    }

    private static EquipmentReservoirTransactionDto MapToDto(EquipmentReservoirTransaction txn)
    {
        return new EquipmentReservoirTransactionDto(
            txn.Id,
            txn.EquipmentReservoirId,
            txn.TransactionType,
            txn.QuantityChange,
            txn.QuantityBefore,
            txn.QuantityAfter,
            txn.UnitCostAtTransaction,
            txn.WeightedAverageCostAfter,
            txn.ProductionBatchId,
            txn.SourceInventoryLotId,
            txn.Remarks,
            txn.TransactionDateUtc
        );
    }
}
