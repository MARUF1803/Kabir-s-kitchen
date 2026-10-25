using KabirKitchen.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KabirKitchen.Infrastructure.Migrations;

[DbContext(typeof(KabirKitchenDbContext))]
[Migration("20261024090000_LinkHeroBannersToPromotionCampaigns")]
public partial class LinkHeroBannersToPromotionCampaigns : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<long>(
            name: "PromotionCampaignId",
            table: "HeroBanners",
            type: "bigint",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "AltText",
            table: "HeroBanners",
            type: "nvarchar(max)",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_HeroBanners_PromotionCampaignId",
            table: "HeroBanners",
            column: "PromotionCampaignId");

        migrationBuilder.AddForeignKey(
            name: "FK_HeroBanners_PromotionCampaigns_PromotionCampaignId",
            table: "HeroBanners",
            column: "PromotionCampaignId",
            principalTable: "PromotionCampaigns",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_HeroBanners_PromotionCampaigns_PromotionCampaignId",
            table: "HeroBanners");
        migrationBuilder.DropIndex(
            name: "IX_HeroBanners_PromotionCampaignId",
            table: "HeroBanners");
        migrationBuilder.DropColumn(name: "PromotionCampaignId", table: "HeroBanners");
        migrationBuilder.DropColumn(name: "AltText", table: "HeroBanners");
    }
}
