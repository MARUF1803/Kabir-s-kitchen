using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Identity;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace KabirKitchen.Infrastructure.Persistence;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(KabirKitchenDbContext context, IConfiguration configuration)
    {
        if (await context.Branches.AnyAsync())
        {
            return; // Database already seeded
        }

        var adminEmail = configuration["BootstrapAdmin:Email"];
        var adminName = configuration["BootstrapAdmin:FullName"];
        var adminPhone = configuration["BootstrapAdmin:PhoneNumber"];
        var adminPassword = configuration["BootstrapAdmin:Password"];
        if (string.IsNullOrWhiteSpace(adminEmail) ||
            string.IsNullOrWhiteSpace(adminName) ||
            string.IsNullOrWhiteSpace(adminPhone) ||
            string.IsNullOrWhiteSpace(adminPassword))
        {
            throw new InvalidOperationException(
                "A new database requires BootstrapAdmin:Email, FullName, PhoneNumber, and Password environment settings.");
        }

        if (adminPassword.Length < 12)
        {
            throw new InvalidOperationException("BootstrapAdmin:Password must contain at least 12 characters in every environment.");
        }

        await using var transaction = await context.Database.BeginTransactionAsync();

        // 1. Seed Roles
        var adminRole = new Role { Name = "Admin", NormalizedName = "ADMIN", Description = "System Administrator" };
        var cashierRole = new Role { Name = "Cashier", NormalizedName = "CASHIER", Description = "Front Desk & POS Cashier" };
        var chefRole = new Role { Name = "Chef", NormalizedName = "CHEF", Description = "Kitchen Master Chef" };
        var customerRole = new Role { Name = "Customer", NormalizedName = "CUSTOMER", Description = "Retail Client" };

        context.Roles.AddRange(adminRole, cashierRole, chefRole, customerRole);
        await context.SaveChangesAsync();

        // 2. Seed Branches (Scalable to 100+)
        var dhanmondi = new Branch
        {
            BranchCode = "DHN-01",
            Name = "Dhanmondi Branch",
            Address = "House 42, Road 7/A, Dhanmondi, Dhaka",
            ContactPhone = "+8801711000001",
            ContactEmail = "dhanmondi@kabirskitchen.com",
            CurrentCashDrawerBalance = 5000.00m
        };

        var mirpur = new Branch
        {
            BranchCode = "MIR-02",
            Name = "Mirpur Branch",
            Address = "Plot 12, Block D, Mirpur-10, Dhaka",
            ContactPhone = "+8801711000002",
            ContactEmail = "mirpur@kabirskitchen.com",
            CurrentCashDrawerBalance = 5000.00m
        };

        context.Branches.AddRange(dhanmondi, mirpur);
        await context.SaveChangesAsync();

        // 3. Seed Users
        string passwordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword);

        var adminUser = new User
        {
            FullName = adminName,
            Email = adminEmail,
            PhoneNumber = adminPhone,
            PasswordHash = passwordHash,
            IsGlobalSuperAdmin = true
        };

        context.Users.Add(adminUser);
        await context.SaveChangesAsync();

        // Link User Roles and Branches
        context.UserRoles.Add(new UserRoleAssignment { UserId = adminUser.Id, RoleId = adminRole.Id });
        await context.SaveChangesAsync();

        // 4. Seed Categories
        var catChineseThai = new Category { Name = "Chinese & Thai", Slug = "chinese-thai", Description = "Authentic sizzlers, soups & noodles", DisplayOrder = 1 };
        var catBurgers = new Category { Name = "Burgers & Fast Food", Slug = "burgers-fast-food", Description = "Gourmet burgers and crispy fries", DisplayOrder = 2 };
        var catBakery = new Category { Name = "Bakery & Custom Cakes", Slug = "bakery-cakes", Description = "Fresh daily cakes and custom celebrations", DisplayOrder = 3 };
        var catDrinks = new Category { Name = "Desserts & Drinks", Slug = "desserts-drinks", Description = "Chilled mocktails and shakes", DisplayOrder = 4 };

        context.Categories.AddRange(catChineseThai, catBurgers, catBakery, catDrinks);
        await context.SaveChangesAsync();

        // 5. Seed Raw Ingredients
        var ingChicken = new Ingredient { Name = "Boneless Chicken Breast", Code = "ING-CHK", BaseUnit = UnitType.Kilogram, MinimumAlertStock = 5, CurrentAverageCostPerBaseUnit = 280m };
        var ingNoodles = new Ingredient { Name = "Egg Chow Mein Noodles", Code = "ING-NDL", BaseUnit = UnitType.Kilogram, MinimumAlertStock = 10, CurrentAverageCostPerBaseUnit = 140m };
        var ingEgg = new Ingredient { Name = "Farm Fresh Egg", Code = "ING-EGG", BaseUnit = UnitType.Piece, MinimumAlertStock = 50, CurrentAverageCostPerBaseUnit = 12m };
        var ingSoySauce = new Ingredient { Name = "Dark Soy Sauce", Code = "ING-SOY", BaseUnit = UnitType.Liter, MinimumAlertStock = 2, CurrentAverageCostPerBaseUnit = 180m };
        var ingOil = new Ingredient { Name = "Refined Cooking Oil", Code = "ING-OIL", BaseUnit = UnitType.Liter, MinimumAlertStock = 10, CurrentAverageCostPerBaseUnit = 190m };
        var ingFlour = new Ingredient { Name = "All-Purpose Flour", Code = "ING-FLR", BaseUnit = UnitType.Kilogram, MinimumAlertStock = 15, CurrentAverageCostPerBaseUnit = 65m };
        var ingSugar = new Ingredient { Name = "Refined White Sugar", Code = "ING-SGR", BaseUnit = UnitType.Kilogram, MinimumAlertStock = 10, CurrentAverageCostPerBaseUnit = 130m };
        var ingButter = new Ingredient { Name = "Unsalted Butter", Code = "ING-BTR", BaseUnit = UnitType.Kilogram, MinimumAlertStock = 5, CurrentAverageCostPerBaseUnit = 850m };
        var ingCream = new Ingredient { Name = "Heavy Whipping Cream", Code = "ING-CRM", BaseUnit = UnitType.Liter, MinimumAlertStock = 5, CurrentAverageCostPerBaseUnit = 420m };
        var ingChocolate = new Ingredient { Name = "Dark Chocolate Compound", Code = "ING-CHO", BaseUnit = UnitType.Kilogram, MinimumAlertStock = 5, CurrentAverageCostPerBaseUnit = 750m };

        context.Ingredients.AddRange(ingChicken, ingNoodles, ingEgg, ingSoySauce, ingOil, ingFlour, ingSugar, ingButter, ingCream, ingChocolate);
        await context.SaveChangesAsync();

        // 6. Seed Menu Items
        var chowMein = new MenuItem
        {
            CategoryId = catChineseThai.Id,
            Name = "Chicken Chow Mein",
            Slug = "chicken-chow-mein",
            Description = "Wok-tossed noodles with tender chicken strips, fresh veggies and special sauce",
            BasePrice = 250m,
            PreparationTimeMinutes = 15,
            IsSpicy = true
        };

        var burger = new MenuItem
        {
            CategoryId = catBurgers.Id,
            Name = "Crispy Chicken Burger",
            Slug = "crispy-chicken-burger",
            Description = "Crispy golden fried chicken breast, melted cheese, and creamy mayo",
            BasePrice = 220m,
            PreparationTimeMinutes = 12
        };

        var cake = new MenuItem
        {
            CategoryId = catBakery.Id,
            Name = "Chocolate Fudge Cake (1kg)",
            Slug = "chocolate-fudge-cake-1kg",
            Description = "Rich, moist layered chocolate cake covered in glossy chocolate ganache",
            BasePrice = 750m,
            PreparationTimeMinutes = 60,
            IsBakeryItem = true,
            AllowCustomization = true
        };

        context.MenuItems.AddRange(chowMein, burger, cake);
        await context.SaveChangesAsync();

        // 7. Seed Recipes / BOM (The Core Moat!)
        // Chicken Chow Mein Recipe
        var chowMeinRecipe = new Recipe
        {
            MenuItemId = chowMein.Id,
            RecipeName = "Standard Chicken Chow Mein",
            YieldServings = 1,
            TargetFoodCostPercent = 35m
        };
        context.Recipes.Add(chowMeinRecipe);
        await context.SaveChangesAsync();

        context.RecipeIngredients.AddRange(
            new RecipeIngredient { RecipeId = chowMeinRecipe.Id, IngredientId = ingChicken.Id, QuantityRequired = 80, UnitUsed = UnitType.Gram, WastagePreparationLossPercent = 5m },
            new RecipeIngredient { RecipeId = chowMeinRecipe.Id, IngredientId = ingNoodles.Id, QuantityRequired = 150, UnitUsed = UnitType.Gram },
            new RecipeIngredient { RecipeId = chowMeinRecipe.Id, IngredientId = ingEgg.Id, QuantityRequired = 1, UnitUsed = UnitType.Piece },
            new RecipeIngredient { RecipeId = chowMeinRecipe.Id, IngredientId = ingSoySauce.Id, QuantityRequired = 15, UnitUsed = UnitType.Milliliter },
            new RecipeIngredient { RecipeId = chowMeinRecipe.Id, IngredientId = ingOil.Id, QuantityRequired = 20, UnitUsed = UnitType.Milliliter }
        );

        // Chocolate Cake Recipe
        var cakeRecipe = new Recipe
        {
            MenuItemId = cake.Id,
            RecipeName = "Chocolate Fudge Cake 1kg Formulation",
            YieldServings = 1,
            TargetFoodCostPercent = 38m
        };
        context.Recipes.Add(cakeRecipe);
        await context.SaveChangesAsync();

        context.RecipeIngredients.AddRange(
            new RecipeIngredient { RecipeId = cakeRecipe.Id, IngredientId = ingFlour.Id, QuantityRequired = 300, UnitUsed = UnitType.Gram },
            new RecipeIngredient { RecipeId = cakeRecipe.Id, IngredientId = ingSugar.Id, QuantityRequired = 250, UnitUsed = UnitType.Gram },
            new RecipeIngredient { RecipeId = cakeRecipe.Id, IngredientId = ingEgg.Id, QuantityRequired = 6, UnitUsed = UnitType.Piece },
            new RecipeIngredient { RecipeId = cakeRecipe.Id, IngredientId = ingButter.Id, QuantityRequired = 200, UnitUsed = UnitType.Gram },
            new RecipeIngredient { RecipeId = cakeRecipe.Id, IngredientId = ingChocolate.Id, QuantityRequired = 150, UnitUsed = UnitType.Gram },
            new RecipeIngredient { RecipeId = cakeRecipe.Id, IngredientId = ingCream.Id, QuantityRequired = 200, UnitUsed = UnitType.Milliliter }
        );

        await context.SaveChangesAsync();

        // 8. Seed Branch Opening Stocks for Dhanmondi Branch
        var dhnStocks = new[]
        {
            new BranchIngredientStock { BranchId = dhanmondi.Id, IngredientId = ingChicken.Id, CurrentStockQuantity = 25.0m, MovingAverageCostPerUnit = 280m },
            new BranchIngredientStock { BranchId = dhanmondi.Id, IngredientId = ingNoodles.Id, CurrentStockQuantity = 40.0m, MovingAverageCostPerUnit = 140m },
            new BranchIngredientStock { BranchId = dhanmondi.Id, IngredientId = ingEgg.Id, CurrentStockQuantity = 200m, MovingAverageCostPerUnit = 12m },
            new BranchIngredientStock { BranchId = dhanmondi.Id, IngredientId = ingSoySauce.Id, CurrentStockQuantity = 10.0m, MovingAverageCostPerUnit = 180m },
            new BranchIngredientStock { BranchId = dhanmondi.Id, IngredientId = ingOil.Id, CurrentStockQuantity = 30.0m, MovingAverageCostPerUnit = 190m },
            new BranchIngredientStock { BranchId = dhanmondi.Id, IngredientId = ingFlour.Id, CurrentStockQuantity = 50.0m, MovingAverageCostPerUnit = 65m },
            new BranchIngredientStock { BranchId = dhanmondi.Id, IngredientId = ingSugar.Id, CurrentStockQuantity = 30.0m, MovingAverageCostPerUnit = 130m },
            new BranchIngredientStock { BranchId = dhanmondi.Id, IngredientId = ingButter.Id, CurrentStockQuantity = 15.0m, MovingAverageCostPerUnit = 850m },
            new BranchIngredientStock { BranchId = dhanmondi.Id, IngredientId = ingCream.Id, CurrentStockQuantity = 20.0m, MovingAverageCostPerUnit = 420m },
            new BranchIngredientStock { BranchId = dhanmondi.Id, IngredientId = ingChocolate.Id, CurrentStockQuantity = 15.0m, MovingAverageCostPerUnit = 750m }
        };
        context.BranchIngredientStocks.AddRange(dhnStocks);

        // 9. Seed Branch Price Override: Mirpur Branch sells Burger for ৳210 instead of ৳220
        context.BranchMenuItemOverrides.Add(new BranchMenuItemOverride
        {
            BranchId = mirpur.Id,
            MenuItemId = burger.Id,
            CustomPrice = 210m,
            IsAvailableInBranch = true
        });

        await context.SaveChangesAsync();
        await transaction.CommitAsync();
    }
}
