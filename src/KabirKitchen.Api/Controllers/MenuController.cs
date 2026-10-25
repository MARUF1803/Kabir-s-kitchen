using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Entities.Catalog;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MenuController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly CatalogService _catalogService;

    public MenuController(IApplicationDbContext context, CatalogService catalogService)
    {
        _context = context;
        _catalogService = catalogService;
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _context.Categories
            .Where(c => c.IsActive)
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.Name)
            .ToListAsync();

        var activeProductCategoryIds = await _context.MenuItems
            .Where(item => item.IsActive)
            .Select(item => item.CategoryId)
            .Distinct()
            .ToListAsync();
        var categoriesById = categories.ToDictionary(category => category.Id);
        var categoriesWithProducts = new HashSet<long>();
        foreach (var categoryId in activeProductCategoryIds)
        {
            var currentId = categoryId;
            while (categoriesWithProducts.Add(currentId) &&
                   categoriesById.TryGetValue(currentId, out var category) &&
                   category.ParentCategoryId is long parentId)
            {
                currentId = parentId;
            }
        }

        var childrenByParentId = categories
            .Where(category => category.ParentCategoryId.HasValue)
            .GroupBy(category => category.ParentCategoryId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());

        List<SubCategoryDto> MapChildren(long parentId) =>
            childrenByParentId.TryGetValue(parentId, out var children)
                ? children
                    .Where(child => categoriesWithProducts.Contains(child.Id))
                    .Select(child => new SubCategoryDto(
                        child.Slug,
                        child.Name,
                        child.Slug,
                        child.Id,
                        MapChildren(child.Id)))
                    .ToList()
                : [];

        var result = categories
            .Where(category => category.ParentCategoryId is null && categoriesWithProducts.Contains(category.Id))
            .Select(category => new CategoryDto(
            category.Id,
            category.Name,
            category.Slug,
            category.Description,
            category.ImageUrl,
            category.DisplayOrder,
            category.IsActive,
            category.Icon,
            MapChildren(category.Id)
        )).ToList();

        return Ok(result);
    }

    [HttpGet("items")]
    public async Task<IActionResult> GetMenuItems(
        [FromQuery] long? branchId = null,
        [FromQuery] long? categoryId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        [FromQuery] string? search = null)
    {
        if (branchId.HasValue && (branchId.Value <= 0 ||
            !await _context.Branches.AnyAsync(branch => branch.Id == branchId.Value && branch.IsActive)))
        {
            return BadRequest(new { message = "A valid active branch ID is required." });
        }

        var categories = await _context.Categories.AsNoTracking().ToListAsync();
        var categoriesById = categories.ToDictionary(category => category.Id);
        var query = _context.MenuItems
            .Where(item => item.IsActive && item.Category != null && item.Category.IsActive);

        if (categoryId.HasValue)
        {
            if (categoriesById.ContainsKey(categoryId.Value))
            {
                var descendantIds = GetCategoryAndDescendantIds(categoryId.Value, categories);
                query = query.Where(item => descendantIds.Contains(item.CategoryId));
            }
            else
            {
                query = query.Where(_ => false);
            }
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.Trim();
            query = query.Where(item =>
                item.Name.Contains(searchTerm) ||
                (item.Description != null && item.Description.Contains(searchTerm)) ||
                item.Category!.Name.Contains(searchTerm));
        }

        if (page < 1 || pageSize is < 1 or > 100 || (long)(page - 1) * pageSize > int.MaxValue)
            return BadRequest(new { message = "Page must be positive and pageSize must be between 1 and 100." });

        var totalCount = await query.CountAsync();
        var itemsQuery = query
            .AsNoTracking()
            .OrderBy(item => item.Id)
            .Include(item => item.Variants)
            .Include(item => item.AddOns).ThenInclude(link => link.AddOn)
            .AsSplitQuery();
        itemsQuery = itemsQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize);

        var items = await itemsQuery.ToListAsync();

        // If branchId is specified, fetch branch-specific overrides
        Dictionary<long, (decimal? CustomPrice, bool IsAvailable, bool IsSoldOut)> branchOverrides = new();
        if (branchId.HasValue)
        {
            var itemIds = items.Select(item => item.Id).ToArray();
            var overrides = await _context.BranchMenuItemOverrides
                .Where(branchOverride =>
                    branchOverride.BranchId == branchId.Value &&
                    itemIds.Contains(branchOverride.MenuItemId))
                .ToListAsync();

            branchOverrides = overrides.ToDictionary(
                o => o.MenuItemId,
                o => (o.CustomPrice, o.IsAvailableInBranch, o.IsSoldOutToday)
            );
        }

        var result = items.Select(item =>
        {
            decimal effectivePrice = item.BasePrice;
            bool isAvailable = true;
            bool isSoldOut = false;

            if (branchId.HasValue && branchOverrides.TryGetValue(item.Id, out var o))
            {
                if (o.CustomPrice.HasValue) effectivePrice = o.CustomPrice.Value;
                isAvailable = o.IsAvailable;
                isSoldOut = o.IsSoldOut;
            }

            var categoryPath = GetCategoryPath(item.CategoryId, categoriesById);
            var rootCategory = categoryPath[^1];
            var leafCategory = categoryPath[0];
            return new MenuItemDto(
                item.Id,
                item.CategoryId,
                rootCategory.Name,
                item.Name,
                item.Slug,
                item.Description,
                item.ImageUrl,
                item.BasePrice,
                branchId.HasValue ? effectivePrice : null,
                item.PreparationTimeMinutes,
                item.IsVegetarian,
                item.IsSpicy,
                item.IsBakeryItem,
                item.AllowCustomization,
                isAvailable,
                isSoldOut,
                item.Variants.Select(variant => new MenuItemVariantDto(variant.Id, variant.VariantName, variant.AdditionalPrice, variant.IsDefault)).ToList(),
                item.AddOns.Where(addOn => addOn.AddOn != null && addOn.AddOn.IsActive).Select(addOn => new AddOnDto(addOn.AddOn!.Id, addOn.AddOn.Name, addOn.AddOn.Price, addOn.AddOn.IsActive)).ToList(),
                CategorySlug: rootCategory.Slug,
                SubCategoryId: leafCategory.Id == rootCategory.Id ? null : leafCategory.Id.ToString(),
                SubCategoryName: leafCategory.Id == rootCategory.Id ? null : leafCategory.Name,
                Rating: item.Rating,
                Reviews: item.Reviews,
                IsPopular: item.IsPopular,
                IsCustomCake: item.IsCustomCake,
                RootCategoryId: rootCategory.Id,
                RootCategorySlug: rootCategory.Slug,
                CategoryPath: string.Join(" > ", categoryPath.AsEnumerable().Reverse().Select(category => category.Name))
            );
        }).ToList();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        return Ok(new MenuItemPageDto(
            result,
            page,
            pageSize,
            totalCount,
            totalPages,
            page < totalPages));
    }

    [HttpGet("items/{id:long}")]
    public async Task<IActionResult> GetMenuItem(long id, [FromQuery] long? branchId = null)
    {
        var item = await _context.MenuItems
            .AsNoTracking()
            .Where(menuItem => menuItem.Id == id && menuItem.IsActive && menuItem.Category != null && menuItem.Category.IsActive)
            .Include(menuItem => menuItem.Variants)
            .Include(menuItem => menuItem.AddOns).ThenInclude(link => link.AddOn)
            .AsSplitQuery()
            .FirstOrDefaultAsync();
        if (item is null) return NotFound(new { message = "Menu item not found." });

        var categories = await _context.Categories.AsNoTracking().ToListAsync();
        var categoriesById = categories.ToDictionary(category => category.Id);
        var categoryPath = GetCategoryPath(item.CategoryId, categoriesById);
        if (categoryPath.Count == 0) return NotFound(new { message = "Menu item category is unavailable." });

        decimal? branchPrice = null;
        var isAvailable = true;
        var isSoldOut = false;
        if (branchId.HasValue)
        {
            if (branchId.Value <= 0 ||
                !await _context.Branches.AnyAsync(branch => branch.Id == branchId.Value && branch.IsActive))
            {
                return BadRequest(new { message = "A valid active branch ID is required." });
            }
            var branchOverride = await _context.BranchMenuItemOverrides
                .AsNoTracking()
                .FirstOrDefaultAsync(value => value.BranchId == branchId.Value && value.MenuItemId == id);
            branchPrice = branchOverride?.CustomPrice ?? item.BasePrice;
            isAvailable = branchOverride?.IsAvailableInBranch ?? true;
            isSoldOut = branchOverride?.IsSoldOutToday ?? false;
        }

        var rootCategory = categoryPath[^1];
        var leafCategory = categoryPath[0];
        return Ok(new MenuItemDto(
            item.Id,
            item.CategoryId,
            rootCategory.Name,
            item.Name,
            item.Slug,
            item.Description,
            item.ImageUrl,
            item.BasePrice,
            branchPrice,
            item.PreparationTimeMinutes,
            item.IsVegetarian,
            item.IsSpicy,
            item.IsBakeryItem,
            item.AllowCustomization,
            isAvailable,
            isSoldOut,
            item.Variants.Select(variant => new MenuItemVariantDto(
                variant.Id, variant.VariantName, variant.AdditionalPrice, variant.IsDefault)).ToList(),
            item.AddOns.Where(addOn => addOn.AddOn != null && addOn.AddOn.IsActive)
                .Select(addOn => new AddOnDto(addOn.AddOn!.Id, addOn.AddOn.Name, addOn.AddOn.Price, addOn.AddOn.IsActive))
                .ToList(),
            CategorySlug: rootCategory.Slug,
            SubCategoryId: leafCategory.Id == rootCategory.Id ? null : leafCategory.Id.ToString(),
            SubCategoryName: leafCategory.Id == rootCategory.Id ? null : leafCategory.Name,
            Rating: item.Rating,
            Reviews: item.Reviews,
            IsPopular: item.IsPopular,
            IsCustomCake: item.IsCustomCake,
            RootCategoryId: rootCategory.Id,
            RootCategorySlug: rootCategory.Slug,
            CategoryPath: string.Join(" > ", categoryPath.AsEnumerable().Reverse().Select(category => category.Name))
        ));
    }

    [HttpPost("categories")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryDto request)
    {
        var result = await _catalogService.CreateCategoryAsync(request);
        if (result.IsFailure)
            return BadRequest(new { message = result.Error });

        return CreatedAtAction(nameof(GetCategories), result.Value);
    }

    [HttpPost("items")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> CreateMenuItem([FromBody] CreateMenuItemDto request)
    {
        var result = await _catalogService.CreateMenuItemAsync(request);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return CreatedAtAction(nameof(GetMenuItems), result.Value);
    }

    private static HashSet<long> GetCategoryAndDescendantIds(long categoryId, IReadOnlyCollection<Category> categories)
    {
        var childrenByParent = categories
            .Where(category => category.ParentCategoryId.HasValue)
            .GroupBy(category => category.ParentCategoryId!.Value)
            .ToDictionary(group => group.Key, group => group.Select(category => category.Id).ToList());
        var result = new HashSet<long> { categoryId };
        var pending = new Stack<long>();
        pending.Push(categoryId);
        while (pending.TryPop(out var parentId) && childrenByParent.TryGetValue(parentId, out var children))
        {
            foreach (var childId in children)
            {
                if (result.Add(childId))
                    pending.Push(childId);
            }
        }

        return result;
    }

    private static List<Category> GetCategoryPath(
        long categoryId,
        IReadOnlyDictionary<long, Category> categoriesById)
    {
        var path = new List<Category>();
        var currentId = categoryId;
        var visited = new HashSet<long>();
        while (categoriesById.TryGetValue(currentId, out var category) && visited.Add(currentId))
        {
            path.Add(category);
            if (category.ParentCategoryId is not long parentId)
                break;
            currentId = parentId;
        }

        return path;
    }
}
