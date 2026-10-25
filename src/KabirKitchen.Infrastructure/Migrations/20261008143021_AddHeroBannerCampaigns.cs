using System;
using KabirKitchen.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KabirKitchen.Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(KabirKitchenDbContext))]
    [Migration("20261008143021_AddHeroBannerCampaigns")]
    public partial class AddHeroBannerCampaigns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF OBJECT_ID(N'[dbo].[HeroBanners]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[HeroBanners] (
                        [Id] bigint IDENTITY(1,1) NOT NULL,
                        [Title] nvarchar(max) NOT NULL,
                        [Subtitle] nvarchar(max) NOT NULL,
                        [ImageUrl] nvarchar(max) NULL,
                        [ButtonText] nvarchar(max) NOT NULL,
                        [ButtonLink] nvarchar(max) NULL,
                        [CampaignName] nvarchar(max) NULL,
                        [BadgeText] nvarchar(max) NULL,
                        [MediaType] int NOT NULL CONSTRAINT [DF_HeroBanners_MediaType] DEFAULT 0,
                        [MediaUrl] nvarchar(max) NULL,
                        [MobileMediaUrl] nvarchar(max) NULL,
                        [PosterUrl] nvarchar(max) NULL,
                        [DisplayOrder] int NOT NULL,
                        [IsActive] bit NOT NULL,
                        [StartDate] datetime2 NOT NULL,
                        [EndDate] datetime2 NOT NULL,
                        [BranchId] bigint NULL,
                        [TargetCategoryId] bigint NULL,
                        [TargetMenuItemId] bigint NULL,
                        [CreatedAtUtc] datetime2 NOT NULL,
                        [UpdatedAtUtc] datetime2 NULL,
                        [CreatedBy] nvarchar(max) NULL,
                        [UpdatedBy] nvarchar(max) NULL,
                        CONSTRAINT [PK_HeroBanners] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_HeroBanners_Branches_BranchId]
                            FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches] ([Id]) ON DELETE NO ACTION
                    );
                END;

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_HeroBanners_BranchId_DisplayOrder' AND [object_id] = OBJECT_ID(N'[dbo].[HeroBanners]'))
                    CREATE INDEX [IX_HeroBanners_BranchId_DisplayOrder] ON [dbo].[HeroBanners] ([BranchId], [DisplayOrder]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_HeroBanners_DisplayOrder_Id' AND [object_id] = OBJECT_ID(N'[dbo].[HeroBanners]'))
                    CREATE INDEX [IX_HeroBanners_DisplayOrder_Id] ON [dbo].[HeroBanners] ([DisplayOrder], [Id]);

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_HeroBanners_IsActive_StartDate_EndDate' AND [object_id] = OBJECT_ID(N'[dbo].[HeroBanners]'))
                    CREATE INDEX [IX_HeroBanners_IsActive_StartDate_EndDate] ON [dbo].[HeroBanners] ([IsActive], [StartDate], [EndDate]);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "HeroBanners");
        }
    }
}
