using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Inventory;

/// <summary>
/// Tracks cooking fluid (e.g. frying oil) held inside a specific piece of equipment (e.g. Fryer Vat #1).
/// This is separate from general BranchIngredientStock — fluid moves from storage into the reservoir
/// then is consumed batch-by-batch. Only the net consumed/sludge quantity is expensed per batch.
/// </summary>
public class EquipmentReservoir : BaseEntity
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public string EquipmentName { get; set; } = string.Empty; // e.g. "Fryer Vat #1 (Henny Penny)"
    public string? EquipmentCode { get; set; }

    public long IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; } // e.g. Soybean Frying Oil

    public decimal CurrentFluidQuantity { get; set; } = 0;

    /// <summary>Weighted-average cost of mixed fluid currently in the reservoir.</summary>
    public decimal CurrentUnitCost { get; set; } = 0;

    public decimal MaxCapacity { get; set; }

    public DateTime? LastCleanedOrReplacedUtc { get; set; }
    public bool IsActive { get; set; } = true;
    public byte[]? RowVersion { get; set; }

    public ICollection<EquipmentReservoirTransaction> Transactions { get; set; } = new List<EquipmentReservoirTransaction>();
}

/// <summary>
/// Immutable audit record for every fluid movement in/out of an EquipmentReservoir.
/// Correlated with StockTransaction (for transfer-out from storage) and ProductionBatch (for absorption).
/// </summary>
public class EquipmentReservoirTransaction : BaseEntity
{
    public long EquipmentReservoirId { get; set; }
    public EquipmentReservoir? EquipmentReservoir { get; set; }

    public ReservoirTransactionType TransactionType { get; set; }

    /// <summary>Signed: + for inflows (transfer from storage), - for outflows (absorbed by food, sludge).</summary>
    public decimal QuantityChange { get; set; }
    public decimal QuantityBefore { get; set; }
    public decimal QuantityAfter { get; set; }

    public decimal UnitCostAtTransaction { get; set; }

    /// <summary>Recalculated weighted-average cost after the transaction completes.</summary>
    public decimal WeightedAverageCostAfter { get; set; }

    public long? ProductionBatchId { get; set; }

    /// <summary>When transferring oil from storage, correlated StockTransaction.Id (TransferOut type).</summary>
    public long? StockTransactionId { get; set; }

    /// <summary>Source lot from which the transferred oil came (for multi-lot traceability).</summary>
    public long? SourceInventoryLotId { get; set; }
    public InventoryLot? SourceInventoryLot { get; set; }

    public string? Remarks { get; set; }
    public long? PerformedByUserId { get; set; }
    public DateTime TransactionDateUtc { get; set; } = DateTime.UtcNow;
}

