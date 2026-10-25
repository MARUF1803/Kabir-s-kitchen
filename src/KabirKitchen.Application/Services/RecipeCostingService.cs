using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Recipe;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public class RecipeCostingService
{
    private readonly IApplicationDbContext _context;

    public RecipeCostingService(IApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Calculates the dynamic BOM cost of a recipe based on moving average costs of ingredients.
    /// </summary>
    public decimal CalculateRecipeCost(Recipe recipe)
    {
        if (recipe.Ingredients == null || !recipe.Ingredients.Any())
            return 0;

        decimal totalCost = 0;
        foreach (var item in recipe.Ingredients)
        {
            if (item.Ingredient == null) continue;

            // Convert quantity used in recipe to the base unit of the ingredient
            decimal qtyInBaseUnit = UnitConverter.ConvertToBaseUnit(
                item.QuantityRequired,
                item.UnitUsed,
                item.Ingredient.BaseUnit);

            // Factor in cooking/cutting yield loss
            decimal wastageMultiplier = 1.0m + (item.WastagePreparationLossPercent / 100.0m);
            decimal effectiveQty = qtyInBaseUnit * wastageMultiplier;

            decimal ingredientLineCost = effectiveQty * item.Ingredient.CurrentAverageCostPerBaseUnit;
            totalCost += ingredientLineCost;
        }

        return recipe.YieldServings > 0 ? Math.Round(totalCost / recipe.YieldServings, 2) : Math.Round(totalCost, 2);
    }

    /// <summary>
    /// Returns a full costing breakdown for a menu item.
    /// </summary>
    public async Task<RecipeDto?> GetMenuItemCostingAsync(long menuItemId, long? variantId = null)
    {
        var recipe = await _context.Recipes
            .Include(r => r.MenuItem)
            .Include(r => r.MenuItemVariant)
            .Include(r => r.Ingredients)
                .ThenInclude(ri => ri.Ingredient)
            .FirstOrDefaultAsync(r => r.MenuItemId == menuItemId && r.MenuItemVariantId == variantId);

        if (recipe == null) return null;

        decimal totalBOMCost = CalculateRecipeCost(recipe);
        decimal sellingPrice = recipe.MenuItemVariant != null && recipe.MenuItemVariant.AdditionalPrice > 0
            ? recipe.MenuItem!.BasePrice + recipe.MenuItemVariant.AdditionalPrice
            : recipe.MenuItem!.BasePrice;

        decimal grossMargin = sellingPrice - totalBOMCost;
        decimal foodCostPercent = sellingPrice > 0 ? Math.Round((totalBOMCost / sellingPrice) * 100, 2) : 0;
        bool isAboveTarget = foodCostPercent > recipe.TargetFoodCostPercent;

        var ingredientDtos = recipe.Ingredients.Select(ri =>
        {
            decimal qtyInBase = UnitConverter.ConvertToBaseUnit(ri.QuantityRequired, ri.UnitUsed, ri.Ingredient!.BaseUnit);
            decimal cost = Math.Round(qtyInBase * (1.0m + ri.WastagePreparationLossPercent / 100.0m) * ri.Ingredient.CurrentAverageCostPerBaseUnit, 2);
            return new RecipeIngredientDto(
                ri.IngredientId,
                ri.Ingredient.Name,
                ri.QuantityRequired,
                ri.UnitUsed,
                ri.WastagePreparationLossPercent,
                ri.Ingredient.CurrentAverageCostPerBaseUnit,
                cost);
        }).ToList();

        return new RecipeDto(
            recipe.Id,
            recipe.MenuItemId,
            recipe.MenuItem.Name,
            recipe.MenuItemVariantId,
            recipe.MenuItemVariant?.VariantName,
            recipe.YieldServings,
            recipe.TargetFoodCostPercent,
            totalBOMCost,
            sellingPrice,
            grossMargin,
            foodCostPercent,
            isAboveTarget,
            ingredientDtos
        );
    }

    /// <summary>
    /// Scans all recipes and flags any food item whose food cost % has spiked above target.
    /// </summary>
    public async Task<List<FoodCostAlertDto>> GetFoodCostSpikeAlertsAsync()
    {
        var recipes = await _context.Recipes
            .Include(r => r.MenuItem)
            .Include(r => r.MenuItemVariant)
            .Include(r => r.Ingredients)
                .ThenInclude(ri => ri.Ingredient)
            .ToListAsync();

        var alerts = new List<FoodCostAlertDto>();

        foreach (var r in recipes)
        {
            if (r.MenuItem == null) continue;

            decimal bomCost = CalculateRecipeCost(r);
            decimal price = r.MenuItemVariant != null && r.MenuItemVariant.AdditionalPrice > 0
                ? r.MenuItem.BasePrice + r.MenuItemVariant.AdditionalPrice
                : r.MenuItem.BasePrice;

            if (price <= 0) continue;

            decimal costPercent = Math.Round((bomCost / price) * 100, 2);
            if (costPercent > r.TargetFoodCostPercent)
            {
                alerts.Add(new FoodCostAlertDto(
                    r.MenuItemId,
                    $"{r.MenuItem.Name} {(r.MenuItemVariant != null ? $"({r.MenuItemVariant.VariantName})" : "")}".Trim(),
                    price,
                    bomCost,
                    r.TargetFoodCostPercent,
                    costPercent,
                    $"Food cost is {costPercent}% (Target: {r.TargetFoodCostPercent}%). Margin compressed by {costPercent - r.TargetFoodCostPercent}%."
                ));
            }
        }

        return alerts;
    }
}
