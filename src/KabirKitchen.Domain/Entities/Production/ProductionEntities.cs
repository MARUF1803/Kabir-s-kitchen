using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Production;

/// <summary>
/// Production work order for manufacturing either a SubRecipe or a BatchProduced MenuItem.
/// Lifecycle: Draft → Planned → InProgress → Completed → Posted | Cancelled
/// Stock posting (atomic raw deduction + accepted output addition) only occurs on status = Posted.
/// </summary>
public class ProductionBatch : BaseEntity
{
    public string BatchNumber { get; set; } = string.Empty; // e.g. BATCH-20261103-001
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public ProductionTargetType TargetType { get; set; }

    // ─── Exactly one must be set (enforced by DB CHECK CK_ProductionBatch_Target) ───
    public long? SubRecipeId { get; set; }
    public SubRecipe? SubRecipe { get; set; }

    public long? MenuItemId { get; set; }
    public MenuItem? MenuItem { get; set; }

    public long? MenuItemVariantId { get; set; }
    // ───────────────────────────────────────────────────────────────────────────────

    public ProductionBatchStatus Status { get; set; } = ProductionBatchStatus.Draft;

    public decimal PlannedQuantity { get; set; }
    public decimal ActualProducedQuantity { get; set; } = 0;
    public decimal RejectedQuantity { get; set; } = 0;

    /// <summary>AcceptedQuantity = ActualProducedQuantity - RejectedQuantity. Only this enters usable stock.</summary>
    public decimal AcceptedQuantity { get; set; } = 0;

    public DateTime? ScheduledStartUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public DateTime? PostedAtUtc { get; set; }

    public long CreatedByUserId { get; set; }
    public long? ApprovedByUserId { get; set; }

    public string? ProductionNotes { get; set; }
    public string? RejectionReason { get; set; }

    /// <summary>Idempotency key prevents duplicate stock posting on retry.</summary>
    public string? IdempotencyKey { get; set; }
    public bool IsPosted { get; set; } = false;

    public byte[]? RowVersion { get; set; }

    public ICollection<ProductionBatchIngredient> ConsumedIngredients { get; set; } = new List<ProductionBatchIngredient>();
    public ICollection<ProductionBatchSubRecipe> ConsumedSubRecipes { get; set; } = new List<ProductionBatchSubRecipe>();
    public ProductionBatchCostSnapshot? CostSnapshot { get; set; }
}

/// <summary>Exact raw ingredient consumed during a production batch.</summary>
public class ProductionBatchIngredient : BaseEntity
{
    public long ProductionBatchId { get; set; }
    public ProductionBatch? ProductionBatch { get; set; }

    public long IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public decimal PlannedQuantity { get; set; }
    public decimal ActualQuantityConsumed { get; set; }
    public UnitType UnitUsed { get; set; }
    public decimal QuantityInBaseUnit { get; set; }
    public decimal UnitCostSnapshot { get; set; }
    public decimal TotalCost { get; set; }
}

/// <summary>Sub-recipe component consumed during a production batch. Deducts from BranchSubRecipeStock.</summary>
public class ProductionBatchSubRecipe : BaseEntity
{
    public long ProductionBatchId { get; set; }
    public ProductionBatch? ProductionBatch { get; set; }

    public long SubRecipeId { get; set; }
    public SubRecipe? SubRecipe { get; set; }

    public decimal PlannedQuantity { get; set; }
    public decimal ActualQuantityConsumed { get; set; }
    public UnitType UnitUsed { get; set; }
    public decimal UnitCostSnapshot { get; set; }
    public decimal TotalCost { get; set; }
}

/// <summary>
/// Permanent, immutable financial record of a production batch's costs.
/// IsImmutable = true once posted. Corrections append a new snapshot with CorrectionOfSnapshotId.
/// </summary>
public class ProductionBatchCostSnapshot : BaseEntity
{
    public long ProductionBatchId { get; set; }
    public ProductionBatch? ProductionBatch { get; set; }

    // ─── Material Costs ───
    public decimal RawMaterialsCostTotal { get; set; }
    public decimal SubRecipesCostTotal { get; set; }
    public decimal ReusableMaterialsCostTotal { get; set; }

    // ─── Overhead Costs (optional) ───
    public decimal DirectLaborCostTotal { get; set; }
    public decimal UtilityCostTotal { get; set; }
    public decimal PackagingCostTotal { get; set; }
    public decimal OtherOverheadCostTotal { get; set; }

    // ─── Quantity Breakdown ───
    public decimal PlannedQuantity { get; set; }
    public decimal ActualProducedQuantity { get; set; }
    public decimal RejectedQuantity { get; set; }
    public decimal AcceptedQuantity { get; set; }

    // ─── Aggregated Costs ───
    public decimal IngredientOnlyTotalCost { get; set; }

    /// <summary>Null when AcceptedQuantity == 0 (prevents division by zero).</summary>
    public decimal? IngredientOnlyUnitCost { get; set; }

    public decimal FullProductionTotalCost { get; set; }

    /// <summary>Null when AcceptedQuantity == 0.</summary>
    public decimal? FullProductionUnitCost { get; set; }

    /// <summary>When AcceptedQuantity == 0, entire cost is recorded here as kitchen loss.</summary>
    public decimal TotalBatchSpoilageLoss { get; set; }

    public bool IsImmutable { get; set; } = false;

    /// <summary>References the original snapshot when this row is a correction.</summary>
    public long? CorrectionOfSnapshotId { get; set; }
    public ProductionBatchCostSnapshot? CorrectionOfSnapshot { get; set; }

    public DateTime SnapshotTimestampUtc { get; set; } = DateTime.UtcNow;
}

