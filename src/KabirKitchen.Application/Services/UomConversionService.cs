using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

/// <summary>
/// Handles UOM conversions with safety guardrails per Section 9 of the ERP spec.
/// Standard metric conversions (KG↔G, L↔ML) are handled inline.
/// Package-level conversions (Bag=25KG, Bottle=750ML) delegate to IngredientUomConversion.
/// Cross-dimension conversions (mass↔volume) are explicitly rejected.
/// </summary>
public class UomConversionService
{
    private readonly IApplicationDbContext _context;

    public UomConversionService(IApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Returns the base-unit dimension of a UnitType.
    /// </summary>
    public static UnitDimension GetDimension(UnitType unit) => unit switch
    {
        UnitType.Gram or UnitType.Kilogram => UnitDimension.Mass,
        UnitType.Milliliter or UnitType.Liter => UnitDimension.Volume,
        UnitType.Piece => UnitDimension.Discrete,
        _ => throw new ArgumentOutOfRangeException(nameof(unit), $"Unknown UnitType: {unit}")
    };

    /// <summary>
    /// Convert a quantity from fromUnit to toUnit.
    /// Only allows conversions within the same dimension (mass↔mass, volume↔volume, discrete↔discrete).
    /// Throws if cross-dimension conversion is attempted without an explicit IngredientUomConversion record.
    /// </summary>
    public static decimal ConvertSameDimension(decimal quantity, UnitType fromUnit, UnitType toUnit)
    {
        if (fromUnit == toUnit) return quantity;

        var fromDim = GetDimension(fromUnit);
        var toDim = GetDimension(toUnit);

        if (fromDim != toDim)
            throw new InvalidOperationException(
                $"Cannot implicitly convert between {fromUnit} and {toUnit}: different dimensions ({fromDim} → {toDim}). " +
                "Configure an explicit density IngredientUomConversion for this ingredient.");

        return (fromUnit, toUnit) switch
        {
            (UnitType.Gram, UnitType.Kilogram) => quantity / 1000m,
            (UnitType.Kilogram, UnitType.Gram) => quantity * 1000m,
            (UnitType.Milliliter, UnitType.Liter) => quantity / 1000m,
            (UnitType.Liter, UnitType.Milliliter) => quantity * 1000m,
            _ => throw new InvalidOperationException($"Unsupported same-dimension conversion: {fromUnit} → {toUnit}")
        };
    }

    /// <summary>
    /// Convert from a named package unit (e.g. "Bag") to the ingredient's base stock unit.
    /// Looks up the IngredientUomConversion record for this ingredient's package.
    /// </summary>
    public async Task<decimal> ConvertFromPackageToBaseUnitAsync(
        long ingredientId,
        string fromPackageUnit,
        decimal quantity,
        CancellationToken cancellationToken = default)
    {
        var conversion = await _context.IngredientUomConversions
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.IngredientId == ingredientId &&
                                      c.FromUnit == fromPackageUnit &&
                                      c.IsActive,
                cancellationToken);

        if (conversion == null)
            throw new InvalidOperationException(
                $"No active UOM conversion found for ingredient {ingredientId} from package unit '{fromPackageUnit}'. " +
                "Please configure an IngredientUomConversion record.");

        if (conversion.Multiplier <= 0)
            throw new InvalidOperationException(
                $"UOM conversion multiplier for ingredient {ingredientId} from '{fromPackageUnit}' must be positive.");

        return quantity * conversion.Multiplier;
    }

    /// <summary>
    /// Convert from a purchase/recipe unit to the ingredient's storage base unit.
    /// Handles: same unit (no-op), standard metric (KG/G/L/ML), Piece direct.
    /// Does NOT handle package units — use ConvertFromPackageToBaseUnitAsync for those.
    /// </summary>
    public static decimal ConvertToIngredientBaseUnit(decimal quantity, UnitType fromUnit, UnitType ingredientBaseUnit)
    {
        return UnitConverter.ConvertToBaseUnit(quantity, fromUnit, ingredientBaseUnit);
    }
}
