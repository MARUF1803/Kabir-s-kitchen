using FluentAssertions;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Api.Controllers;
using KabirKitchen.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace KabirKitchen.Tests;

public class CatalogProductCreationTests
{
    [Fact]
    public async Task CatalogSeeder_ShouldUpdateExistingProductsWithoutDuplicatingCatalogData()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        await using var dbContext = new KabirKitchenDbContext(options);

        var addedCount = await CatalogSeeder.SeedAsync(dbContext);
        addedCount.Should().Be(477);

        var product = await dbContext.MenuItems.SingleAsync(item => item.Slug == "bangkok-red-curry");
        product.ImageUrl = "https://example.com/stale-image.jpg";
        product.SubCategorySlug = null;
        await dbContext.SaveChangesAsync();

        var addedOnReseed = await CatalogSeeder.SeedAsync(dbContext);
        var updatedProduct = await dbContext.MenuItems.SingleAsync(item => item.Slug == "bangkok-red-curry");

        addedOnReseed.Should().Be(0);
        updatedProduct.ImageUrl.Should().Contain("/17748116/");
        updatedProduct.SubCategorySlug.Should().Be("thai-curry");
        (await dbContext.MenuItems.CountAsync()).Should().Be(477);
        (await dbContext.MenuItemVariants.CountAsync()).Should().Be(136);
        (await dbContext.MenuItemAddOns.CountAsync()).Should().Be(95);
    }

    [Fact]
    public async Task CatalogSeeder_ShouldCreateCategoryTreeAndKeepGeneratedIdsUnique()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        await using var dbContext = new KabirKitchenDbContext(options);
        await CatalogSeeder.SeedAsync(dbContext);

        var productIds = await dbContext.MenuItems.Select(item => item.Id).ToListAsync();
        productIds.Should().HaveCount(477);
        productIds.Distinct().Should().HaveCount(477);

        var bangkokCurry = await dbContext.MenuItems.SingleAsync(item => item.Slug == "bangkok-red-curry");
        var subCategory = await dbContext.Categories.SingleAsync(category => category.Id == bangkokCurry.CategoryId);
        subCategory.ParentCategoryId.Should().NotBeNull();
        subCategory.Slug.Should().Be("thai-curry");

        var parentCategory = await dbContext.Categories.SingleAsync(category => category.Id == subCategory.ParentCategoryId);
        parentCategory.Slug.Should().Be("thai-food");

        var productSlugIndex = dbContext.Model.FindEntityType(typeof(MenuItem))!.GetIndexes()
            .Single(index => index.Properties.Select(property => property.Name).SequenceEqual(["Slug"]));
        productSlugIndex.IsUnique.Should().BeTrue();
        var categoryTreeIndex = dbContext.Model.FindEntityType(typeof(Category))!.GetIndexes()
            .Single(index => index.Properties.Select(property => property.Name).SequenceEqual(["ParentCategoryId", "Slug"]));
        categoryTreeIndex.IsUnique.Should().BeTrue();
    }

    [Fact]
    public async Task CatalogSeeder_ShouldDeactivateLegacyDemoAndDuplicateProducts()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        await using var dbContext = new KabirKitchenDbContext(options);
        var legacyCategory = new Category { Name = "Legacy", Slug = "legacy" };
        dbContext.Categories.Add(legacyCategory);
        await dbContext.SaveChangesAsync();
        dbContext.MenuItems.AddRange(
            new MenuItem { CategoryId = legacyCategory.Id, Name = "Old sample burger", Slug = "crispy-chicken-burger" },
            new MenuItem { CategoryId = legacyCategory.Id, Name = "Duplicate cheeseburger", Slug = "catalog-menu-burgers-1" },
            new MenuItem { CategoryId = legacyCategory.Id, Name = "Verification product", Slug = "runtime-verification-product" });
        await dbContext.SaveChangesAsync();

        await CatalogSeeder.SeedAsync(dbContext);

        (await dbContext.MenuItems
            .Where(item => item.Slug == "crispy-chicken-burger" ||
                           item.Slug == "catalog-menu-burgers-1" ||
                           item.Slug == "runtime-verification-product")
            .AllAsync(item => !item.IsActive)).Should().BeTrue();
    }

    [Fact]
    public async Task CreateMenuItemAsync_ShouldPersistActiveProductWithCatalogData()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var dbContext = new KabirKitchenDbContext(options);
        var category = new Category
        {
            Name = "Bakery & Custom Cakes",
            Slug = "bakery-cakes",
            IsActive = true
        };
        dbContext.Categories.Add(category);
        await dbContext.SaveChangesAsync();

        var service = new CatalogService(dbContext);
        var result = await service.CreateMenuItemAsync(new CreateMenuItemDto(
            category.Id,
            "Chocolate Strawberry Cake",
            "chocolate-strawberry-cake",
            "Two-layer celebration cake",
            "https://example.com/cake.jpg",
            1250m,
            60,
            false,
            false,
            true,
            true,
            null,
            null));

        result.IsSuccess.Should().BeTrue();
        var saved = await dbContext.MenuItems.SingleAsync();
        saved.Name.Should().Be("Chocolate Strawberry Cake");
        saved.CategoryId.Should().Be(category.Id);
        saved.BasePrice.Should().Be(1250m);
        saved.IsBakeryItem.Should().BeTrue();
        saved.IsActive.Should().BeTrue();
        saved.Slug.Should().Be("chocolate-strawberry-cake");
    }

    [Fact]
    public async Task CreateCategoryAsync_ShouldAllowNestedCategoriesAndRejectDuplicateSiblingSlugs()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var dbContext = new KabirKitchenDbContext(options);
        var root = new Category { Name = "Drinks", Slug = "drinks" };
        dbContext.Categories.Add(root);
        await dbContext.SaveChangesAsync();
        var service = new CatalogService(dbContext);

        var child = await service.CreateCategoryAsync(new CreateCategoryDto(
            "Coffee",
            "coffee",
            root.Id,
            null,
            null,
            "☕",
            1));

        child.IsSuccess.Should().BeTrue();
        var grandchild = await service.CreateCategoryAsync(new CreateCategoryDto(
            "Cold Coffee",
            "cold-coffee",
            child.Value.Id,
            null,
            null,
            "🧋",
            1));
        grandchild.IsSuccess.Should().BeTrue();

        var duplicate = await service.CreateCategoryAsync(new CreateCategoryDto(
            "Coffee Repeat",
            "coffee",
            root.Id,
            null,
            null,
            "☕",
            2));
        duplicate.IsFailure.Should().BeTrue();
        (await dbContext.Categories.CountAsync()).Should().Be(3);
    }

    [Fact]
    public async Task GetMenuItems_ShouldReturnStableBoundedPagesIncludingDescendantCategories()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var dbContext = new KabirKitchenDbContext(options);
        var root = new Category { Name = "Drinks", Slug = "drinks" };
        var subCategory = new Category { Name = "Tea", Slug = "tea", ParentCategory = root };
        dbContext.Categories.AddRange(root, subCategory);
        await dbContext.SaveChangesAsync();
        dbContext.MenuItems.AddRange(Enumerable.Range(1, 5).Select(index => new MenuItem
        {
            CategoryId = subCategory.Id,
            Name = $"Tea {index}",
            Slug = $"tea-{index}",
            BasePrice = index
        }));
        await dbContext.SaveChangesAsync();

        var controller = new MenuController(dbContext, new CatalogService(dbContext));
        var response = await controller.GetMenuItems(categoryId: root.Id, page: 2, pageSize: 2);

        var page = (response as OkObjectResult)?.Value as MenuItemPageDto;
        page.Should().NotBeNull();
        page!.Items.Should().HaveCount(2);
        page.Items.Select(item => item.Name).Should().Equal("Tea 3", "Tea 4");
        page.TotalCount.Should().Be(5);
        page.TotalPages.Should().Be(3);
        page.HasNextPage.Should().BeTrue();
        page.Items.Should().OnlyContain(item => item.RootCategoryId == root.Id);
    }

    [Fact]
    public async Task SqlServerCatalogModel_ShouldGenerateBigintIdentityIdsForTenThousandProducts()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var dbContext = new KabirKitchenDbContext(options);
        var category = new Category { Name = "Bulk Test", Slug = "bulk-test" };
        dbContext.Categories.Add(category);
        await dbContext.SaveChangesAsync();

        dbContext.MenuItems.AddRange(Enumerable.Range(1, 10_000).Select(index => new MenuItem
        {
            CategoryId = category.Id,
            Name = $"Product {index}",
            Slug = $"product-{index}"
        }));
        await dbContext.SaveChangesAsync();

        var ids = await dbContext.MenuItems.Select(item => item.Id).ToListAsync();
        ids.Should().HaveCount(10_000);
        ids.Distinct().Should().HaveCount(10_000);
        dbContext.Model.FindEntityType(typeof(MenuItem))!
            .FindProperty(nameof(MenuItem.Id))!
            .ValueGenerated.Should().Be(Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.OnAdd);
    }
}
