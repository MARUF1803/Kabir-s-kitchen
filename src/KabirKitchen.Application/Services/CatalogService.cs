using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Catalog;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public class CatalogService
{
    private readonly IApplicationDbContext _context;

    public CatalogService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<MenuItemDto>> CreateMenuItemAsync(CreateMenuItemDto request)
    {
        if (request.BasePrice < 0)
            return Result<MenuItemDto>.Failure("Product price cannot be negative.");

        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 160)
            return Result<MenuItemDto>.Failure("Product name must be between 1 and 160 characters.");
        if (string.IsNullOrWhiteSpace(request.Slug))
            return Result<MenuItemDto>.Failure("Product slug is required.");

        var category = await _context.Categories
            .FirstOrDefaultAsync(c => c.Id == request.CategoryId && c.IsActive && !c.IsDeleted);
        if (category == null)
            return Result<MenuItemDto>.Failure("Category not found or inactive.");

        var normalizedSlug = request.Slug.Trim().ToLowerInvariant().Replace(" ", "-");
        if (normalizedSlug.Length is 0 or > 180)
            return Result<MenuItemDto>.Failure("Product slug must be between 1 and 180 characters.");

        var duplicate = await _context.MenuItems.AnyAsync(m =>
            m.Slug == normalizedSlug && !m.IsDeleted);
        if (duplicate)
            return Result<MenuItemDto>.Failure("A product with this slug already exists.");

        var menuItem = new MenuItem
        {
            CategoryId = category.Id,
            Category = category,
            Name = request.Name.Trim(),
            Slug = normalizedSlug,
            Description = request.Description,
            ImageUrl = request.ImageUrl,
            BasePrice = request.BasePrice,
            PreparationTimeMinutes = request.PreparationTimeMinutes,
            IsVegetarian = request.IsVegetarian,
            IsSpicy = request.IsSpicy,
            IsBakeryItem = request.IsBakeryItem,
            AllowCustomization = request.AllowCustomization,
            IsActive = true
        };

        _context.MenuItems.Add(menuItem);
        await _context.SaveChangesAsync();

        var categoryTree = await _context.Categories.AsNoTracking().ToListAsync();
        var categoryPath = BuildCategoryPath(category, categoryTree);
        var rootCategory = categoryPath[^1];
        return Result<MenuItemDto>.Success(MapToDto(
            menuItem,
            rootCategory.Name,
            null,
            new List<MenuItemVariantDto>(),
            new List<AddOnDto>(),
            rootCategory.Id,
            rootCategory.Slug,
            string.Join(" > ", categoryPath.AsEnumerable().Reverse().Select(node => node.Name)),
            categoryPath.Count > 1 ? category.Name : null,
            categoryPath.Count > 1 ? category.Id.ToString() : null));
    }

    public async Task<Result<CategoryDto>> CreateCategoryAsync(CreateCategoryDto request)
    {
        var name = request.Name.Trim();
        var slug = request.Slug.Trim().ToLowerInvariant().Replace(" ", "-");
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Slug) ||
            name.Length > 160 || slug.Length is 0 or > 180)
            return Result<CategoryDto>.Failure("Category name and slug must be between 1 and 160/180 characters.");

        if (request.ParentCategoryId.HasValue &&
            !await _context.Categories.AnyAsync(category =>
                category.Id == request.ParentCategoryId.Value && category.IsActive && !category.IsDeleted))
        {
            return Result<CategoryDto>.Failure("Parent category not found or inactive.");
        }

        var duplicate = await _context.Categories.AnyAsync(category =>
            category.ParentCategoryId == request.ParentCategoryId &&
            category.Slug == slug &&
            !category.IsDeleted);
        if (duplicate)
            return Result<CategoryDto>.Failure("A category with this slug already exists under that parent.");

        var category = new Category
        {
            ParentCategoryId = request.ParentCategoryId,
            Name = name,
            Slug = slug,
            Description = request.Description?.Trim(),
            ImageUrl = request.ImageUrl?.Trim(),
            Icon = string.IsNullOrWhiteSpace(request.Icon) ? "🍽️" : request.Icon.Trim(),
            DisplayOrder = request.DisplayOrder,
            IsActive = true
        };
        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        return Result<CategoryDto>.Success(new CategoryDto(
            category.Id,
            category.Name,
            category.Slug,
            category.Description,
            category.ImageUrl,
            category.DisplayOrder,
            category.IsActive,
            category.Icon));
    }

    private static MenuItemDto MapToDto(
        MenuItem menuItem,
        string categoryName,
        decimal? branchPrice,
        List<MenuItemVariantDto> variants,
        List<AddOnDto> addOns,
        long rootCategoryId,
        string rootCategorySlug,
        string categoryPath,
        string? subCategoryName,
        string? subCategoryId)
    {
        return new MenuItemDto(
            menuItem.Id,
            menuItem.CategoryId,
            categoryName,
            menuItem.Name,
            menuItem.Slug,
            menuItem.Description,
            menuItem.ImageUrl,
            menuItem.BasePrice,
            branchPrice,
            menuItem.PreparationTimeMinutes,
            menuItem.IsVegetarian,
            menuItem.IsSpicy,
            menuItem.IsBakeryItem,
            menuItem.AllowCustomization,
            menuItem.IsActive,
            false,
            variants,
            addOns,
            CategorySlug: menuItem.Category?.Slug ?? "",
            SubCategoryId: subCategoryId ?? menuItem.SubCategorySlug,
            SubCategoryName: subCategoryName ?? menuItem.SubCategoryName,
            Rating: menuItem.Rating,
            Reviews: menuItem.Reviews,
            IsPopular: menuItem.IsPopular,
            IsCustomCake: menuItem.IsCustomCake,
            RootCategoryId: rootCategoryId,
            RootCategorySlug: rootCategorySlug,
            CategoryPath: categoryPath);
    }

    private static List<Category> BuildCategoryPath(Category category, IReadOnlyCollection<Category> categories)
    {
        var categoriesById = categories.ToDictionary(item => item.Id);
        var path = new List<Category> { category };
        var current = category;
        var visited = new HashSet<long> { current.Id };
        while (current.ParentCategoryId is long parentId &&
               categoriesById.TryGetValue(parentId, out var parent) &&
               visited.Add(parent.Id))
        {
            path.Add(parent);
            current = parent;
        }

        return path;
    }
}
