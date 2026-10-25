using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KabirKitchen.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ScaleCatalogHierarchyAndPaging : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                WITH DuplicateProductSlugs AS
                (
                    SELECT Id, ROW_NUMBER() OVER (PARTITION BY Slug ORDER BY Id) AS DuplicateNumber
                    FROM MenuItems
                )
                UPDATE product
                SET Slug = LEFT(product.Slug, 140) + N'-legacy-' + CONVERT(nvarchar(20), product.Id),
                    IsActive = 0
                FROM MenuItems AS product
                INNER JOIN DuplicateProductSlugs AS duplicate ON duplicate.Id = product.Id
                WHERE duplicate.DuplicateNumber > 1;

                WITH DuplicateCategorySlugs AS
                (
                    SELECT Id, ROW_NUMBER() OVER (PARTITION BY Slug ORDER BY Id) AS DuplicateNumber
                    FROM Categories
                )
                UPDATE category
                SET Slug = LEFT(category.Slug, 140) + N'-legacy-' + CONVERT(nvarchar(20), category.Id),
                    IsActive = 0
                FROM Categories AS category
                INNER JOIN DuplicateCategorySlugs AS duplicate ON duplicate.Id = category.Id
                WHERE duplicate.DuplicateNumber > 1;

                UPDATE MenuItems
                SET Slug = LEFT(Slug, 140) + N'-legacy-' + CONVERT(nvarchar(20), Id)
                WHERE LEN(Slug) > 180;

                UPDATE Categories
                SET Slug = LEFT(Slug, 140) + N'-legacy-' + CONVERT(nvarchar(20), Id)
                WHERE LEN(Slug) > 180;
                """);

            migrationBuilder.DropIndex(
                name: "IX_MenuItems_CategoryId",
                table: "MenuItems");

            migrationBuilder.AlterColumn<string>(
                name: "Slug",
                table: "MenuItems",
                type: "nvarchar(180)",
                maxLength: 180,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Slug",
                table: "Categories",
                type: "nvarchar(180)",
                maxLength: 180,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<long>(
                name: "ParentCategoryId",
                table: "Categories",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MenuItems_CategoryId_IsActive_Id",
                table: "MenuItems",
                columns: new[] { "CategoryId", "IsActive", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_MenuItems_Slug",
                table: "MenuItems",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Categories_ParentCategoryId_Slug",
                table: "Categories",
                columns: new[] { "ParentCategoryId", "Slug" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Categories_Categories_ParentCategoryId",
                table: "Categories",
                column: "ParentCategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Categories_Categories_ParentCategoryId",
                table: "Categories");

            migrationBuilder.DropIndex(
                name: "IX_MenuItems_CategoryId_IsActive_Id",
                table: "MenuItems");

            migrationBuilder.DropIndex(
                name: "IX_MenuItems_Slug",
                table: "MenuItems");

            migrationBuilder.DropIndex(
                name: "IX_Categories_ParentCategoryId_Slug",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "ParentCategoryId",
                table: "Categories");

            migrationBuilder.AlterColumn<string>(
                name: "Slug",
                table: "MenuItems",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(180)",
                oldMaxLength: 180);

            migrationBuilder.AlterColumn<string>(
                name: "Slug",
                table: "Categories",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(180)",
                oldMaxLength: 180);

            migrationBuilder.CreateIndex(
                name: "IX_MenuItems_CategoryId",
                table: "MenuItems",
                column: "CategoryId");
        }
    }
}
