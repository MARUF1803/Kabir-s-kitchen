using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Common;

public static class UnitConverter
{
    /// <summary>
    /// Converts a quantity from one unit type to the base unit type of the ingredient.
    /// Base units are Kilogram (for mass) and Liter (for liquid volume) and Piece (for discrete items).
    /// </summary>
    public static decimal ConvertToBaseUnit(decimal quantity, UnitType fromUnit, UnitType targetBaseUnit)
    {
        if (fromUnit == targetBaseUnit) return quantity;

        // Mass: Gram -> Kilogram
        if (fromUnit == UnitType.Gram && targetBaseUnit == UnitType.Kilogram)
            return quantity / 1000.0m;

        // Mass: Kilogram -> Gram
        if (fromUnit == UnitType.Kilogram && targetBaseUnit == UnitType.Gram)
            return quantity * 1000.0m;

        // Volume: Milliliter -> Liter
        if (fromUnit == UnitType.Milliliter && targetBaseUnit == UnitType.Liter)
            return quantity / 1000.0m;

        // Volume: Liter -> Milliliter
        if (fromUnit == UnitType.Liter && targetBaseUnit == UnitType.Milliliter)
            return quantity * 1000.0m;

        // Pieces stay pieces
        if (fromUnit == UnitType.Piece && targetBaseUnit == UnitType.Piece)
            return quantity;

        // Fallback if units mismatch
        return quantity;
    }
}
