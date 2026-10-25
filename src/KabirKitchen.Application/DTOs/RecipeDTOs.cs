using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Application.DTOs;

public record IngredientDto(
    long Id,
    string Name,
    string Code,
    UnitType BaseUnit,
    decimal MinimumAlertStock,
    decimal CurrentAverageCostPerBaseUnit,
    bool IsActive
);

public record RecipeIngredientDto(
    long IngredientId,
    string IngredientName,
    decimal QuantityRequired,
    UnitType UnitUsed,
    decimal WastageLossPercent,
    decimal UnitCostSnapshot,
    decimal CalculatedIngredientCost
);

public record RecipeDto(
    long Id,
    long MenuItemId,
    string MenuItemName,
    long? MenuItemVariantId,
    string? VariantName,
    int YieldServings,
    decimal TargetFoodCostPercent,
    decimal TotalRecipeBOMCost,
    decimal CurrentSellingPrice,
    decimal CurrentGrossMarginAmount,
    decimal CurrentFoodCostPercent,
    bool IsFoodCostAboveTarget,
    List<RecipeIngredientDto> Ingredients
);

public record CreateRecipeDto(
    long MenuItemId,
    long? MenuItemVariantId,
    string RecipeName,
    string? CookingInstructions,
    int YieldServings,
    decimal TargetFoodCostPercent,
    List<CreateRecipeIngredientItemDto> Ingredients
);

public record CreateRecipeIngredientItemDto(
    long IngredientId,
    decimal QuantityRequired,
    UnitType UnitUsed,
    decimal WastagePreparationLossPercent
);

public record FoodCostAlertDto(
    long MenuItemId,
    string MenuItemName,
    decimal SellingPrice,
    decimal TotalBOMCost,
    decimal TargetFoodCostPercent,
    decimal CurrentFoodCostPercent,
    string AlertMessage
);
