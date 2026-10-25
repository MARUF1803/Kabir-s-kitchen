namespace KabirKitchen.Application.DTOs;

public record CategoryDto(
    long Id,
    string Name,
    string Slug,
    string? Description,
    string? ImageUrl,
    int DisplayOrder,
    bool IsActive,
    string Icon = "🍽️",
    List<SubCategoryDto>? SubCategories = null
);

/// <summary>Represents a menu subcategory.</summary>
public sealed record SubCategoryDto(
    string Id,
    string Name,
    string Slug,
    long CategoryId,
    List<SubCategoryDto>? Children = null);

/// <summary>Represents one page of menu products.</summary>
public sealed record MenuItemPageDto(
    IReadOnlyList<MenuItemDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    bool HasNextPage);

/// <summary>Request to add a category under an optional parent category.</summary>
public sealed record CreateCategoryDto(
    string Name,
    string Slug,
    long? ParentCategoryId,
    string? Description,
    string? ImageUrl,
    string Icon,
    int DisplayOrder);

public record MenuItemVariantDto(
    long Id,
    string VariantName,
    decimal AdditionalPrice,
    bool IsDefault
);

public record AddOnDto(
    long Id,
    string Name,
    decimal Price,
    bool IsActive
);

public record MenuItemDto(
    long Id,
    long CategoryId,
    string CategoryName,
    string Name,
    string Slug,
    string? Description,
    string? ImageUrl,
    decimal BasePrice,
    decimal? BranchPrice, // Computed based on current branch override
    int PreparationTimeMinutes,
    bool IsVegetarian,
    bool IsSpicy,
    bool IsBakeryItem,
    bool AllowCustomization,
    bool IsAvailable,
    bool IsSoldOutToday,
    List<MenuItemVariantDto> Variants,
    List<AddOnDto> AddOns,
    decimal? CalculatedFoodCostPercent = null,
    string CategorySlug = "",
    string? SubCategoryId = null,
    string? SubCategoryName = null,
    decimal Rating = 0,
    int Reviews = 0,
    bool IsPopular = false,
    bool IsCustomCake = false,
    long? RootCategoryId = null,
    string? RootCategorySlug = null,
    string? CategoryPath = null
);

public record CreateMenuItemDto(
    long CategoryId,
    string Name,
    string Slug,
    string? Description,
    string? ImageUrl,
    decimal BasePrice,
    int PreparationTimeMinutes,
    bool IsVegetarian,
    bool IsSpicy,
    bool IsBakeryItem,
    bool AllowCustomization,
    List<MenuItemVariantDto>? Variants,
    List<long>? AddOnIds
);
