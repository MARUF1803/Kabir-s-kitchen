using KabirKitchen.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KabirKitchen.Infrastructure.Migrations;

[DbContext(typeof(KabirKitchenDbContext))]
[Migration("20261024083000_AddCampaignPricingToCustomCakes")]
public partial class AddCampaignPricingToCustomCakes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<long>(
            name: "MenuItemId",
            table: "CakeCustomOrders",
            type: "bigint",
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "SubTotal",
            table: "CakeCustomOrders",
            type: "decimal(18,2)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "DiscountAmount",
            table: "CakeCustomOrders",
            type: "decimal(18,2)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<long>(
            name: "PromotionCampaignId",
            table: "CakeCustomOrders",
            type: "bigint",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "PromotionCampaignName",
            table: "CakeCustomOrders",
            type: "nvarchar(max)",
            nullable: true);

        migrationBuilder.Sql("""
            UPDATE CakeCustomOrders
            SET SubTotal = EstimatedPrice
            WHERE SubTotal = 0 AND EstimatedPrice > 0;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "MenuItemId", table: "CakeCustomOrders");
        migrationBuilder.DropColumn(name: "SubTotal", table: "CakeCustomOrders");
        migrationBuilder.DropColumn(name: "DiscountAmount", table: "CakeCustomOrders");
        migrationBuilder.DropColumn(name: "PromotionCampaignId", table: "CakeCustomOrders");
        migrationBuilder.DropColumn(name: "PromotionCampaignName", table: "CakeCustomOrders");
    }
}
