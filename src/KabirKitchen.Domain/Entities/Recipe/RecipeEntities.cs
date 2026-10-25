using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Recipe;

public class Ingredient : BaseEntity, ISoftDelete
{
    public string Name { get; set; } = string.Empty; // e.g., "Boneless Chicken Breast", "All-Purpose Flour"
    public string Code { get; set; } = string.Empty; // e.g., "ING-CHK-01"
    public UnitType BaseUnit { get; set; } = UnitType.Kilogram; // Base storage unit
    public decimal MinimumAlertStock { get; set; } = 5; // Low stock threshold
    public decimal CurrentAverageCostPerBaseUnit { get; set; } // Moving average cost per kg or liter
    public bool IsActive { get; set; } = true;

    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public string? DeletedBy { get; set; }

    public ICollection<RecipeIngredient> UsedInRecipes { get; set; } = new List<RecipeIngredient>();
}

public class Recipe : BaseEntity
{
    public long MenuItemId { get; set; }
    public MenuItem? MenuItem { get; set; }

    public long? MenuItemVariantId { get; set; }
    public MenuItemVariant? MenuItemVariant { get; set; }

    public string RecipeName { get; set; } = string.Empty;
    public string? CookingInstructions { get; set; }
    public int YieldServings { get; set; } = 1;
    public decimal TargetFoodCostPercent { get; set; } = 35.0m; // Target margin benchmark

    public ICollection<RecipeIngredient> Ingredients { get; set; } = new List<RecipeIngredient>();
}

public class RecipeIngredient : BaseEntity
{
    public long RecipeId { get; set; }
    public Recipe? Recipe { get; set; }

    public long IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public decimal QuantityRequired { get; set; } // e.g., 80 (if grams) or 0.08 (if kg)
    public UnitType UnitUsed { get; set; } = UnitType.Gram;
    public decimal WastagePreparationLossPercent { get; set; } = 0.0m; // Cooking/cutting loss
}
