using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KabirKitchen.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddReservationAndCashShift : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EquipmentReservoirTransactions_InventoryLots_SourceInventoryLotId",
                table: "EquipmentReservoirTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_IngredientLotAllocations_InventoryLots_InventoryLotId",
                table: "IngredientLotAllocations");

            migrationBuilder.DropForeignKey(
                name: "FK_IngredientLotAllocations_StockTransactions_StockTransactionId",
                table: "IngredientLotAllocations");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionBatchIngredients_Ingredients_IngredientId",
                table: "ProductionBatchIngredients");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionBatchSubRecipes_SubRecipes_SubRecipeId",
                table: "ProductionBatchSubRecipes");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductLotAllocations_InventoryLots_InventoryLotId",
                table: "ProductLotAllocations");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductLotAllocations_ProductStockTransactions_ProductStockTransactionId",
                table: "ProductLotAllocations");

            migrationBuilder.DropForeignKey(
                name: "FK_SubRecipeLotAllocations_InventoryLots_InventoryLotId",
                table: "SubRecipeLotAllocations");

            migrationBuilder.DropForeignKey(
                name: "FK_SubRecipeLotAllocations_SubRecipeStockTransactions_SubRecipeStockTransactionId",
                table: "SubRecipeLotAllocations");

            migrationBuilder.CreateTable(
                name: "CashShifts",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<long>(type: "bigint", nullable: false),
                    CashierUserId = table.Column<long>(type: "bigint", nullable: false),
                    ShiftReferenceNumber = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CashierStaffName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OpenedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ClosedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    OpeningFloat = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalCashSales = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalCardSales = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalMfsSales = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CashDropAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ExpectedCashInDrawer = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ActualCashCounted = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    VarianceOverShort = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    ZReportNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClosingSupervisorUserId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashShifts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CashShifts_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CashShifts_Users_CashierUserId",
                        column: x => x.CashierUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TableReservations",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<long>(type: "bigint", nullable: false),
                    CustomerUserId = table.Column<long>(type: "bigint", nullable: true),
                    ReferenceCode = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    CustomerPhone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CustomerEmail = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReservationDateUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    GuestCount = table.Column<int>(type: "int", nullable: false),
                    SpecialRequests = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    AssignedTableNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ConfirmedByUserId = table.Column<long>(type: "bigint", nullable: true),
                    StaffNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TableReservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TableReservations_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TableReservations_Users_CustomerUserId",
                        column: x => x.CustomerUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CashShifts_BranchId_Status_OpenedAtUtc",
                table: "CashShifts",
                columns: new[] { "BranchId", "Status", "OpenedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CashShifts_CashierUserId",
                table: "CashShifts",
                column: "CashierUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CashShifts_ShiftReferenceNumber",
                table: "CashShifts",
                column: "ShiftReferenceNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TableReservations_BranchId_ReservationDateUtc_Status",
                table: "TableReservations",
                columns: new[] { "BranchId", "ReservationDateUtc", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TableReservations_CustomerUserId",
                table: "TableReservations",
                column: "CustomerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TableReservations_ReferenceCode",
                table: "TableReservations",
                column: "ReferenceCode",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_EquipmentReservoirTransactions_InventoryLots_SourceInventoryLotId",
                table: "EquipmentReservoirTransactions",
                column: "SourceInventoryLotId",
                principalTable: "InventoryLots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_IngredientLotAllocations_InventoryLots_InventoryLotId",
                table: "IngredientLotAllocations",
                column: "InventoryLotId",
                principalTable: "InventoryLots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_IngredientLotAllocations_StockTransactions_StockTransactionId",
                table: "IngredientLotAllocations",
                column: "StockTransactionId",
                principalTable: "StockTransactions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionBatchIngredients_Ingredients_IngredientId",
                table: "ProductionBatchIngredients",
                column: "IngredientId",
                principalTable: "Ingredients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionBatchSubRecipes_SubRecipes_SubRecipeId",
                table: "ProductionBatchSubRecipes",
                column: "SubRecipeId",
                principalTable: "SubRecipes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductLotAllocations_InventoryLots_InventoryLotId",
                table: "ProductLotAllocations",
                column: "InventoryLotId",
                principalTable: "InventoryLots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductLotAllocations_ProductStockTransactions_ProductStockTransactionId",
                table: "ProductLotAllocations",
                column: "ProductStockTransactionId",
                principalTable: "ProductStockTransactions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SubRecipeLotAllocations_InventoryLots_InventoryLotId",
                table: "SubRecipeLotAllocations",
                column: "InventoryLotId",
                principalTable: "InventoryLots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SubRecipeLotAllocations_SubRecipeStockTransactions_SubRecipeStockTransactionId",
                table: "SubRecipeLotAllocations",
                column: "SubRecipeStockTransactionId",
                principalTable: "SubRecipeStockTransactions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EquipmentReservoirTransactions_InventoryLots_SourceInventoryLotId",
                table: "EquipmentReservoirTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_IngredientLotAllocations_InventoryLots_InventoryLotId",
                table: "IngredientLotAllocations");

            migrationBuilder.DropForeignKey(
                name: "FK_IngredientLotAllocations_StockTransactions_StockTransactionId",
                table: "IngredientLotAllocations");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionBatchIngredients_Ingredients_IngredientId",
                table: "ProductionBatchIngredients");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductionBatchSubRecipes_SubRecipes_SubRecipeId",
                table: "ProductionBatchSubRecipes");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductLotAllocations_InventoryLots_InventoryLotId",
                table: "ProductLotAllocations");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductLotAllocations_ProductStockTransactions_ProductStockTransactionId",
                table: "ProductLotAllocations");

            migrationBuilder.DropForeignKey(
                name: "FK_SubRecipeLotAllocations_InventoryLots_InventoryLotId",
                table: "SubRecipeLotAllocations");

            migrationBuilder.DropForeignKey(
                name: "FK_SubRecipeLotAllocations_SubRecipeStockTransactions_SubRecipeStockTransactionId",
                table: "SubRecipeLotAllocations");

            migrationBuilder.DropTable(
                name: "CashShifts");

            migrationBuilder.DropTable(
                name: "TableReservations");

            migrationBuilder.AddForeignKey(
                name: "FK_EquipmentReservoirTransactions_InventoryLots_SourceInventoryLotId",
                table: "EquipmentReservoirTransactions",
                column: "SourceInventoryLotId",
                principalTable: "InventoryLots",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_IngredientLotAllocations_InventoryLots_InventoryLotId",
                table: "IngredientLotAllocations",
                column: "InventoryLotId",
                principalTable: "InventoryLots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_IngredientLotAllocations_StockTransactions_StockTransactionId",
                table: "IngredientLotAllocations",
                column: "StockTransactionId",
                principalTable: "StockTransactions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionBatchIngredients_Ingredients_IngredientId",
                table: "ProductionBatchIngredients",
                column: "IngredientId",
                principalTable: "Ingredients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductionBatchSubRecipes_SubRecipes_SubRecipeId",
                table: "ProductionBatchSubRecipes",
                column: "SubRecipeId",
                principalTable: "SubRecipes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductLotAllocations_InventoryLots_InventoryLotId",
                table: "ProductLotAllocations",
                column: "InventoryLotId",
                principalTable: "InventoryLots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductLotAllocations_ProductStockTransactions_ProductStockTransactionId",
                table: "ProductLotAllocations",
                column: "ProductStockTransactionId",
                principalTable: "ProductStockTransactions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SubRecipeLotAllocations_InventoryLots_InventoryLotId",
                table: "SubRecipeLotAllocations",
                column: "InventoryLotId",
                principalTable: "InventoryLots",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SubRecipeLotAllocations_SubRecipeStockTransactions_SubRecipeStockTransactionId",
                table: "SubRecipeLotAllocations",
                column: "SubRecipeStockTransactionId",
                principalTable: "SubRecipeStockTransactions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
