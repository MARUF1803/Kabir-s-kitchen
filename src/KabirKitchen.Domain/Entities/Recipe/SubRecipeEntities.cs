using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Recipe;

/// <summary>
/// A SubRecipe is an intermediate semi-finished product (e.g. Burger Sauce, Pizza Dough,
/// Chicken Marinade) that is prepared in batches, stored independently, and consumed by
/// parent MenuItem recipes or other sub-recipes. It is NEVER exposed as a sellable MenuItem.
/// </summary>
public class SubRecipe : BaseEntity, ISoftDelete
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty; // e.g. "SUB-SAUCE-01"
    public string? Description { get; set; }

    /// <summary>Base unit used for storage and stock tracking (Gram, Kilogram, Milliliter, Liter, Piece).</summary>
    public UnitType BaseUnit { get; set; } = UnitType.Kilogram;

    /// <summary>Expected yield per standard production batch.</summary>
    public decimal StandardBatchYield { get; set; } = 1m;

    public StorageCondition StorageCondition { get; set; } = StorageCondition.Chilled;

    /// <summary>Shelf life in hours for short-lived sub-recipes (e.g. Pizza Dough: 24h).</summary>
    public int? ShelfLifeHours { get; set; }

    /// <summary>Shelf life in days for longer-lived sub-recipes (e.g. Frozen Beef Patty: 30d).</summary>
    public int? ShelfLifeDays { get; set; }

    /// <summary>False for non-perishables (e.g. dry spice mixes) — no expiry date fabricated.</summary>
    public bool HasExpiry { get; set; } = true;

    public bool IsActive { get; set; } = true;

    // ISoftDelete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public string? DeletedBy { get; set; }

    public ICollection<SubRecipeIngredient> Ingredients { get; set; } = new List<SubRecipeIngredient>();
}

/// <summary>
/// Bill of Materials for a SubRecipe. Each row references EITHER a raw Ingredient
/// OR a nested ChildSubRecipeId (never both). Enforced by application and DB CHECK.
/// </summary>
public class SubRecipeIngredient : BaseEntity
{
    public long SubRecipeId { get; set; }
    public SubRecipe? SubRecipe { get; set; }

    // --- Exactly one of the following two must be set ---

    /// <summary>Raw material ingredient FK. Null when ChildSubRecipeId is set.</summary>
    public long? IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    /// <summary>Nested semi-finished component FK. Null when IngredientId is set.</summary>
    public long? ChildSubRecipeId { get; set; }
    public SubRecipe? ChildSubRecipe { get; set; }

    // -------------------------------------------------------

    public decimal Quantity { get; set; }
    public UnitType Unit { get; set; }

    /// <summary>Quantity already converted to the target's BaseUnit for stock deduction.</summary>
    public decimal QuantityInBaseUnit { get; set; }

    public string? Notes { get; set; }
}

