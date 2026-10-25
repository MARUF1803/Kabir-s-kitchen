using FluentAssertions;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;
using KabirKitchen.Application.Services;
using Moq;
using KabirKitchen.Application.Common.Interfaces;

namespace KabirKitchen.Tests;

public class UnitConverterTests
{
    [Fact]
    public void ConvertToBaseUnit_ShouldConvertGramsToKilogramsCorrectly()
    {
        // 500 grams should be 0.5 kilograms
        decimal result = UnitConverter.ConvertToBaseUnit(500, UnitType.Gram, UnitType.Kilogram);
        result.Should().Be(0.5m);
    }

    [Fact]
    public void ConvertToBaseUnit_ShouldConvertMillilitersToLitersCorrectly()
    {
        // 250 ml should be 0.25 liters
        decimal result = UnitConverter.ConvertToBaseUnit(250, UnitType.Milliliter, UnitType.Liter);
        result.Should().Be(0.25m);
    }

    [Fact]
    public void ConvertToBaseUnit_ShouldReturnSameQuantity_WhenUnitsMatch()
    {
        decimal result = UnitConverter.ConvertToBaseUnit(5, UnitType.Kilogram, UnitType.Kilogram);
        result.Should().Be(5m);
    }
}

public class RecipeCostingEngineTests
{
    [Fact]
    public void CalculateRecipeCost_ShouldCalculatePreciseBOMTotal()
    {
        // Arrange
        var mockContext = new Mock<IApplicationDbContext>();
        var costingService = new RecipeCostingService(mockContext.Object);

        var chicken = new Ingredient
        {
            Name = "Boneless Chicken",
            BaseUnit = UnitType.Kilogram,
            CurrentAverageCostPerBaseUnit = 300m // 300 BDT per kg = 0.3 BDT per gram
        };

        var noodles = new Ingredient
        {
            Name = "Noodles",
            BaseUnit = UnitType.Kilogram,
            CurrentAverageCostPerBaseUnit = 100m // 100 BDT per kg = 0.1 BDT per gram
        };

        var recipe = new Recipe
        {
            RecipeName = "Chow Mein",
            YieldServings = 1,
            Ingredients = new List<RecipeIngredient>
            {
                new()
                {
                    Ingredient = chicken,
                    QuantityRequired = 100, // 100g = 30 BDT
                    UnitUsed = UnitType.Gram,
                    WastagePreparationLossPercent = 0
                },
                new()
                {
                    Ingredient = noodles,
                    QuantityRequired = 200, // 200g = 20 BDT
                    UnitUsed = UnitType.Gram,
                    WastagePreparationLossPercent = 0
                }
            }
        };

        // Act
        decimal cost = costingService.CalculateRecipeCost(recipe);

        // Assert
        // 100g * 0.3 = 30 BDT, 200g * 0.1 = 20 BDT => Total 50 BDT
        cost.Should().Be(50m);
    }
}
