using KabirKitchen.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KabirKitchen.Infrastructure.Migrations;

[DbContext(typeof(KabirKitchenDbContext))]
[Migration("20261015120000_AddHeroBannerMediaAndTargetingColumns")]
public sealed class AddHeroBannerMediaAndTargetingColumns : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            IF OBJECT_ID(N'[dbo].[HeroBanners]', N'U') IS NOT NULL
            BEGIN
                IF COL_LENGTH(N'dbo.HeroBanners', N'CampaignName') IS NULL
                    ALTER TABLE [dbo].[HeroBanners] ADD [CampaignName] nvarchar(max) NULL;
                IF COL_LENGTH(N'dbo.HeroBanners', N'BadgeText') IS NULL
                    ALTER TABLE [dbo].[HeroBanners] ADD [BadgeText] nvarchar(max) NULL;
                IF COL_LENGTH(N'dbo.HeroBanners', N'MediaType') IS NULL
                    ALTER TABLE [dbo].[HeroBanners] ADD [MediaType] int NOT NULL CONSTRAINT [DF_HeroBanners_MediaType] DEFAULT 0;
                IF COL_LENGTH(N'dbo.HeroBanners', N'MediaUrl') IS NULL
                    ALTER TABLE [dbo].[HeroBanners] ADD [MediaUrl] nvarchar(max) NULL;
                IF COL_LENGTH(N'dbo.HeroBanners', N'MobileMediaUrl') IS NULL
                    ALTER TABLE [dbo].[HeroBanners] ADD [MobileMediaUrl] nvarchar(max) NULL;
                IF COL_LENGTH(N'dbo.HeroBanners', N'PosterUrl') IS NULL
                    ALTER TABLE [dbo].[HeroBanners] ADD [PosterUrl] nvarchar(max) NULL;
                IF COL_LENGTH(N'dbo.HeroBanners', N'TargetCategoryId') IS NULL
                    ALTER TABLE [dbo].[HeroBanners] ADD [TargetCategoryId] bigint NULL;
                IF COL_LENGTH(N'dbo.HeroBanners', N'TargetMenuItemId') IS NULL
                    ALTER TABLE [dbo].[HeroBanners] ADD [TargetMenuItemId] bigint NULL;
            END;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            IF OBJECT_ID(N'[dbo].[HeroBanners]', N'U') IS NOT NULL
            BEGIN
                IF COL_LENGTH(N'dbo.HeroBanners', N'TargetMenuItemId') IS NOT NULL
                    ALTER TABLE [dbo].[HeroBanners] DROP COLUMN [TargetMenuItemId];
                IF COL_LENGTH(N'dbo.HeroBanners', N'TargetCategoryId') IS NOT NULL
                    ALTER TABLE [dbo].[HeroBanners] DROP COLUMN [TargetCategoryId];
                IF COL_LENGTH(N'dbo.HeroBanners', N'PosterUrl') IS NOT NULL
                    ALTER TABLE [dbo].[HeroBanners] DROP COLUMN [PosterUrl];
                IF COL_LENGTH(N'dbo.HeroBanners', N'MobileMediaUrl') IS NOT NULL
                    ALTER TABLE [dbo].[HeroBanners] DROP COLUMN [MobileMediaUrl];
                IF COL_LENGTH(N'dbo.HeroBanners', N'MediaUrl') IS NOT NULL
                    ALTER TABLE [dbo].[HeroBanners] DROP COLUMN [MediaUrl];
                IF COL_LENGTH(N'dbo.HeroBanners', N'MediaType') IS NOT NULL
                    ALTER TABLE [dbo].[HeroBanners] DROP COLUMN [MediaType];
                IF COL_LENGTH(N'dbo.HeroBanners', N'BadgeText') IS NOT NULL
                    ALTER TABLE [dbo].[HeroBanners] DROP COLUMN [BadgeText];
                IF COL_LENGTH(N'dbo.HeroBanners', N'CampaignName') IS NOT NULL
                    ALTER TABLE [dbo].[HeroBanners] DROP COLUMN [CampaignName];
            END;
            """);
    }
}
