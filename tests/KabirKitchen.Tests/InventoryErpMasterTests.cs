using FluentAssertions;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Entities.Orders;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Production;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;
using KabirKitchen.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace KabirKitchen.Tests;

public class InventoryErpMasterTests
{
    private (KabirKitchenDbContext context,
             InventoryEngineService inventoryEngine,
             SubRecipeService subRecipeService,
             FinishedProductInventoryService productStockService,
             ProductionService productionService,
             ReservoirService reservoirService,
             LotManagementService lotService,
             UomConversionService uomService)
        SetupTestHarness()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new KabirKitchenDbContext(options);

        var branch = new Branch
        {
            Id = 1,
            Name = "Dhanmondi Central Kitchen",
            BranchCode = "DHN",
            IsActive = true
        };
        context.Branches.Add(branch);

        var branch2 = new Branch
        {
            Id = 2,
            Name = "Gulshan Branch",
            BranchCode = "GLS",
            IsActive = true
        };
        context.Branches.Add(branch2);
        context.SaveChanges();

        var lotService = new LotManagementService(context);
        var uomService = new UomConversionService(context);
        var inventoryEngine = new InventoryEngineService(context);
        var subRecipeService = new SubRecipeService(context);
        var productStockService = new FinishedProductInventoryService(context, lotService);
        var reservoirService = new ReservoirService(context, inventoryEngine);
        var productionService = new ProductionService(
            context,
            inventoryEngine,
            subRecipeService,
            productStockService,
            lotService,
            reservoirService);

