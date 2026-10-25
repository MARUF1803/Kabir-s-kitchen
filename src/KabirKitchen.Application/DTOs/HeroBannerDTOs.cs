using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Application.DTOs;

public sealed class HeroBannerDto
{
    public long Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public string? AltText { get; set; }
    public string? MediaUrl { get; set; }
    public string? MobileMediaUrl { get; set; }
    public string? PosterUrl { get; set; }
    public BannerMediaType MediaType { get; set; } = BannerMediaType.Image;
    public string ButtonText { get; set; } = string.Empty;
    public string? ButtonLink { get; set; }
    public string? CampaignName { get; set; }
    public string? BadgeText { get; set; }
    public long? PromotionCampaignId { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public long? BranchId { get; set; }
    public long? TargetCategoryId { get; set; }
    public long? TargetMenuItemId { get; set; }
}

public sealed class CreateHeroBannerRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string? AltText { get; set; }
    public string? MediaUrl { get; set; }
    public string? MobileMediaUrl { get; set; }
    public string? PosterUrl { get; set; }
    public BannerMediaType MediaType { get; set; } = BannerMediaType.Image;
    public string ButtonText { get; set; } = string.Empty;
    public string? ButtonLink { get; set; }
    public string? CampaignName { get; set; }
    public string? BadgeText { get; set; }
    public long? PromotionCampaignId { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public long? BranchId { get; set; }
    public long? TargetCategoryId { get; set; }
    public long? TargetMenuItemId { get; set; }
}

public sealed class UpdateHeroBannerRequestDto
{
    public string Title { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string? AltText { get; set; }
    public string? MediaUrl { get; set; }
    public string? MobileMediaUrl { get; set; }
    public string? PosterUrl { get; set; }
    public BannerMediaType MediaType { get; set; } = BannerMediaType.Image;
    public string ButtonText { get; set; } = string.Empty;
    public string? ButtonLink { get; set; }
    public string? CampaignName { get; set; }
    public string? BadgeText { get; set; }
    public long? PromotionCampaignId { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public long? BranchId { get; set; }
    public long? TargetCategoryId { get; set; }
    public long? TargetMenuItemId { get; set; }
}
