using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Inventory;

public class BranchIngredientStock : BaseEntity
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public long IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public decimal CurrentStockQuantity { get; set; } = 0; // Stored in Ingredient.BaseUnit
    public decimal ReservedQuantity { get; set; } = 0;     // Locked for active preparing kitchen orders
    public decimal QuarantinedQuantity { get; set; } = 0;  // Quarantined (expired/damaged, awaiting disposal)
    public decimal LastPurchaseCostPerUnit { get; set; }
    public decimal MovingAverageCostPerUnit { get; set; }
    public byte[]? RowVersion { get; set; }                 // Concurrency token

    public decimal AvailableQuantity => CurrentStockQuantity - ReservedQuantity - QuarantinedQuantity;
}

public class StockTransaction : BaseEntity
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public long IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public StockTransactionType TransactionType { get; set; }
    public decimal QuantityChange { get; set; } // +ve for GRN/TransferIn, -ve for Consumption/Wastage
    public UnitType UnitUsed { get; set; }
    public decimal UnitCostAtTransaction { get; set; }
    public decimal TotalCost { get; set; }

    public string? ReferenceDocumentType { get; set; } // "Order", "PurchaseOrder", "WastageRecord", "BranchTransfer"
    public string? ReferenceDocumentNumber { get; set; }
    public string? Remarks { get; set; }

    public long? PerformedByUserId { get; set; }
    public DateTime TransactionDateUtc { get; set; } = DateTime.UtcNow;
}

public class BranchMenuItemOverride : BaseEntity
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public long MenuItemId { get; set; }
    public MenuItem? MenuItem { get; set; }

    public decimal? CustomPrice { get; set; } // Null if using Global BasePrice
    public bool IsAvailableInBranch { get; set; } = true;
    public bool IsSoldOutToday { get; set; } = false;
}
