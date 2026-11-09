using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KabirKitchen.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryErpLayer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "SubRecipeId",
                table: "RecipeIngredients",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProductionType",
                table: "MenuItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "QuarantinedQuantity",
                table: "BranchIngredientStocks",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "BranchIngredientStocks",
                type: "rowversion",
                rowVersion: true,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BranchProductStocks",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<long>(type: "bigint", nullable: false),
                    MenuItemId = table.Column<long>(type: "bigint", nullable: false),
                    MenuItemVariantId = table.Column<long>(type: "bigint", nullable: true),
                    CurrentStockQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ReservedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    QuarantinedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MinimumAlertStock = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MovingAverageCostPerUnit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchProductStocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BranchProductStocks_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BranchProductStocks_MenuItems_MenuItemId",
                        column: x => x.MenuItemId,
                        principalTable: "MenuItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EquipmentReservoirs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<long>(type: "bigint", nullable: false),
                    EquipmentName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EquipmentCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IngredientId = table.Column<long>(type: "bigint", nullable: false),
                    CurrentFluidQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CurrentUnitCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MaxCapacity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LastCleanedOrReplacedUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EquipmentReservoirs", x => x.Id);
                    table.CheckConstraint("CK_EquipmentReservoir_Capacity", "[CurrentFluidQuantity] >= 0 AND [CurrentFluidQuantity] <= [MaxCapacity]");
                    table.ForeignKey(
                        name: "FK_EquipmentReservoirs_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EquipmentReservoirs_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IngredientUomConversions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IngredientId = table.Column<long>(type: "bigint", nullable: false),
                    FromUnit = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ToBaseUnit = table.Column<int>(type: "int", nullable: false),
                    Multiplier = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsDefaultPurchaseUnit = table.Column<bool>(type: "bit", nullable: false),
                    PackageDescription = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientUomConversions", x => x.Id);
                    table.CheckConstraint("CK_UomConversion_PositiveMultiplier", "[Multiplier] > 0");
                    table.ForeignKey(
                        name: "FK_IngredientUomConversions_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SubRecipes",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    BaseUnit = table.Column<int>(type: "int", nullable: false),
                    StandardBatchYield = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    StorageCondition = table.Column<int>(type: "int", nullable: false),
                    ShelfLifeHours = table.Column<int>(type: "int", nullable: true),
                    ShelfLifeDays = table.Column<int>(type: "int", nullable: true),
                    HasExpiry = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubRecipes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProductStockTransactions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<long>(type: "bigint", nullable: false),
                    MenuItemId = table.Column<long>(type: "bigint", nullable: false),
                    MenuItemVariantId = table.Column<long>(type: "bigint", nullable: true),
                    BranchProductStockId = table.Column<long>(type: "bigint", nullable: true),
                    TransactionType = table.Column<int>(type: "int", nullable: false),
                    QuantityChange = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    QuantityBefore = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    QuantityAfter = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitUsed = table.Column<int>(type: "int", nullable: false),
                    UnitCostAtTransaction = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ProductionBatchId = table.Column<long>(type: "bigint", nullable: true),
                    OrderId = table.Column<long>(type: "bigint", nullable: true),
                    ReversalOfTransactionId = table.Column<long>(type: "bigint", nullable: true),
                    ReferenceDocumentType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReferenceDocumentNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PerformedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    TransactionDateUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductStockTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductStockTransactions_BranchProductStocks_BranchProductStockId",
                        column: x => x.BranchProductStockId,
                        principalTable: "BranchProductStocks",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ProductStockTransactions_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductStockTransactions_MenuItems_MenuItemId",
                        column: x => x.MenuItemId,
                        principalTable: "MenuItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BranchSubRecipeStocks",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<long>(type: "bigint", nullable: false),
                    SubRecipeId = table.Column<long>(type: "bigint", nullable: false),
                    CurrentStockQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ReservedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    QuarantinedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MinimumAlertStock = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MovingAverageCostPerUnit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchSubRecipeStocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BranchSubRecipeStocks_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BranchSubRecipeStocks_SubRecipes_SubRecipeId",
                        column: x => x.SubRecipeId,
                        principalTable: "SubRecipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InventoryLots",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LotNumber = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    BranchId = table.Column<long>(type: "bigint", nullable: false),
                    LotType = table.Column<int>(type: "int", nullable: false),
                    IngredientId = table.Column<long>(type: "bigint", nullable: true),
                    SubRecipeId = table.Column<long>(type: "bigint", nullable: true),
                    MenuItemId = table.Column<long>(type: "bigint", nullable: true),
                    InitialQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RemainingQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ManufacturedOrReceivedDateUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiryDateUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    HasExpiry = table.Column<bool>(type: "bit", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    StorageLocation = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SourceReference = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryLots", x => x.Id);
                    table.CheckConstraint("CK_InventoryLot_Balances", "[RemainingQuantity] >= 0");
                    table.CheckConstraint("CK_InventoryLot_TypeIntegrity", "([LotType] = 1 AND [IngredientId] IS NOT NULL AND [SubRecipeId] IS NULL AND [MenuItemId] IS NULL) OR ([LotType] = 2 AND [IngredientId] IS NULL AND [SubRecipeId] IS NOT NULL AND [MenuItemId] IS NULL) OR ([LotType] = 3 AND [IngredientId] IS NULL AND [SubRecipeId] IS NULL AND [MenuItemId] IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_InventoryLots_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InventoryLots_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InventoryLots_MenuItems_MenuItemId",
                        column: x => x.MenuItemId,
                        principalTable: "MenuItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InventoryLots_SubRecipes_SubRecipeId",
                        column: x => x.SubRecipeId,
                        principalTable: "SubRecipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductionBatches",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchNumber = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    BranchId = table.Column<long>(type: "bigint", nullable: false),
                    TargetType = table.Column<int>(type: "int", nullable: false),
                    SubRecipeId = table.Column<long>(type: "bigint", nullable: true),
                    MenuItemId = table.Column<long>(type: "bigint", nullable: true),
                    MenuItemVariantId = table.Column<long>(type: "bigint", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    PlannedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ActualProducedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RejectedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    AcceptedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ScheduledStartUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PostedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedByUserId = table.Column<long>(type: "bigint", nullable: false),
                    ApprovedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    ProductionNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IdempotencyKey = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    IsPosted = table.Column<bool>(type: "bit", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionBatches", x => x.Id);
                    table.CheckConstraint("CK_ProductionBatch_Target", "([TargetType] = 1 AND [SubRecipeId] IS NOT NULL AND [MenuItemId] IS NULL) OR ([TargetType] = 2 AND [SubRecipeId] IS NULL AND [MenuItemId] IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_ProductionBatches_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionBatches_MenuItems_MenuItemId",
                        column: x => x.MenuItemId,
                        principalTable: "MenuItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductionBatches_SubRecipes_SubRecipeId",
                        column: x => x.SubRecipeId,
                        principalTable: "SubRecipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SubRecipeIngredients",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SubRecipeId = table.Column<long>(type: "bigint", nullable: false),
                    IngredientId = table.Column<long>(type: "bigint", nullable: true),
                    ChildSubRecipeId = table.Column<long>(type: "bigint", nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Unit = table.Column<int>(type: "int", nullable: false),
                    QuantityInBaseUnit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubRecipeIngredients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubRecipeIngredients_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SubRecipeIngredients_SubRecipes_ChildSubRecipeId",
                        column: x => x.ChildSubRecipeId,
                        principalTable: "SubRecipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SubRecipeIngredients_SubRecipes_SubRecipeId",
                        column: x => x.SubRecipeId,
                        principalTable: "SubRecipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SubRecipeStockTransactions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<long>(type: "bigint", nullable: false),
                    SubRecipeId = table.Column<long>(type: "bigint", nullable: false),
                    BranchSubRecipeStockId = table.Column<long>(type: "bigint", nullable: true),
                    TransactionType = table.Column<int>(type: "int", nullable: false),
                    QuantityChange = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    QuantityBefore = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    QuantityAfter = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitUsed = table.Column<int>(type: "int", nullable: false),
                    UnitCostAtTransaction = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ProductionBatchId = table.Column<long>(type: "bigint", nullable: true),
                    ParentOrderId = table.Column<long>(type: "bigint", nullable: true),
                    ReversalOfTransactionId = table.Column<long>(type: "bigint", nullable: true),
                    ReferenceDocumentType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReferenceDocumentNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PerformedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    TransactionDateUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubRecipeStockTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubRecipeStockTransactions_BranchSubRecipeStocks_BranchSubRecipeStockId",
                        column: x => x.BranchSubRecipeStockId,
                        principalTable: "BranchSubRecipeStocks",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_SubRecipeStockTransactions_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SubRecipeStockTransactions_SubRecipes_SubRecipeId",
                        column: x => x.SubRecipeId,
                        principalTable: "SubRecipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EquipmentReservoirTransactions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EquipmentReservoirId = table.Column<long>(type: "bigint", nullable: false),
                    TransactionType = table.Column<int>(type: "int", nullable: false),
                    QuantityChange = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    QuantityBefore = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    QuantityAfter = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitCostAtTransaction = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    WeightedAverageCostAfter = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ProductionBatchId = table.Column<long>(type: "bigint", nullable: true),
                    StockTransactionId = table.Column<long>(type: "bigint", nullable: true),
                    SourceInventoryLotId = table.Column<long>(type: "bigint", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PerformedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    TransactionDateUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EquipmentReservoirTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EquipmentReservoirTransactions_EquipmentReservoirs_EquipmentReservoirId",
                        column: x => x.EquipmentReservoirId,
                        principalTable: "EquipmentReservoirs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EquipmentReservoirTransactions_InventoryLots_SourceInventoryLotId",
                        column: x => x.SourceInventoryLotId,
                        principalTable: "InventoryLots",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "IngredientLotAllocations",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InventoryLotId = table.Column<long>(type: "bigint", nullable: false),
                    StockTransactionId = table.Column<long>(type: "bigint", nullable: false),
                    AllocatedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LotRemainingQuantityBefore = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LotRemainingQuantityAfter = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitCostSnapshot = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OriginalAllocationId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngredientLotAllocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IngredientLotAllocations_IngredientLotAllocations_OriginalAllocationId",
                        column: x => x.OriginalAllocationId,
                        principalTable: "IngredientLotAllocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_IngredientLotAllocations_InventoryLots_InventoryLotId",
                        column: x => x.InventoryLotId,
                        principalTable: "InventoryLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_IngredientLotAllocations_StockTransactions_StockTransactionId",
                        column: x => x.StockTransactionId,
                        principalTable: "StockTransactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductLotAllocations",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InventoryLotId = table.Column<long>(type: "bigint", nullable: false),
                    ProductStockTransactionId = table.Column<long>(type: "bigint", nullable: false),
                    AllocatedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LotRemainingQuantityBefore = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LotRemainingQuantityAfter = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitCostSnapshot = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OriginalAllocationId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductLotAllocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductLotAllocations_InventoryLots_InventoryLotId",
                        column: x => x.InventoryLotId,
                        principalTable: "InventoryLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductLotAllocations_ProductLotAllocations_OriginalAllocationId",
                        column: x => x.OriginalAllocationId,
                        principalTable: "ProductLotAllocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductLotAllocations_ProductStockTransactions_ProductStockTransactionId",
                        column: x => x.ProductStockTransactionId,
                        principalTable: "ProductStockTransactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductionBatchCostSnapshots",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductionBatchId = table.Column<long>(type: "bigint", nullable: false),
                    RawMaterialsCostTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SubRecipesCostTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ReusableMaterialsCostTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DirectLaborCostTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UtilityCostTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PackagingCostTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OtherOverheadCostTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PlannedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ActualProducedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RejectedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    AcceptedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IngredientOnlyTotalCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IngredientOnlyUnitCost = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    FullProductionTotalCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    FullProductionUnitCost = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    TotalBatchSpoilageLoss = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsImmutable = table.Column<bool>(type: "bit", nullable: false),
                    CorrectionOfSnapshotId = table.Column<long>(type: "bigint", nullable: true),
                    SnapshotTimestampUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionBatchCostSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductionBatchCostSnapshots_ProductionBatchCostSnapshots_CorrectionOfSnapshotId",
                        column: x => x.CorrectionOfSnapshotId,
                        principalTable: "ProductionBatchCostSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductionBatchCostSnapshots_ProductionBatches_ProductionBatchId",
                        column: x => x.ProductionBatchId,
                        principalTable: "ProductionBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProductionBatchIngredients",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductionBatchId = table.Column<long>(type: "bigint", nullable: false),
                    IngredientId = table.Column<long>(type: "bigint", nullable: false),
                    PlannedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ActualQuantityConsumed = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitUsed = table.Column<int>(type: "int", nullable: false),
                    QuantityInBaseUnit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitCostSnapshot = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionBatchIngredients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductionBatchIngredients_Ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "Ingredients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductionBatchIngredients_ProductionBatches_ProductionBatchId",
                        column: x => x.ProductionBatchId,
                        principalTable: "ProductionBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProductionBatchSubRecipes",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductionBatchId = table.Column<long>(type: "bigint", nullable: false),
                    SubRecipeId = table.Column<long>(type: "bigint", nullable: false),
                    PlannedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ActualQuantityConsumed = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitUsed = table.Column<int>(type: "int", nullable: false),
                    UnitCostSnapshot = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductionBatchSubRecipes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductionBatchSubRecipes_ProductionBatches_ProductionBatchId",
                        column: x => x.ProductionBatchId,
                        principalTable: "ProductionBatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductionBatchSubRecipes_SubRecipes_SubRecipeId",
                        column: x => x.SubRecipeId,
                        principalTable: "SubRecipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SubRecipeLotAllocations",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InventoryLotId = table.Column<long>(type: "bigint", nullable: false),
                    SubRecipeStockTransactionId = table.Column<long>(type: "bigint", nullable: false),
                    AllocatedQuantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LotRemainingQuantityBefore = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LotRemainingQuantityAfter = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitCostSnapshot = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OriginalAllocationId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubRecipeLotAllocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubRecipeLotAllocations_InventoryLots_InventoryLotId",
                        column: x => x.InventoryLotId,
                        principalTable: "InventoryLots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SubRecipeLotAllocations_SubRecipeLotAllocations_OriginalAllocationId",
                        column: x => x.OriginalAllocationId,
                        principalTable: "SubRecipeLotAllocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SubRecipeLotAllocations_SubRecipeStockTransactions_SubRecipeStockTransactionId",
                        column: x => x.SubRecipeStockTransactionId,
                        principalTable: "SubRecipeStockTransactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RecipeIngredients_SubRecipeId",
                table: "RecipeIngredients",
                column: "SubRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_BranchProductStocks_BranchId_MenuItemId_MenuItemVariantId",
                table: "BranchProductStocks",
                columns: new[] { "BranchId", "MenuItemId", "MenuItemVariantId" },
                unique: true,
                filter: "[MenuItemVariantId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_BranchProductStocks_MenuItemId",
                table: "BranchProductStocks",
                column: "MenuItemId");

            migrationBuilder.CreateIndex(
                name: "IX_BranchSubRecipeStocks_BranchId_SubRecipeId",
                table: "BranchSubRecipeStocks",
                columns: new[] { "BranchId", "SubRecipeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BranchSubRecipeStocks_SubRecipeId",
                table: "BranchSubRecipeStocks",
                column: "SubRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentReservoirs_BranchId",
                table: "EquipmentReservoirs",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentReservoirs_IngredientId",
                table: "EquipmentReservoirs",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentReservoirTransactions_EquipmentReservoirId",
                table: "EquipmentReservoirTransactions",
                column: "EquipmentReservoirId");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentReservoirTransactions_SourceInventoryLotId",
                table: "EquipmentReservoirTransactions",
                column: "SourceInventoryLotId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientLotAllocations_InventoryLotId",
                table: "IngredientLotAllocations",
                column: "InventoryLotId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientLotAllocations_OriginalAllocationId",
                table: "IngredientLotAllocations",
                column: "OriginalAllocationId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientLotAllocations_StockTransactionId",
                table: "IngredientLotAllocations",
                column: "StockTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_IngredientUomConversions_IngredientId_FromUnit_ToBaseUnit",
                table: "IngredientUomConversions",
                columns: new[] { "IngredientId", "FromUnit", "ToBaseUnit" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryLots_BranchId",
                table: "InventoryLots",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryLots_IngredientId",
                table: "InventoryLots",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryLots_MenuItemId",
                table: "InventoryLots",
                column: "MenuItemId");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryLots_SubRecipeId",
                table: "InventoryLots",
                column: "SubRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBatchCostSnapshots_CorrectionOfSnapshotId",
                table: "ProductionBatchCostSnapshots",
                column: "CorrectionOfSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBatchCostSnapshots_ProductionBatchId",
                table: "ProductionBatchCostSnapshots",
                column: "ProductionBatchId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBatches_BatchNumber",
                table: "ProductionBatches",
                column: "BatchNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBatches_BranchId",
                table: "ProductionBatches",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBatches_IdempotencyKey",
                table: "ProductionBatches",
                column: "IdempotencyKey",
                unique: true,
                filter: "[IdempotencyKey] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBatches_MenuItemId",
                table: "ProductionBatches",
                column: "MenuItemId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBatches_SubRecipeId",
                table: "ProductionBatches",
                column: "SubRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBatchIngredients_IngredientId",
                table: "ProductionBatchIngredients",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBatchIngredients_ProductionBatchId",
                table: "ProductionBatchIngredients",
                column: "ProductionBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBatchSubRecipes_ProductionBatchId",
                table: "ProductionBatchSubRecipes",
                column: "ProductionBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductionBatchSubRecipes_SubRecipeId",
                table: "ProductionBatchSubRecipes",
                column: "SubRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductLotAllocations_InventoryLotId",
                table: "ProductLotAllocations",
                column: "InventoryLotId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductLotAllocations_OriginalAllocationId",
                table: "ProductLotAllocations",
                column: "OriginalAllocationId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductLotAllocations_ProductStockTransactionId",
                table: "ProductLotAllocations",
                column: "ProductStockTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductStockTransactions_BranchId",
                table: "ProductStockTransactions",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductStockTransactions_BranchProductStockId",
                table: "ProductStockTransactions",
                column: "BranchProductStockId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductStockTransactions_MenuItemId",
                table: "ProductStockTransactions",
                column: "MenuItemId");

            migrationBuilder.CreateIndex(
                name: "IX_SubRecipeIngredients_ChildSubRecipeId",
                table: "SubRecipeIngredients",
                column: "ChildSubRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_SubRecipeIngredients_IngredientId",
                table: "SubRecipeIngredients",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_SubRecipeIngredients_SubRecipeId",
                table: "SubRecipeIngredients",
                column: "SubRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_SubRecipeLotAllocations_InventoryLotId",
                table: "SubRecipeLotAllocations",
                column: "InventoryLotId");

            migrationBuilder.CreateIndex(
                name: "IX_SubRecipeLotAllocations_OriginalAllocationId",
                table: "SubRecipeLotAllocations",
                column: "OriginalAllocationId");

            migrationBuilder.CreateIndex(
                name: "IX_SubRecipeLotAllocations_SubRecipeStockTransactionId",
                table: "SubRecipeLotAllocations",
                column: "SubRecipeStockTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_SubRecipes_Code",
                table: "SubRecipes",
                column: "Code",
                unique: true,
                filter: "[IsDeleted] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_SubRecipeStockTransactions_BranchId",
                table: "SubRecipeStockTransactions",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_SubRecipeStockTransactions_BranchSubRecipeStockId",
                table: "SubRecipeStockTransactions",
                column: "BranchSubRecipeStockId");

            migrationBuilder.CreateIndex(
                name: "IX_SubRecipeStockTransactions_SubRecipeId",
                table: "SubRecipeStockTransactions",
                column: "SubRecipeId");

            migrationBuilder.AddForeignKey(
                name: "FK_RecipeIngredients_SubRecipes_SubRecipeId",
                table: "RecipeIngredients",
                column: "SubRecipeId",
                principalTable: "SubRecipes",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RecipeIngredients_SubRecipes_SubRecipeId",
                table: "RecipeIngredients");

            migrationBuilder.DropTable(
                name: "EquipmentReservoirTransactions");

            migrationBuilder.DropTable(
                name: "IngredientLotAllocations");

            migrationBuilder.DropTable(
                name: "IngredientUomConversions");

            migrationBuilder.DropTable(
                name: "ProductionBatchCostSnapshots");

            migrationBuilder.DropTable(
                name: "ProductionBatchIngredients");

            migrationBuilder.DropTable(
                name: "ProductionBatchSubRecipes");

            migrationBuilder.DropTable(
                name: "ProductLotAllocations");

            migrationBuilder.DropTable(
                name: "SubRecipeIngredients");

            migrationBuilder.DropTable(
                name: "SubRecipeLotAllocations");

            migrationBuilder.DropTable(
                name: "EquipmentReservoirs");

            migrationBuilder.DropTable(
                name: "ProductionBatches");

            migrationBuilder.DropTable(
                name: "ProductStockTransactions");

            migrationBuilder.DropTable(
                name: "InventoryLots");

            migrationBuilder.DropTable(
                name: "SubRecipeStockTransactions");

            migrationBuilder.DropTable(
                name: "BranchProductStocks");

            migrationBuilder.DropTable(
                name: "BranchSubRecipeStocks");

            migrationBuilder.DropTable(
                name: "SubRecipes");

            migrationBuilder.DropIndex(
                name: "IX_RecipeIngredients_SubRecipeId",
                table: "RecipeIngredients");

            migrationBuilder.DropColumn(
                name: "SubRecipeId",
                table: "RecipeIngredients");

            migrationBuilder.DropColumn(
                name: "ProductionType",
                table: "MenuItems");

            migrationBuilder.DropColumn(
                name: "QuarantinedQuantity",
                table: "BranchIngredientStocks");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "BranchIngredientStocks");
        }
    }
}