        return (context, inventoryEngine, subRecipeService, productStockService, productionService, reservoirService, lotService, uomService);
    }

    [Fact]
    public async Task Scenario1_MadeToOrder_Sales_ShouldDeductRawMaterialsCorrectly()
    {
        var (context, inventoryEngine, _, _, _, _, _, _) = SetupTestHarness();

        var beef = new Ingredient
        {
            Id = 101,
            Name = "Minced Beef",
            BaseUnit = UnitType.Kilogram,
            CurrentAverageCostPerBaseUnit = 700m
        };
        context.Ingredients.Add(beef);

        var burger = new MenuItem
        {
            Id = 201,
            Name = "Classic Beef Burger",
            BasePrice = 350m,
            ProductionType = ProductionType.MadeToOrder,
            IsActive = true
        };
        context.MenuItems.Add(burger);

        var recipe = new Recipe
        {
            MenuItemId = burger.Id,
            RecipeName = "Classic Burger Recipe",
            YieldServings = 1,
            Ingredients = new List<RecipeIngredient>
            {
                new()
                {
                    IngredientId = beef.Id,
                    Ingredient = beef,
                    QuantityRequired = 150m, // 150 grams
                    UnitUsed = UnitType.Gram,
                    WastagePreparationLossPercent = 0
                }
            }
        };
        context.Recipes.Add(recipe);

        // Branch starts with 1.5 kg of beef
        context.BranchIngredientStocks.Add(new BranchIngredientStock
        {
            BranchId = 1,
            IngredientId = beef.Id,
            CurrentStockQuantity = 1.5m,
            MovingAverageCostPerUnit = 700m
        });
        await context.SaveChangesAsync();

        var order = new Order
        {
            Id = 1,
            BranchId = 1,
            OrderNumber = "ORD-001",
            Items = new List<OrderItem>
            {
                new() { MenuItemId = burger.Id, MenuItem = burger, Quantity = 2, ItemName = burger.Name }
            }
        };
        context.Orders.Add(order);
        await context.SaveChangesAsync();

        // Act
        var result = await inventoryEngine.DeductIngredientsForOrderAsync(order);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var stock = await context.BranchIngredientStocks.FirstAsync(s => s.BranchId == 1 && s.IngredientId == beef.Id);
        // 2 burgers * 150g = 300g = 0.3 kg deducted => 1.5 - 0.3 = 1.2 kg remaining
        stock.CurrentStockQuantity.Should().Be(1.2m);
    }

    [Fact]
    public async Task Scenario2_BatchProduced_Sales_ShouldDeductFinishedStockOnly_NotRawMaterials()
    {
        var (context, inventoryEngine, _, _, _, _, _, _) = SetupTestHarness();

        var rice = new Ingredient
        {
            Id = 102,
            Name = "Basmati Rice",
            BaseUnit = UnitType.Kilogram,
            CurrentAverageCostPerBaseUnit = 120m
        };
        context.Ingredients.Add(rice);

        var kacchi = new MenuItem
        {
            Id = 202,
            Name = "Mutton Kacchi Platter",
            BasePrice = 450m,
            ProductionType = ProductionType.BatchProduced, // Pre-cooked batch item
            IsActive = true
        };
        context.MenuItems.Add(kacchi);

        var recipe = new Recipe
        {
            MenuItemId = kacchi.Id,
            RecipeName = "Kacchi Recipe",
            YieldServings = 1,
            Ingredients = new List<RecipeIngredient>
            {
                new()
                {
                    IngredientId = rice.Id,
                    Ingredient = rice,
                    QuantityRequired = 250m,
                    UnitUsed = UnitType.Gram
                }
            }
        };
        context.Recipes.Add(recipe);

        // Raw rice stock in branch: 50 kg
        context.BranchIngredientStocks.Add(new BranchIngredientStock
        {
            BranchId = 1,
            IngredientId = rice.Id,
            CurrentStockQuantity = 50m
        });

        // Finished product stock: 10 platters on hand
        context.BranchProductStocks.Add(new BranchProductStock
        {
            BranchId = 1,
            MenuItemId = kacchi.Id,
            CurrentStockQuantity = 10m,
            MovingAverageCostPerUnit = 220m
        });
        await context.SaveChangesAsync();

        var order = new Order
        {
            Id = 2,
            BranchId = 1,
            OrderNumber = "ORD-002",
            Items = new List<OrderItem>
            {
                new() { MenuItemId = kacchi.Id, MenuItem = kacchi, Quantity = 3, ItemName = kacchi.Name }
            }
        };
        context.Orders.Add(order);
        await context.SaveChangesAsync();

        // Act
        var result = await inventoryEngine.DeductIngredientsForOrderAsync(order);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // 1. Finished stock was deducted by 3: 10 - 3 = 7
        var prodStock = await context.BranchProductStocks.FirstAsync(s => s.BranchId == 1 && s.MenuItemId == kacchi.Id);
        prodStock.CurrentStockQuantity.Should().Be(7m);

        // 2. Underlying raw materials were NOT deducted (no double deduction)
        var rawStock = await context.BranchIngredientStocks.FirstAsync(s => s.BranchId == 1 && s.IngredientId == rice.Id);
        rawStock.CurrentStockQuantity.Should().Be(50m);
    }

    [Fact]
    public async Task Scenario3_SubRecipe_Consumption_DoesNotDoubleDeduct_RawMaterials()
    {
        var (context, inventoryEngine, _, _, _, _, _, _) = SetupTestHarness();

        var mayo = new Ingredient { Id = 103, Name = "Mayonnaise", BaseUnit = UnitType.Kilogram, CurrentAverageCostPerBaseUnit = 200m };
        context.Ingredients.Add(mayo);

        var sauce = new SubRecipe
        {
            Id = 301,
            Name = "Signature House Sauce",
            Code = "SUB-SAUCE-01",
            BaseUnit = UnitType.Kilogram,
            StandardBatchYield = 1m
        };
        context.SubRecipes.Add(sauce);

        var burger = new MenuItem
        {
            Id = 203,
            Name = "Saucy Burger",
            BasePrice = 300m,
            ProductionType = ProductionType.MadeToOrder,
            IsActive = true
        };
        context.MenuItems.Add(burger);

        var recipe = new Recipe
        {
            MenuItemId = burger.Id,
            RecipeName = "Saucy Burger Recipe",
            YieldServings = 1,
            Ingredients = new List<RecipeIngredient>
            {
                new()
                {
                    SubRecipeId = sauce.Id,
                    SubRecipe = sauce,
                    QuantityRequired = 50m, // 50 grams of sauce
                    UnitUsed = UnitType.Gram
                }
            }
        };
        context.Recipes.Add(recipe);

        // Branch has 1.0 kg of pre-made sauce on hand
        context.BranchSubRecipeStocks.Add(new BranchSubRecipeStock
        {
            BranchId = 1,
            SubRecipeId = sauce.Id,
            CurrentStockQuantity = 1.0m,
            MovingAverageCostPerUnit = 250m
        });

        // Branch has 10 kg of raw mayonnaise
        context.BranchIngredientStocks.Add(new BranchIngredientStock
        {
            BranchId = 1,
            IngredientId = mayo.Id,
            CurrentStockQuantity = 10.0m
        });
        await context.SaveChangesAsync();

        var order = new Order
        {
            Id = 3,
            BranchId = 1,
            OrderNumber = "ORD-003",
            Items = new List<OrderItem>
            {
                new() { MenuItemId = burger.Id, MenuItem = burger, Quantity = 4, ItemName = burger.Name }
            }
        };
        context.Orders.Add(order);
        await context.SaveChangesAsync();

        // Act
        var result = await inventoryEngine.DeductIngredientsForOrderAsync(order);

        // Assert
        result.IsSuccess.Should().BeTrue();

        // Pre-made sauce reduced: 4 * 50g = 200g = 0.2 kg deducted => 1.0 - 0.2 = 0.8 kg
        var sauceStock = await context.BranchSubRecipeStocks.FirstAsync(s => s.BranchId == 1 && s.SubRecipeId == sauce.Id);
        sauceStock.CurrentStockQuantity.Should().Be(0.8m);

        // Raw mayo remains intact at 10.0 kg (not counted again)
        var mayoStock = await context.BranchIngredientStocks.FirstAsync(s => s.BranchId == 1 && s.IngredientId == mayo.Id);
        mayoStock.CurrentStockQuantity.Should().Be(10.0m);
    }

    [Fact]
    public async Task Scenario4_SubRecipe_Production_IncreasesItsOwnInventoryCorrectly()
    {
        var (context, _, subRecipeService, _, productionService, _, _, _) = SetupTestHarness();

        var chili = new Ingredient { Id = 104, Name = "Red Chili", BaseUnit = UnitType.Kilogram, CurrentAverageCostPerBaseUnit = 100m };
        context.Ingredients.Add(chili);

        var spicySauce = new SubRecipe
        {
            Id = 302,
            Name = "Spicy Dip",
            Code = "SUB-DIP-01",
            BaseUnit = UnitType.Kilogram,
            StandardBatchYield = 5m
        };
        context.SubRecipes.Add(spicySauce);

        context.BranchIngredientStocks.Add(new BranchIngredientStock
        {
            BranchId = 1,
            IngredientId = chili.Id,
            CurrentStockQuantity = 10m,
            MovingAverageCostPerUnit = 100m
        });
        await context.SaveChangesAsync();

        // Create batch for 5 kg
        var batchResult = await productionService.CreateProductionBatchAsync(new CreateProductionBatchRequestDto(
            BranchId: 1,
            TargetType: ProductionTargetType.SubRecipe,
            SubRecipeId: spicySauce.Id,
            MenuItemId: null,
            MenuItemVariantId: null,
            PlannedQuantity: 5m,
            ScheduledStartUtc: DateTime.UtcNow,
            ProductionNotes: "Daily dip prep"
        ), userId: 1);

        batchResult.IsSuccess.Should().BeTrue();
        var batchId = batchResult.Value.Id;

        await productionService.StartProductionBatchAsync(batchId);
        await productionService.CompleteProductionBatchAsync(batchId, new CompleteProductionBatchRequestDto(
            ActualProducedQuantity: 5m,
            RejectedQuantity: 0m,
            RejectionReason: null,
            ExpiryDateUtc: DateTime.UtcNow.AddDays(7)
        ), userId: 1);

        // Act: Post batch to inventory
        var postResult = await productionService.PostProductionBatchAsync(batchId, idempotencyKey: null, userId: 1);

        // Assert
        postResult.IsSuccess.Should().BeTrue();
        var subStock = await context.BranchSubRecipeStocks.FirstAsync(s => s.BranchId == 1 && s.SubRecipeId == spicySauce.Id);
        subStock.CurrentStockQuantity.Should().Be(5m);
    }

    [Fact]
    public async Task Scenario5_And_6_FinishedProduction_IncreasesAcceptedStockOnly_RejectsDoNotEnterStock()
    {
        var (context, _, _, _, productionService, _, _, _) = SetupTestHarness();

        var pastry = new MenuItem
        {
            Id = 204,
            Name = "Chocolate Eclair",
            BasePrice = 120m,
            ProductionType = ProductionType.BatchProduced,
            IsActive = true
        };
        context.MenuItems.Add(pastry);
        await context.SaveChangesAsync();

        var batchResult = await productionService.CreateProductionBatchAsync(new CreateProductionBatchRequestDto(
            BranchId: 1,
            TargetType: ProductionTargetType.FinishedProduct,
            SubRecipeId: null,
            MenuItemId: pastry.Id,
            MenuItemVariantId: null,
            PlannedQuantity: 20m,
            ScheduledStartUtc: DateTime.UtcNow,
            ProductionNotes: "Morning bake"
        ), userId: 1);

        var batchId = batchResult.Value.Id;
        await productionService.StartProductionBatchAsync(batchId);

        // Complete: 20 produced, 4 burnt/rejected => 16 accepted
        await productionService.CompleteProductionBatchAsync(batchId, new CompleteProductionBatchRequestDto(
            ActualProducedQuantity: 20m,
            RejectedQuantity: 4m,
            RejectionReason: "Burnt in tray 2"
        ), userId: 1);

        // Act: Post
        var postResult = await productionService.PostProductionBatchAsync(batchId, idempotencyKey: null, userId: 1);

        // Assert
        postResult.IsSuccess.Should().BeTrue();
        var stock = await context.BranchProductStocks.FirstAsync(s => s.BranchId == 1 && s.MenuItemId == pastry.Id);

        // Only accepted quantity (16) enters stock. Burnt 4 do NOT enter stock!
        stock.CurrentStockQuantity.Should().Be(16m);
    }

    [Fact]
    public async Task Scenario7_8_9_FEFO_AllocatesEarliestExpiringLot_ExcludesExpiredAndQuarantined()
    {
        var (context, _, _, _, _, _, lotService, _) = SetupTestHarness();

        var flour = new Ingredient { Id = 105, Name = "Baker Flour", BaseUnit = UnitType.Kilogram, CurrentAverageCostPerBaseUnit = 60m };
        context.Ingredients.Add(flour);

        var now = DateTime.UtcNow;

        // Lot A: Expired yesterday (should be bypassed)
        context.InventoryLots.Add(new InventoryLot
        {
            LotNumber = "LOT-EXPIRED",
            BranchId = 1,
            LotType = InventoryLotType.RawMaterial,
            IngredientId = flour.Id,
            InitialQuantity = 10m,
            RemainingQuantity = 10m,
            UnitCost = 50m,
            ExpiryDateUtc = now.AddDays(-1),
            HasExpiry = true,
            Status = InventoryLotStatus.Active
        });

        // Lot B: Quarantined (should be bypassed)
        context.InventoryLots.Add(new InventoryLot
        {
            LotNumber = "LOT-QUARANTINED",
            BranchId = 1,
            LotType = InventoryLotType.RawMaterial,
            IngredientId = flour.Id,
            InitialQuantity = 10m,
            RemainingQuantity = 10m,
            UnitCost = 55m,
            ExpiryDateUtc = now.AddDays(5),
            HasExpiry = true,
            Status = InventoryLotStatus.Quarantined
        });

        // Lot C: Expires in 3 days (Earliest valid => FEFO should pick this first)
        var lotC = new InventoryLot
        {
            LotNumber = "LOT-SOONEST",
            BranchId = 1,
            LotType = InventoryLotType.RawMaterial,
            IngredientId = flour.Id,
            InitialQuantity = 5m,
            RemainingQuantity = 5m,
            UnitCost = 60m,
            ExpiryDateUtc = now.AddDays(3),
            HasExpiry = true,
            Status = InventoryLotStatus.Active
        };
        context.InventoryLots.Add(lotC);

        // Lot D: Expires in 10 days
        var lotD = new InventoryLot
        {
            LotNumber = "LOT-LATER",
            BranchId = 1,
            LotType = InventoryLotType.RawMaterial,
            IngredientId = flour.Id,
            InitialQuantity = 10m,
            RemainingQuantity = 10m,
            UnitCost = 62m,
            ExpiryDateUtc = now.AddDays(10),
            HasExpiry = true,
            Status = InventoryLotStatus.Active
        };
        context.InventoryLots.Add(lotD);
        await context.SaveChangesAsync();

        // Act: Allocate 7 kg
        var allocResult = await lotService.AllocateRawMaterialFefoAsync(branchId: 1, ingredientId: flour.Id, requiredQuantityInBaseUnit: 7m, stockTransactionId: 999);

        // Assert
        allocResult.IsSuccess.Should().BeTrue();
        var allocs = allocResult.Value;

        // Must take 5 kg from Lot C first (expires sooner)
        allocs.First().InventoryLotId.Should().Be(lotC.Id);
        Math.Abs(allocs.First().AllocatedQuantity).Should().Be(5m);

        // Remaining 2 kg taken from Lot D
        allocs.Last().InventoryLotId.Should().Be(lotD.Id);
        Math.Abs(allocs.Last().AllocatedQuantity).Should().Be(2m);

        // Depleted Lot C marked Depleted
        lotC.RemainingQuantity.Should().Be(0);
        lotC.Status.Should().Be(InventoryLotStatus.Depleted);

        // Lot D remaining is 8
        lotD.RemainingQuantity.Should().Be(8m);
    }

    [Fact]
    public async Task Scenario11_DuplicateProductionPosting_IsPreventedByIdempotency()
    {
        var (context, _, _, _, productionService, _, _, _) = SetupTestHarness();

        var item = new MenuItem { Id = 205, Name = "Batch Burger", BasePrice = 200m, ProductionType = ProductionType.BatchProduced, IsActive = true };
        context.MenuItems.Add(item);
        await context.SaveChangesAsync();

        var batchResult = await productionService.CreateProductionBatchAsync(new CreateProductionBatchRequestDto(
            BranchId: 1,
            TargetType: ProductionTargetType.FinishedProduct,
            SubRecipeId: null,
            MenuItemId: item.Id,
            MenuItemVariantId: null,
            PlannedQuantity: 10m,
            ScheduledStartUtc: DateTime.UtcNow,
            ProductionNotes: "Test idempotency"
        ), userId: 1);

        var batchId = batchResult.Value.Id;
        await productionService.StartProductionBatchAsync(batchId);
        await productionService.CompleteProductionBatchAsync(batchId, new CompleteProductionBatchRequestDto(
            ActualProducedQuantity: 10m,
            RejectedQuantity: 0m,
            RejectionReason: null
        ), userId: 1);

        // First Post
        var post1 = await productionService.PostProductionBatchAsync(batchId, idempotencyKey: "IDEM-KEY-001", userId: 1);
        post1.IsSuccess.Should().BeTrue();

        var stockAfterFirst = (await context.BranchProductStocks.FirstAsync(s => s.BranchId == 1 && s.MenuItemId == item.Id)).CurrentStockQuantity;
        stockAfterFirst.Should().Be(10m);

        // Retry / Duplicate Post with same idempotency key
        var post2 = await productionService.PostProductionBatchAsync(batchId, idempotencyKey: "IDEM-KEY-001", userId: 1);
        post2.IsSuccess.Should().BeTrue();

        // Stock MUST NOT increase a second time!
        var stockAfterSecond = (await context.BranchProductStocks.FirstAsync(s => s.BranchId == 1 && s.MenuItemId == item.Id)).CurrentStockQuantity;
        stockAfterSecond.Should().Be(10m);
    }

    [Fact]
    public void Scenario16_And_17_UOM_Conversions_AreAccurate_And_CrossDimensionIsRejected()
    {
        // 1. Same dimension metric
        UomConversionService.ConvertSameDimension(500m, UnitType.Gram, UnitType.Kilogram).Should().Be(0.5m);
        UomConversionService.ConvertSameDimension(2.5m, UnitType.Liter, UnitType.Milliliter).Should().Be(2500m);

        // 2. Cross dimension without density conversion MUST throw
        Action invalidAction = () => UomConversionService.ConvertSameDimension(100m, UnitType.Gram, UnitType.Liter);
        invalidAction.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot implicitly convert between Gram and Liter: different dimensions*");
    }

    [Fact]
    public async Task Scenario18_And_19_Reservoir_MixedLotCosting_And_SourceTraceability()
    {
        var (context, _, _, _, _, reservoirService, _, _) = SetupTestHarness();

        var oil = new Ingredient { Id = 106, Name = "Soybean Oil", BaseUnit = UnitType.Liter, CurrentAverageCostPerBaseUnit = 160m };
        context.Ingredients.Add(oil);

        // Branch starts with oil stock
        context.BranchIngredientStocks.Add(new BranchIngredientStock
        {
            BranchId = 1,
            IngredientId = oil.Id,
            CurrentStockQuantity = 50m
        });

        // Lot 1: 20 Liters at 150 BDT/L
        var lot1 = new InventoryLot
        {
            LotNumber = "LOT-OIL-01",
            BranchId = 1,
            LotType = InventoryLotType.RawMaterial,
            IngredientId = oil.Id,
            InitialQuantity = 20m,
            RemainingQuantity = 20m,
            UnitCost = 150m,
            HasExpiry = false,
            Status = InventoryLotStatus.Active
        };
        context.InventoryLots.Add(lot1);

        // Lot 2: 10 Liters at 180 BDT/L
        var lot2 = new InventoryLot
        {
            LotNumber = "LOT-OIL-02",
            BranchId = 1,
            LotType = InventoryLotType.RawMaterial,
            IngredientId = oil.Id,
            InitialQuantity = 10m,
            RemainingQuantity = 10m,
            UnitCost = 180m,
            HasExpiry = false,
            Status = InventoryLotStatus.Active
        };
        context.InventoryLots.Add(lot2);
        await context.SaveChangesAsync();

        // Create Fryer Reservoir with 30L capacity
        var resResult = await reservoirService.CreateReservoirAsync(
            branchId: 1,
            equipmentName: "Henny Penny Fryer #1",
            equipmentCode: "FRY-01",
            ingredientId: oil.Id,
            maxCapacity: 30m
        );
        var resId = resResult.Value.Id;

        // Transfer 20L from Lot 1 (cost 150)
        await reservoirService.TransferInFromStorageAsync(resId, 20m, lot1.Id, "Initial fill", userId: 1);

        // Transfer 10L from Lot 2 (cost 180) -> reservoir is now mixed!
        await reservoirService.TransferInFromStorageAsync(resId, 10m, lot2.Id, "Topped up", userId: 1);

        var reservoir = await context.EquipmentReservoirs.FirstAsync(r => r.Id == resId);
        reservoir.CurrentFluidQuantity.Should().Be(30m);

        // Weighted Average Cost = (20 * 150 + 10 * 180) / 30 = (3000 + 1800) / 30 = 4800 / 30 = 160 BDT/L
        reservoir.CurrentUnitCost.Should().Be(160m);

        // Source lot remaining quantities decreased
        lot1.RemainingQuantity.Should().Be(0);
        lot2.RemainingQuantity.Should().Be(0);

        // Traceability: transactions preserve SourceInventoryLotId
        var txns = await context.EquipmentReservoirTransactions.Where(t => t.EquipmentReservoirId == resId).ToListAsync();
        txns.Any(t => t.SourceInventoryLotId == lot1.Id).Should().BeTrue();
        txns.Any(t => t.SourceInventoryLotId == lot2.Id).Should().BeTrue();
    }

    [Fact]
    public async Task Scenario21_ZeroAcceptedQuantity_DoesNotProduceInvalidUnitCost_RecordsSpoilageLoss()
    {
        var (context, _, _, _, productionService, _, _, _) = SetupTestHarness();

        var item = new MenuItem { Id = 206, Name = "Batch Cake", BasePrice = 500m, ProductionType = ProductionType.BatchProduced, IsActive = true };
        context.MenuItems.Add(item);
        await context.SaveChangesAsync();

        var batchResult = await productionService.CreateProductionBatchAsync(new CreateProductionBatchRequestDto(
            BranchId: 1,
            TargetType: ProductionTargetType.FinishedProduct,
            SubRecipeId: null,
            MenuItemId: item.Id,
            MenuItemVariantId: null,
            PlannedQuantity: 5m,
            ScheduledStartUtc: DateTime.UtcNow,
            ProductionNotes: "Failed test batch"
        ), userId: 1);

        var batchId = batchResult.Value.Id;
        await productionService.StartProductionBatchAsync(batchId);

        // Complete: 5 produced, ALL 5 rejected (0 accepted)
        await productionService.CompleteProductionBatchAsync(batchId, new CompleteProductionBatchRequestDto(
            ActualProducedQuantity: 5m,
            RejectedQuantity: 5m,
            RejectionReason: "Oven overheated, total loss",
            DirectLaborCost: 200m
        ), userId: 1);

        var batch = await context.ProductionBatches
            .Include(b => b.CostSnapshot)
            .FirstAsync(b => b.Id == batchId);

        batch.AcceptedQuantity.Should().Be(0);

        // Unit cost must be null (no division by zero / fabricated unit cost)
        batch.CostSnapshot.Should().NotBeNull();
        batch.CostSnapshot!.FullProductionUnitCost.Should().BeNull();
        batch.CostSnapshot.IngredientOnlyUnitCost.Should().BeNull();

        // Total batch cost recorded as Spoilage Loss
        batch.CostSnapshot.TotalBatchSpoilageLoss.Should().Be(200m);
    }
}

