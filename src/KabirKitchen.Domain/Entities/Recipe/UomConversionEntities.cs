using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Recipe;

/// <summary>
/// Configures ingredient-specific package and density conversions.
/// Purchase Unit → Base Stock Unit (e.g. 1 Bag Flour = 25 KG, 1 Carton Eggs = 30 PCS).
/// Standard intra-dimension metric conversions (KG↔G, L↔ML) do not need entries here.
/// Standard Dozen → PCS (12) is automatic.
/// Only cross-dimensional or custom discrete conversions need explicit rows.
/// </summary>
public class IngredientUomConversion : BaseEntity
{
    public long IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    /// <summary>Package unit name, e.g. "Bag", "Carton", "Bottle", "Tin", "Crate".</summary>
    public string FromUnit { get; set; } = string.Empty;

    public UnitType ToBaseUnit { get; set; }

    /// <summary>Conversion multiplier. Must be > 0. e.g. 1 Bag = 25 KG → Multiplier = 25.</summary>
    public decimal Multiplier { get; set; }

    public bool IsDefaultPurchaseUnit { get; set; } = false;

    /// <summary>Human-readable description, e.g. "Teer 25 KG Flour Bag".</summary>
    public string? PackageDescription { get; set; }

    public bool IsActive { get; set; } = true;
}

