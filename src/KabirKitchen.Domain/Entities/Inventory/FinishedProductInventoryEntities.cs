using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Inventory;

/// <summary>
/// Branch-level stock balance for batch-produced sellable catalog items
/// (e.g. pre-made Fried Chicken, Cake Slices). Only MenuItems with
/// ProductionType = BatchProduced will have rows here.
/// </summary>
public class BranchProductStock : BaseEntity
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public long MenuItemId { get; set; }
    public MenuItem? MenuItem { get; set; }

    public long? MenuItemVariantId { get; set; }

    public decimal CurrentStockQuantity { get; set; } = 0;
    public decimal ReservedQuantity { get; set; } = 0;
    public decimal QuarantinedQuantity { get; set; } = 0;
    public decimal MinimumAlertStock { get; set; } = 0;
    public decimal MovingAverageCostPerUnit { get; set; } = 0;

    public byte[]? RowVersion { get; set; }

    public decimal AvailableQuantity => CurrentStockQuantity - ReservedQuantity - QuarantinedQuantity;
}

/// <summary>
/// Immutable audit ledger for finished product stock movements.
/// QuantityChange is SIGNED: positive for production completions, negative for sales/wastage.
/// </summary>
public class ProductStockTransaction : BaseEntity
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public long MenuItemId { get; set; }
    public MenuItem? MenuItem { get; set; }

    public long? MenuItemVariantId { get; set; }

    public long? BranchProductStockId { get; set; }
    public BranchProductStock? BranchProductStock { get; set; }

    public ProductStockTransactionType TransactionType { get; set; }

    /// <summary>Signed: + for inflows (production accepted), - for outflows (sales, wastage).</summary>
    public decimal QuantityChange { get; set; }
    public decimal QuantityBefore { get; set; }
    public decimal QuantityAfter { get; set; }

    public UnitType UnitUsed { get; set; } = UnitType.Piece;
    public decimal UnitCostAtTransaction { get; set; }
    public decimal TotalCost { get; set; }

    public long? ProductionBatchId { get; set; }
    public long? OrderId { get; set; }
    public long? ReversalOfTransactionId { get; set; }

    public string? ReferenceDocumentType { get; set; }
    public string? ReferenceDocumentNumber { get; set; }
    public string? Remarks { get; set; }
    public long? PerformedByUserId { get; set; }
    public DateTime TransactionDateUtc { get; set; } = DateTime.UtcNow;
}

