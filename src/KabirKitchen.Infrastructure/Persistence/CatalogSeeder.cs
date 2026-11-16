using System.Text.Json;
using KabirKitchen.Domain.Entities.Catalog;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Infrastructure.Persistence;

public static class CatalogSeeder
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly HashSet<string> RetiredMenuItemSlugs = new(StringComparer.OrdinalIgnoreCase)
    {
        "crispy-chicken-burger",
        "chocolate-fudge-cake",
        "chocolate-fudge-cake-1kg",
        "catalog-menu-burgers-1",
        "catalog-menu-burgers-3",
        "catalog-menu-pizza-5",
        "catalog-menu-sandwich-1",
        "catalog-menu-fries-4",
        "runtime-verification-product"
    };

    public static async Task<int> SeedAsync(KabirKitchenDbContext context, CancellationToken cancellationToken = default)
    {
        await using var seedStream = typeof(CatalogSeeder).Assembly
            .GetManifestResourceStream("KabirKitchen.MenuCatalogSeed.json")
            ?? throw new InvalidOperationException("The persistent menu catalog seed resource is missing.");
        var seed = await JsonSerializer.DeserializeAsync<CatalogSeedDocument>(seedStream, JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("The persistent menu catalog seed resource is invalid.");

        ValidateSeed(seed);

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

        var categories = await context.Categories
            .IgnoreQueryFilters()
            .ToListAsync(cancellationToken);
        var categoriesBySlug = categories
            .GroupBy(category => category.Slug, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        foreach (var categorySeed in seed.Categories)
        {
            if (!categoriesBySlug.TryGetValue(categorySeed.Slug, out var category))
            {
                category = new Category { Slug = categorySeed.Slug };
                context.Categories.Add(category);
                categoriesBySlug.Add(categorySeed.Slug, category);
            }

            category.Name = categorySeed.Name;
            category.Icon = categorySeed.Icon;
            category.ImageUrl = categorySeed.ImageUrl;
            category.DisplayOrder = categorySeed.DisplayOrder;
            category.IsActive = true;
            category.IsDeleted = false;
            category.DeletedAtUtc = null;
            category.DeletedBy = null;
        }

        foreach (var legacySlug in new[] { "bakery-cakes", "burgers", "chinese-thai" })
        {
            if (categoriesBySlug.TryGetValue(legacySlug, out var legacyCat))
            {
                legacyCat.IsActive = false;
            }
        }

        await context.SaveChangesAsync(cancellationToken);

        var categoryNodes = await context.Categories
            .IgnoreQueryFilters()
            .ToListAsync(cancellationToken);
        var subCategoriesByParentAndSlug = categoryNodes
            .Where(category => category.ParentCategoryId.HasValue)
            .GroupBy(category => (category.ParentCategoryId!.Value, category.Slug), new ParentSlugComparer())
            .ToDictionary(group => group.Key, group => group.First(), new ParentSlugComparer());

        foreach (var subCategorySeed in seed.MenuItems
                     .Where(item => !string.IsNullOrWhiteSpace(item.SubCategorySlug) &&
                                    !string.IsNullOrWhiteSpace(item.SubCategoryName))
                     .GroupBy(item => (item.CategorySlug, item.SubCategorySlug), new SeedParentSlugComparer())
                     .Select(group => group.First()))
        {
            var parent = categoriesBySlug[subCategorySeed.CategorySlug];
            var slug = subCategorySeed.SubCategorySlug.Trim().ToLowerInvariant();
            var key = (parent.Id, slug);
            if (!subCategoriesByParentAndSlug.TryGetValue(key, out var subCategory))
            {
                subCategory = new Category
                {
                    ParentCategoryId = parent.Id,
                    Slug = slug
                };
                context.Categories.Add(subCategory);
                subCategoriesByParentAndSlug.Add(key, subCategory);
            }

            subCategory.Name = subCategorySeed.SubCategoryName.Trim();
            subCategory.Description = null;
            subCategory.ImageUrl = null;
            subCategory.Icon = parent.Icon;
            subCategory.DisplayOrder = 0;
            subCategory.IsActive = true;
            subCategory.IsDeleted = false;
            subCategory.DeletedAtUtc = null;
            subCategory.DeletedBy = null;
        }

        await context.SaveChangesAsync(cancellationToken);

        var menuItems = await context.MenuItems
            .IgnoreQueryFilters()
            .Include(item => item.Variants)
            .Include(item => item.AddOns).ThenInclude(link => link.AddOn)
            .ToListAsync(cancellationToken);
        var menuItemsBySlug = menuItems
            .GroupBy(item => item.Slug, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        foreach (var menuItem in menuItems)
        {
            if (RetiredMenuItemSlugs.Contains(menuItem.Slug) ||
                menuItem.Slug.StartsWith("runtime-verification-", StringComparison.OrdinalIgnoreCase))
            {
                menuItem.IsActive = false;
            }
        }

        var addedMenuItemCount = 0;
        foreach (var itemSeed in seed.MenuItems)
        {
            var rootCategory = categoriesBySlug[itemSeed.CategorySlug];
            var categorySlug = string.IsNullOrWhiteSpace(itemSeed.SubCategorySlug)
                ? null
                : itemSeed.SubCategorySlug.Trim().ToLowerInvariant();
            var category = categorySlug is not null &&
                           subCategoriesByParentAndSlug.TryGetValue((rootCategory.Id, categorySlug), out var subCategory)
                ? subCategory
                : rootCategory;
            if (!menuItemsBySlug.TryGetValue(itemSeed.Slug, out var menuItem))
            {
                menuItem = new MenuItem { Slug = itemSeed.Slug };
                context.MenuItems.Add(menuItem);
                menuItemsBySlug.Add(itemSeed.Slug, menuItem);
                addedMenuItemCount++;
            }

            menuItem.CategoryId = category.Id;
            menuItem.Name = itemSeed.Name;
            menuItem.Description = itemSeed.Description;
            menuItem.ImageUrl = itemSeed.ImageUrl;
            menuItem.SubCategorySlug = itemSeed.SubCategorySlug;
            menuItem.SubCategoryName = itemSeed.SubCategoryName;
            menuItem.BasePrice = itemSeed.BasePrice;
            menuItem.PreparationTimeMinutes = itemSeed.PreparationTimeMinutes;
            menuItem.IsVegetarian = itemSeed.IsVegetarian;
            menuItem.IsSpicy = itemSeed.IsSpicy;
            menuItem.IsBakeryItem = itemSeed.IsBakeryItem;
            menuItem.AllowCustomization = itemSeed.AllowCustomization;
            menuItem.IsCustomCake = itemSeed.IsCustomCake;
            menuItem.IsPopular = itemSeed.IsPopular;
            menuItem.Rating = itemSeed.Rating;
            menuItem.Reviews = itemSeed.Reviews;
            menuItem.IsActive = true;
            menuItem.IsDeleted = false;
            menuItem.DeletedAtUtc = null;
            menuItem.DeletedBy = null;

            foreach (var variantSeed in itemSeed.Variants)
            {
                var variant = menuItem.Variants.FirstOrDefault(existing =>
                    string.Equals(existing.VariantName, variantSeed.Name, StringComparison.OrdinalIgnoreCase));
                if (variant is null)
                {
                    menuItem.Variants.Add(new MenuItemVariant
                    {
                        VariantName = variantSeed.Name,
                        AdditionalPrice = variantSeed.AdditionalPrice,
                        IsDefault = menuItem.Variants.Count == 0
                    });
                }
                else
                {
                    variant.AdditionalPrice = variantSeed.AdditionalPrice;
                }
            }

            foreach (var addOnSeed in itemSeed.AddOns)
            {
                var existingLink = menuItem.AddOns.FirstOrDefault(link =>
                    string.Equals(link.AddOn?.Name, addOnSeed.Name, StringComparison.OrdinalIgnoreCase));
                if (existingLink?.AddOn is not null)
                {
                    existingLink.AddOn.Price = addOnSeed.Price;
                    existingLink.AddOn.IsActive = true;
                    continue;
                }

                var addOn = new AddOn { Name = addOnSeed.Name, Price = addOnSeed.Price };
                context.AddOns.Add(addOn);
                menuItem.AddOns.Add(new MenuItemAddOn { AddOn = addOn });
            }
        }

        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return addedMenuItemCount;
    }

    private static void ValidateSeed(CatalogSeedDocument seed)
    {
        if (seed.Categories.Count == 0 || seed.MenuItems.Count == 0)
            throw new InvalidOperationException("The persistent menu catalog seed must contain categories and products.");

        if (seed.Categories.Any(category =>
                string.IsNullOrWhiteSpace(category.Slug) ||
                string.IsNullOrWhiteSpace(category.Name)) ||
            seed.Categories.Select(category => category.Slug).Distinct(StringComparer.OrdinalIgnoreCase).Count() != seed.Categories.Count)
        {
            throw new InvalidOperationException("The persistent menu catalog seed contains invalid or duplicate categories.");
        }

        if (seed.MenuItems.Any(item =>
                string.IsNullOrWhiteSpace(item.Slug) ||
                string.IsNullOrWhiteSpace(item.Name) ||
                string.IsNullOrWhiteSpace(item.CategorySlug) ||
                string.IsNullOrWhiteSpace(item.ImageUrl) ||
                !Uri.TryCreate(item.ImageUrl, UriKind.Absolute, out var imageUri) ||
                imageUri.Scheme != Uri.UriSchemeHttps ||
                item.BasePrice < 0) ||
            seed.MenuItems.Select(item => item.Slug).Distinct(StringComparer.OrdinalIgnoreCase).Count() != seed.MenuItems.Count)
        {
            throw new InvalidOperationException("The persistent menu catalog seed contains invalid or duplicate products.");
        }

        var categorySlugs = seed.Categories.Select(category => category.Slug).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (seed.MenuItems.Any(item => !categorySlugs.Contains(item.CategorySlug)))
            throw new InvalidOperationException("A product in the persistent menu catalog seed references an unknown category.");
    }

    private sealed record CatalogSeedDocument(List<CategorySeed> Categories, List<MenuItemSeed> MenuItems);

    private sealed record CategorySeed(
        string Slug,
        string Name,
        string Icon,
        string? ImageUrl,
        int DisplayOrder);

    private sealed record MenuItemSeed(
        string CategorySlug,
        string SubCategorySlug,
        string SubCategoryName,
        string Name,
        string Slug,
        string Description,
        string? ImageUrl,
        decimal BasePrice,
        int PreparationTimeMinutes,
        bool IsVegetarian,
        bool IsSpicy,
        bool IsBakeryItem,
        bool AllowCustomization,
        bool IsCustomCake,
        bool IsPopular,
        decimal Rating,
        int Reviews,
        List<VariantSeed> Variants,
        List<AddOnSeed> AddOns);

    private sealed record VariantSeed(string Name, decimal AdditionalPrice);

    private sealed record AddOnSeed(string Name, decimal Price);

    private sealed class ParentSlugComparer : IEqualityComparer<(long, string)>
    {
        public bool Equals((long, string) x, (long, string) y) =>
            x.Item1 == y.Item1 && StringComparer.OrdinalIgnoreCase.Equals(x.Item2, y.Item2);

        public int GetHashCode((long, string) value) =>
            HashCode.Combine(value.Item1, StringComparer.OrdinalIgnoreCase.GetHashCode(value.Item2));
    }

    private sealed class SeedParentSlugComparer : IEqualityComparer<(string, string)>
    {
        public bool Equals((string, string) x, (string, string) y) =>
            StringComparer.OrdinalIgnoreCase.Equals(x.Item1, y.Item1) &&
            StringComparer.OrdinalIgnoreCase.Equals(x.Item2, y.Item2);

        public int GetHashCode((string, string) value) =>
            HashCode.Combine(
                StringComparer.OrdinalIgnoreCase.GetHashCode(value.Item1),
                StringComparer.OrdinalIgnoreCase.GetHashCode(value.Item2));
    }
}
