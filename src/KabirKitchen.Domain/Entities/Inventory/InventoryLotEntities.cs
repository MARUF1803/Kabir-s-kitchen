using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Inventory;

/// <summary>
/// Physical batch/lot tracking for Raw Materials, Sub-Recipes, and Finished Products.
/// Exactly one of IngredientId, SubRecipeId, or MenuItemId must be set — enforced via DB CHECK.
/// </summary>
public class InventoryLot : BaseEntity
{
    public string LotNumber { get; set; } = string.Empty; // e.g. LOT-RAW-20261103-001

    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public InventoryLotType LotType { get; set; }

    // ─── Exactly one must be populated (enforced by DB CHECK CK_InventoryLot_TypeIntegrity) ───
    public long? IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public long? SubRecipeId { get; set; }
    public SubRecipe? SubRecipe { get; set; }

    public long? MenuItemId { get; set; }
    public MenuItem? MenuItem { get; set; }
    // ──────────────────────────────────────────────────────────────────────────────────────────

    public decimal InitialQuantity { get; set; }
    public decimal RemainingQuantity { get; set; }
    public decimal UnitCost { get; set; }

    public DateTime ManufacturedOrReceivedDateUtc { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Null for legacy stock and non-perishables (HasExpiry = false).
    /// Never fabricated. Only populated when physical expiry info is available.
    /// </summary>
    public DateTime? ExpiryDateUtc { get; set; }

    /// <summary>False for non-perishable items (salt, sugar, etc.) — bypasses FEFO expiry check.</summary>
    public bool HasExpiry { get; set; } = true;

    public InventoryLotStatus Status { get; set; } = InventoryLotStatus.Active;
    public string? StorageLocation { get; set; }

    /// <summary>Source reference: PO#, Production Batch#, or "LEGACY-OPENING-MIGRATION".</summary>
    public string? SourceReference { get; set; }

    public ICollection<IngredientLotAllocation> IngredientAllocations { get; set; } = new List<IngredientLotAllocation>();
    public ICollection<SubRecipeLotAllocation> SubRecipeAllocations { get; set; } = new List<SubRecipeLotAllocation>();
    public ICollection<ProductLotAllocation> ProductAllocations { get; set; } = new List<ProductLotAllocation>();
}

/// <summary>
/// Strongly-typed allocation linking a raw material StockTransaction to a specific InventoryLot.
/// AllocatedQuantity is SIGNED, matching the sign of the parent StockTransaction.QuantityChange.
/// </summary>
public class IngredientLotAllocation : BaseEntity
{
    public long InventoryLotId { get; set; }
    public InventoryLot? InventoryLot { get; set; }

    public long StockTransactionId { get; set; }
    public StockTransaction? StockTransaction { get; set; }

    public decimal AllocatedQuantity { get; set; }
    public decimal LotRemainingQuantityBefore { get; set; }
    public decimal LotRemainingQuantityAfter { get; set; }
    public decimal UnitCostSnapshot { get; set; }

    /// <summary>When reversing, references the original allocation being reversed.</summary>
    public long? OriginalAllocationId { get; set; }
    public IngredientLotAllocation? OriginalAllocation { get; set; }
}

/// <summary>Allocation linking a SubRecipeStockTransaction to a specific InventoryLot.</summary>
public class SubRecipeLotAllocation : BaseEntity
{
    public long InventoryLotId { get; set; }
    public InventoryLot? InventoryLot { get; set; }

    public long SubRecipeStockTransactionId { get; set; }
    public SubRecipeStockTransaction? SubRecipeStockTransaction { get; set; }

    public decimal AllocatedQuantity { get; set; }
    public decimal LotRemainingQuantityBefore { get; set; }
    public decimal LotRemainingQuantityAfter { get; set; }
    public decimal UnitCostSnapshot { get; set; }

    public long? OriginalAllocationId { get; set; }
    public SubRecipeLotAllocation? OriginalAllocation { get; set; }
}

/// <summary>Allocation linking a ProductStockTransaction to a specific InventoryLot.</summary>
public class ProductLotAllocation : BaseEntity
{
    public long InventoryLotId { get; set; }
    public InventoryLot? InventoryLot { get; set; }

    public long ProductStockTransactionId { get; set; }
    public ProductStockTransaction? ProductStockTransaction { get; set; }

    public decimal AllocatedQuantity { get; set; }
    public decimal LotRemainingQuantityBefore { get; set; }
    public decimal LotRemainingQuantityAfter { get; set; }
    public decimal UnitCostSnapshot { get; set; }

    public long? OriginalAllocationId { get; set; }
    public ProductLotAllocation? OriginalAllocation { get; set; }
}

