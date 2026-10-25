using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Banners;
using KabirKitchen.Domain.Entities.Promotions;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace KabirKitchen.Application.Services;

public sealed class HeroBannerService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly IFileStorage _storage;

    public HeroBannerService(IApplicationDbContext dbContext, IFileStorage storage)
    {
        _dbContext = dbContext;
        _storage = storage;
    }

    public async Task<Result<IReadOnlyList<HeroBannerDto>>> GetVisibleAsync(long branchId, DateTime? now = null)
    {
        var currentTime = now ?? DateTime.UtcNow;
        var banners = await _dbContext.HeroBanners
            .AsNoTracking()
            .Include(banner => banner.PromotionCampaign)
            .Where(b => b.IsActive
                && b.StartDate <= currentTime
                && b.EndDate >= currentTime
                && (b.BranchId == null || b.BranchId == branchId)
                && (!b.PromotionCampaignId.HasValue ||
                    (b.PromotionCampaign != null
                        && (b.PromotionCampaign.Status == PromotionStatus.Active ||
                            b.PromotionCampaign.Status == PromotionStatus.Scheduled)
                        && b.PromotionCampaign.StartDateUtc <= currentTime
                        && b.PromotionCampaign.EndDateUtc > currentTime
                        && (b.PromotionCampaign.BranchId == null ||
                            b.PromotionCampaign.BranchId == branchId))))
            .OrderBy(b => b.DisplayOrder)
            .ThenBy(b => b.Id)
            .ToListAsync();

        var safeBanners = banners
            .Where(banner =>
            {
                var copy = string.Join(' ', banner.Title, banner.Subtitle, banner.ButtonText, banner.CampaignName, banner.BadgeText);
                return banner.PromotionCampaign is not null
                    ? !HasMismatchedDiscountClaim(copy, banner.PromotionCampaign)
                    : !ContainsPromotionClaim(copy);
            })
            .Select(ToDto)
            .ToList();

        return Result<IReadOnlyList<HeroBannerDto>>.Success(safeBanners);
    }

    public async Task<Result<IReadOnlyList<HeroBannerDto>>> GetAllAsync(long? branchId = null, bool includeGlobal = true)
    {
        var query = _dbContext.HeroBanners.AsNoTracking();
        if (branchId.HasValue)
        {
            query = query.Where(banner => banner.BranchId == branchId.Value ||
                (includeGlobal && banner.BranchId == null));
        }

        var banners = await query
            .Include(banner => banner.PromotionCampaign)
            .OrderBy(b => b.DisplayOrder)
            .ThenBy(b => b.Id)
            .ToListAsync();

        return Result<IReadOnlyList<HeroBannerDto>>.Success(banners.Select(ToDto).ToList());
    }

    public async Task<HeroBannerDto?> GetByIdAsync(long id)
    {
        var banner = await _dbContext.HeroBanners.AsNoTracking()
            .Include(item => item.PromotionCampaign)
            .FirstOrDefaultAsync(item => item.Id == id);
        return banner is null ? null : ToDto(banner);
    }

    public async Task<Result<HeroBannerDto>> CreateAsync(CreateHeroBannerRequestDto request, Stream? imageStream = null, string? imageFileName = null, string? imageContentType = null)
    {
        if (!IsValid(request.Title, request.Subtitle, request.ButtonText, request.ButtonLink, request.StartDate, request.EndDate, request.DisplayOrder))
        {
            return Result<HeroBannerDto>.Failure("Banner details, dates, display order, or CTA destination are invalid.");
        }
        var campaign = await ResolveCampaignAsync(
            request.PromotionCampaignId,
            request.BranchId,
            request.StartDate,
            request.EndDate,
            request.CampaignName,
            request.BadgeText,
            request.Title,
            request.Subtitle);
        if (campaign.Error is not null) return Result<HeroBannerDto>.Failure(campaign.Error);
        if (request.MediaType != BannerMediaType.Video && string.IsNullOrWhiteSpace(request.AltText))
            return Result<HeroBannerDto>.Failure("Alternative text is required for banner images.");

        var banner = new HeroBanner
        {
            Title = request.Title.Trim(),
            Subtitle = request.Subtitle.Trim(),
            ImageUrl = request.ImageUrl ?? request.MediaUrl,
            AltText = request.AltText?.Trim(),
            MediaUrl = request.MediaUrl ?? request.ImageUrl,
            MobileMediaUrl = request.MobileMediaUrl,
            PosterUrl = request.PosterUrl,
            MediaType = request.MediaType,
            ButtonText = request.ButtonText.Trim(),
            ButtonLink = request.ButtonLink,
            PromotionCampaignId = request.PromotionCampaignId,
            CampaignName = campaign.Campaign?.Name,
            BadgeText = BuildCampaignBadge(campaign.Campaign),
            DisplayOrder = request.DisplayOrder,
            IsActive = request.IsActive,
            StartDate = request.StartDate.ToUniversalTime(),
            EndDate = request.EndDate.ToUniversalTime(),
            BranchId = request.BranchId,
            TargetCategoryId = request.TargetCategoryId,
            TargetMenuItemId = request.TargetMenuItemId
        };

        if (imageStream is not null)
        {
            var storedPath = $"/api/hero-banners/images/{await _storage.SaveAsync($"hero-banner-{Guid.NewGuid():N}{Path.GetExtension(imageFileName ?? string.Empty)}", imageStream, imageContentType ?? "application/octet-stream")}";
            banner.ImageUrl = storedPath;
            banner.MediaUrl = storedPath;
        }

        _dbContext.HeroBanners.Add(banner);
        await _dbContext.SaveChangesAsync();
        banner.PromotionCampaign = campaign.Campaign;
        return Result<HeroBannerDto>.Success(ToDto(banner));
    }

    public async Task<Result<HeroBannerDto>> UpdateAsync(long id, UpdateHeroBannerRequestDto request, Stream? imageStream = null, string? imageFileName = null, string? imageContentType = null)
    {
        var banner = await _dbContext.HeroBanners.FindAsync(id);
        if (banner is null)
        {
            return Result<HeroBannerDto>.Failure("Hero banner not found.");
        }

        if (!IsValid(request.Title, request.Subtitle, request.ButtonText, request.ButtonLink, request.StartDate, request.EndDate, request.DisplayOrder))
        {
            return Result<HeroBannerDto>.Failure("Banner details, dates, display order, or CTA destination are invalid.");
        }
        var campaign = await ResolveCampaignAsync(
            request.PromotionCampaignId,
            request.BranchId,
            request.StartDate,
            request.EndDate,
            request.CampaignName,
            request.BadgeText,
            request.Title,
            request.Subtitle);
        if (campaign.Error is not null) return Result<HeroBannerDto>.Failure(campaign.Error);
        if (request.MediaType != BannerMediaType.Video && string.IsNullOrWhiteSpace(request.AltText))
            return Result<HeroBannerDto>.Failure("Alternative text is required for banner images.");

        banner.Title = request.Title.Trim();
        banner.Subtitle = request.Subtitle.Trim();
        if (!string.IsNullOrWhiteSpace(request.ImageUrl)) banner.ImageUrl = request.ImageUrl;
        if (!string.IsNullOrWhiteSpace(request.MediaUrl)) banner.MediaUrl = request.MediaUrl;
        banner.MobileMediaUrl = request.MobileMediaUrl;
        banner.PosterUrl = request.PosterUrl;
        banner.AltText = request.AltText?.Trim();
        banner.MediaType = request.MediaType;
        banner.ButtonText = request.ButtonText.Trim();
        banner.ButtonLink = request.ButtonLink;
        banner.PromotionCampaignId = request.PromotionCampaignId;
        banner.PromotionCampaign = campaign.Campaign;
        banner.CampaignName = campaign.Campaign?.Name;
        banner.BadgeText = BuildCampaignBadge(campaign.Campaign);
        banner.DisplayOrder = request.DisplayOrder;
        banner.IsActive = request.IsActive;
        banner.StartDate = request.StartDate.ToUniversalTime();
        banner.EndDate = request.EndDate.ToUniversalTime();
        banner.BranchId = request.BranchId;
        banner.TargetCategoryId = request.TargetCategoryId;
        banner.TargetMenuItemId = request.TargetMenuItemId;

        if (imageStream is not null)
        {
            var storedPath = $"/api/hero-banners/images/{await _storage.SaveAsync($"hero-banner-{Guid.NewGuid():N}{Path.GetExtension(imageFileName ?? string.Empty)}", imageStream, imageContentType ?? "application/octet-stream")}";
            banner.ImageUrl = storedPath;
            banner.MediaUrl = storedPath;
        }

        await _dbContext.SaveChangesAsync();
        return Result<HeroBannerDto>.Success(ToDto(banner));
    }

    public async Task<Result> DeleteAsync(long id)
    {
        var banner = await _dbContext.HeroBanners.FindAsync(id);
        if (banner is null)
        {
            return Result.Failure("Hero banner not found.");
        }

        _dbContext.HeroBanners.Remove(banner);
        await _dbContext.SaveChangesAsync();
        return Result.Success();
    }

    private static HeroBannerDto ToDto(HeroBanner banner) => new()
    {
        Id = banner.Id,
        Title = banner.Title,
        Subtitle = banner.Subtitle,
        ImageUrl = banner.ImageUrl ?? banner.MediaUrl ?? string.Empty,
        AltText = banner.AltText,
        MediaUrl = banner.MediaUrl ?? banner.ImageUrl ?? string.Empty,
        MobileMediaUrl = banner.MobileMediaUrl,
        PosterUrl = banner.PosterUrl,
        MediaType = banner.MediaType,
        ButtonText = banner.ButtonText,
        ButtonLink = banner.ButtonLink,
        CampaignName = banner.PromotionCampaign?.Name,
        BadgeText = BuildCampaignBadge(banner.PromotionCampaign),
        PromotionCampaignId = banner.PromotionCampaignId,
        DisplayOrder = banner.DisplayOrder,
        IsActive = banner.IsActive,
        StartDate = banner.StartDate,
        EndDate = banner.EndDate,
        BranchId = banner.BranchId,
        TargetCategoryId = banner.TargetCategoryId,
        TargetMenuItemId = banner.TargetMenuItemId
    };

    private async Task<(PromotionCampaign? Campaign, string? Error)> ResolveCampaignAsync(
        long? campaignId,
        long? bannerBranchId,
        DateTime bannerStart,
        DateTime bannerEnd,
        string? requestedCampaignName,
        string? requestedBadgeText,
        string title,
        string subtitle)
    {
        var copy = string.Join(' ', title, subtitle, requestedCampaignName, requestedBadgeText);
        if (!campaignId.HasValue)
        {
            if (!string.IsNullOrWhiteSpace(requestedCampaignName) || ContainsPromotionClaim(copy))
            {
                return (null, "Promotional banner copy must be linked to a real campaign. Clear the claim or select its campaign.");
            }
            return (null, null);
        }

        var campaign = await _dbContext.PromotionCampaigns
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == campaignId.Value);
        if (campaign is null)
            return (null, "The selected promotion campaign does not exist.");
        if (campaign.Status is PromotionStatus.Draft or PromotionStatus.Paused or PromotionStatus.Expired or PromotionStatus.Archived)
            return (null, "Only scheduled or active campaigns can be linked to a public banner.");
        if (campaign.BranchId.HasValue && bannerBranchId != campaign.BranchId)
            return (null, "The banner branch must match the selected branch-specific campaign.");
        if (bannerStart.ToUniversalTime() < campaign.StartDateUtc ||
            bannerEnd.ToUniversalTime() > campaign.EndDateUtc)
            return (null, "The banner schedule must stay within the linked campaign schedule.");
        if (HasMismatchedDiscountClaim(copy, campaign))
            return (null, "Banner discount claims must match the linked campaign discount.");

        return (campaign, null);
    }

    private static string? BuildCampaignBadge(PromotionCampaign? campaign)
    {
        if (campaign is null) return null;
        var discount = campaign.DiscountType == PromotionDiscountType.Percentage
            ? $"{campaign.DiscountValue:0.##}% OFF"
            : $"৳{campaign.DiscountValue:0.##} OFF";
        return string.IsNullOrWhiteSpace(campaign.CouponCode)
            ? discount
            : $"{discount} · CODE {campaign.CouponCode}";
    }

    private static bool ContainsPromotionClaim(string? value) =>
        !string.IsNullOrWhiteSpace(value) &&
        Regex.IsMatch(value, @"\b\d{1,3}\s*%|\b(?:off|discount|save|flat|buy\s*\d|get\s*\d)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static bool HasMismatchedDiscountClaim(string value, PromotionCampaign campaign)
    {
        var percentageClaims = Regex.Matches(value, @"(?<!\d)(\d{1,3}(?:\.\d+)?)\s*%", RegexOptions.CultureInvariant);
        if (percentageClaims.Count > 0 &&
            (campaign.DiscountType != PromotionDiscountType.Percentage ||
             percentageClaims.Cast<Match>().Any(match =>
                 decimal.Parse(match.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture) != campaign.DiscountValue)))
        {
            return true;
        }

        var fixedClaims = Regex.Matches(
            value,
            @"(?:(?:৳|BDT\s*|Tk\.?\s*)(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:off|discount|save)|(?:off|discount|save)\s*(?:of\s*)?(?:৳|BDT\s*|Tk\.?\s*)(\d+(?:,\d{3})*(?:\.\d+)?)|(?:flat|save)\s*(\d+(?:\.\d+)?)(?!\s*%)\s*(?:off)?|(\d+(?:\.\d+)?)(?!\s*%)\s*(?:off|discount))",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        return fixedClaims.Cast<Match>().Any(match =>
        {
            var amountText = match.Groups.Cast<Group>().Skip(1).First(group => group.Success).Value;
            var amount = decimal.Parse(amountText.Replace(",", string.Empty), System.Globalization.CultureInfo.InvariantCulture);
            return campaign.DiscountType != PromotionDiscountType.FixedAmount || amount != campaign.DiscountValue;
        });
    }

    private static bool IsValid(
        string title,
        string subtitle,
        string buttonText,
        string? buttonLink,
        DateTime startDate,
        DateTime endDate,
        int displayOrder)
    {
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(subtitle) ||
            string.IsNullOrWhiteSpace(buttonText) || startDate > endDate || displayOrder < 0)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(buttonLink) || buttonLink.StartsWith('#'))
        {
            return true;
        }

        return buttonLink.StartsWith('/') &&
            !buttonLink.StartsWith("//", StringComparison.Ordinal) &&
            !buttonLink.Contains('\\') &&
            !buttonLink.Any(char.IsControl);
    }
}
