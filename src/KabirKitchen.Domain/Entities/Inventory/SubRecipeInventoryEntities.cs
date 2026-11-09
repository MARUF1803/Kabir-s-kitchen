using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Inventory;

/// <summary>Branch-level stock balance for semi-finished sub-recipe goods.</summary>
public class BranchSubRecipeStock : BaseEntity
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public long SubRecipeId { get; set; }
    public SubRecipe? SubRecipe { get; set; }

    public decimal CurrentStockQuantity { get; set; } = 0;
    public decimal ReservedQuantity { get; set; } = 0;
    public decimal QuarantinedQuantity { get; set; } = 0;
    public decimal MinimumAlertStock { get; set; } = 0;
    public decimal MovingAverageCostPerUnit { get; set; } = 0;

    /// <summary>Concurrency token prevents simultaneous over-allocation.</summary>
    public byte[]? RowVersion { get; set; }

    public decimal AvailableQuantity => CurrentStockQuantity - ReservedQuantity - QuarantinedQuantity;
}

/// <summary>
/// Immutable audit ledger for sub-recipe stock movements.
/// QuantityChange is SIGNED: positive for inflows, negative for outflows.
/// </summary>
public class SubRecipeStockTransaction : BaseEntity
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public long SubRecipeId { get; set; }
    public SubRecipe? SubRecipe { get; set; }

    public long? BranchSubRecipeStockId { get; set; }
    public BranchSubRecipeStock? BranchSubRecipeStock { get; set; }

    public SubRecipeTransactionType TransactionType { get; set; }

    /// <summary>Signed quantity: + for receipts/production, - for consumption/wastage.</summary>
    public decimal QuantityChange { get; set; }
    public decimal QuantityBefore { get; set; }
    public decimal QuantityAfter { get; set; }

    public UnitType UnitUsed { get; set; }
    public decimal UnitCostAtTransaction { get; set; }
    public decimal TotalCost { get; set; }

    public long? ProductionBatchId { get; set; }
    public long? ParentOrderId { get; set; }

    /// <summary>When TransactionType == Reversal, references the original transaction being reversed.</summary>
    public long? ReversalOfTransactionId { get; set; }

    public string? ReferenceDocumentType { get; set; }
    public string? ReferenceDocumentNumber { get; set; }
    public string? Remarks { get; set; }
    public long? PerformedByUserId { get; set; }
    public DateTime TransactionDateUtc { get; set; } = DateTime.UtcNow;
}

