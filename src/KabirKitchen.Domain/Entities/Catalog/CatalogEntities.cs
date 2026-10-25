using KabirKitchen.Domain.Common;

namespace KabirKitchen.Domain.Entities.Catalog;

public class Category : BaseEntity, ISoftDelete
{
    public long? ParentCategoryId { get; set; }
    public Category? ParentCategory { get; set; }
    public ICollection<Category> Children { get; set; } = new List<Category>();

    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string Icon { get; set; } = "🍽️";
    public int DisplayOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public string? DeletedBy { get; set; }

    public ICollection<MenuItem> MenuItems { get; set; } = new List<MenuItem>();
}

public class MenuItem : BaseEntity, ISoftDelete
{
    public long CategoryId { get; set; }
    public Category? Category { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? SubCategorySlug { get; set; }
    public string? SubCategoryName { get; set; }
    public decimal BasePrice { get; set; }
    public int PreparationTimeMinutes { get; set; } = 15;
    public decimal Rating { get; set; }
    public int Reviews { get; set; }

    public bool IsVegetarian { get; set; } = false;
    public bool IsSpicy { get; set; } = false;
    public bool IsBakeryItem { get; set; } = false;
    public bool AllowCustomization { get; set; } = false;
    public bool IsCustomCake { get; set; } = false;
    public bool IsPopular { get; set; } = false;
    public bool IsActive { get; set; } = true;

    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public string? DeletedBy { get; set; }

    // Navigations
    public ICollection<MenuItemVariant> Variants { get; set; } = new List<MenuItemVariant>();
    public ICollection<MenuItemAddOn> AddOns { get; set; } = new List<MenuItemAddOn>();
}

public class MenuItemVariant : BaseEntity
{
    public long MenuItemId { get; set; }
    public MenuItem? MenuItem { get; set; }

    public string VariantName { get; set; } = string.Empty; // e.g., "Regular", "Large", "1:1", "1:2", "1kg", "2kg"
    public decimal AdditionalPrice { get; set; } = 0; // Or absolute price
    public bool IsDefault { get; set; } = false;
}

public class AddOn : BaseEntity
{
    public string Name { get; set; } = string.Empty; // e.g. "Extra Cheese", "Extra Patty", "Chili Sauce"
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
}

public class MenuItemAddOn
{
    public long MenuItemId { get; set; }
    public MenuItem? MenuItem { get; set; }

    public long AddOnId { get; set; }
    public AddOn? AddOn { get; set; }
}
