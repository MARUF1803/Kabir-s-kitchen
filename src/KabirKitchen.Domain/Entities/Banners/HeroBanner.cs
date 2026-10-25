using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Promotions;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Banners;

public sealed class HeroBanner : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public string? ImageUrl { get; set; } // Backward compatible
    public string? AltText { get; set; }
    public string? MediaUrl { get; set; } // Image or Video URL
    public string? MobileMediaUrl { get; set; } // Mobile variant
    public string? PosterUrl { get; set; } // Video poster / preview fallback
    public BannerMediaType MediaType { get; set; } = BannerMediaType.Image;

    public string ButtonText { get; set; } = string.Empty;
    public string? ButtonLink { get; set; }
    public string? CampaignName { get; set; }
    public string? BadgeText { get; set; }

    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public long? BranchId { get; set; }
    public Branch? Branch { get; set; }

    public long? PromotionCampaignId { get; set; }
    public PromotionCampaign? PromotionCampaign { get; set; }
    public long? TargetCategoryId { get; set; }
    public long? TargetMenuItemId { get; set; }
}
