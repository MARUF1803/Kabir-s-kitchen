using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Entities.Promotions;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public sealed class PromotionEngineService
{
    private readonly IApplicationDbContext _context;

    public PromotionEngineService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<PromotionDto>> GetAllAsync(long? branchId, bool includeGlobal)
    {
        var query = _context.PromotionCampaigns.AsNoTracking();
        if (includeGlobal)
        {
            if (branchId.HasValue)
                query = query.Where(c => c.BranchId == null || c.BranchId == branchId);
        }
        else if (branchId.HasValue)
        {
            query = query.Where(c => c.BranchId == branchId);
        }

        return await query
            .OrderByDescending(c => c.Priority)
            .ThenByDescending(c => c.StartDateUtc)
            .Select(c => ToDto(c))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<ActivePromotionDto>> GetActiveAsync(long branchId, DateTime? utcNow = null)
    {
        var now = utcNow ?? DateTime.UtcNow;
        return await _context.PromotionCampaigns
            .AsNoTracking()
            .Where(c => (c.Status == PromotionStatus.Active || c.Status == PromotionStatus.Scheduled)
                && c.StartDateUtc <= now
                && c.EndDateUtc > now
                && (c.BranchId == null || c.BranchId == branchId)
                && string.IsNullOrEmpty(c.CouponCode)
                && (!c.UsageLimit.HasValue || c.RedemptionCount < c.UsageLimit.Value))
            .OrderByDescending(c => c.Priority)
            .ThenBy(c => c.Id)
            .Select(c => new ActivePromotionDto(
                c.Id,
                c.Name,
                c.Description,
                c.DiscountType,
                c.DiscountValue,
                c.MaximumDiscountAmount,
                c.TargetType,
                c.MenuItemId,
                c.MenuItemVariantId,
                c.CategoryId,
                c.IncludeCustomCakes,
                c.MinimumOrderAmount,
                DateTime.SpecifyKind(c.EndDateUtc, DateTimeKind.Utc)))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<PromotionReportDto>> GetReportsAsync(long? branchId = null)
    {
        var campaigns = await _context.PromotionCampaigns
            .AsNoTracking()
            .Where(campaign => !branchId.HasValue || campaign.BranchId == null || campaign.BranchId == branchId)
            .OrderByDescending(campaign => campaign.StartDateUtc)
            .ToListAsync();
        var orderMetrics = await _context.Orders
            .Where(order => order.PromotionCampaignId.HasValue &&
                !order.IsVoid &&
                order.Status != OrderStatus.Cancelled &&
                (!branchId.HasValue || order.BranchId == branchId.Value))
            .GroupBy(order => order.PromotionCampaignId!.Value)
            .Select(group => new
            {
                CampaignId = group.Key,
                Orders = group.Count(),
                Revenue = group.Sum(order => order.TotalAmount),
                DiscountTotal = group.Sum(order => order.DiscountAmount)
            })
            .ToDictionaryAsync(metric => metric.CampaignId);
        var engagementMetrics = await _context.PromotionEngagements
            .Where(engagement => !branchId.HasValue || engagement.BranchId == branchId.Value)
            .GroupBy(engagement => new { engagement.PromotionCampaignId, engagement.Type })
            .Select(group => new
            {
                CampaignId = group.Key.PromotionCampaignId,
                Type = group.Key.Type,
                Count = group.LongCount()
            })
            .ToListAsync();

        return campaigns.Select(campaign =>
        {
            orderMetrics.TryGetValue(campaign.Id, out var metric);
            var impressions = engagementMetrics
                .Where(item => item.CampaignId == campaign.Id && item.Type == PromotionEngagementType.Impression)
                .Sum(item => item.Count);
            var clicks = engagementMetrics
                .Where(item => item.CampaignId == campaign.Id && item.Type == PromotionEngagementType.Click)
                .Sum(item => item.Count);
            return new PromotionReportDto(
                campaign.Id,
                campaign.Name,
                campaign.Status,
                campaign.RedemptionCount,
                metric?.Orders ?? 0,
                metric?.Revenue ?? 0m,
                metric?.DiscountTotal ?? 0m,
                impressions,
                clicks);
        }).ToList();
    }

    public async Task<bool> RecordEngagementAsync(PromotionEngagementRequest request, DateTime? utcNow = null)
    {
        if (request.CampaignId <= 0 || request.BranchId <= 0 || !Enum.IsDefined(request.Type))
            return false;

        var now = utcNow ?? DateTime.UtcNow;
        var eligible = await _context.PromotionCampaigns.AnyAsync(campaign =>
            campaign.Id == request.CampaignId &&
            (campaign.Status == PromotionStatus.Active || campaign.Status == PromotionStatus.Scheduled) &&
            campaign.StartDateUtc <= now &&
            campaign.EndDateUtc > now &&
            (campaign.BranchId == null || campaign.BranchId == request.BranchId));
        if (!eligible) return false;

        var branchIsActive = await _context.Branches.AnyAsync(branch =>
            branch.Id == request.BranchId && branch.IsActive && !branch.IsDeleted);
        if (!branchIsActive) return false;

        _context.PromotionEngagements.Add(new PromotionEngagement
        {
            PromotionCampaignId = request.CampaignId,
            BranchId = request.BranchId,
            Type = request.Type,
            OccurredAtUtc = now
        });
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<(PromotionCampaign? Campaign, decimal Discount, string? Error)> CalculateOrderDiscountAsync(
        long branchId,
        decimal orderSubtotal,
        IReadOnlyCollection<PromotionLine> lines,
        string? couponCode,
        DateTime? utcNow = null,
        bool reserveRedemption = true)
    {
        var now = utcNow ?? DateTime.UtcNow;
        var normalizedCode = string.IsNullOrWhiteSpace(couponCode) ? null : couponCode.Trim().ToUpperInvariant();
        var candidates = await _context.PromotionCampaigns
            .Where(c => (c.Status == PromotionStatus.Active || c.Status == PromotionStatus.Scheduled)
                && c.StartDateUtc <= now
                && c.EndDateUtc > now
                && (c.BranchId == null || c.BranchId == branchId)
                && (normalizedCode == null
                    ? string.IsNullOrEmpty(c.CouponCode)
                    : c.CouponCode == normalizedCode)
                && (!c.UsageLimit.HasValue || c.RedemptionCount < c.UsageLimit.Value))
            .OrderByDescending(c => c.Priority)
            .ThenBy(c => c.Id)
            .ToListAsync();

        if (normalizedCode is not null && candidates.Count == 0)
        {
            return (null, 0m, "Coupon is invalid, expired, unavailable, or not eligible for this branch.");
        }

        foreach (var campaign in candidates)
        {
            if (orderSubtotal < campaign.MinimumOrderAmount)
            {
                continue;
            }

            var eligibleSubtotal = lines
                .Where(line => Matches(campaign, line))
                .Sum(line => line.EligibleUnitPrice * line.Quantity);
            if (eligibleSubtotal <= 0)
            {
                continue;
            }

            var rawDiscount = campaign.DiscountType switch
            {
                PromotionDiscountType.Percentage => decimal.Round(
                    eligibleSubtotal * campaign.DiscountValue / 100m, 2, MidpointRounding.AwayFromZero),
                PromotionDiscountType.FixedAmount => campaign.DiscountValue,
                _ => 0m
            };

            if (campaign.MaximumDiscountAmount.HasValue)
            {
                rawDiscount = Math.Min(rawDiscount, campaign.MaximumDiscountAmount.Value);
            }

            var discount = Math.Min(Math.Max(0m, rawDiscount), eligibleSubtotal);
            if (discount == 0m)
            {
                continue;
            }

            if (reserveRedemption)
            {
                campaign.RedemptionCount++;
                campaign.ConcurrencyToken = Guid.NewGuid();
            }
            return (campaign, discount, null);
        }

        return normalizedCode is null
            ? (null, 0m, null)
            : (null, 0m, "Coupon does not apply to any items in this order or the minimum spend was not met.");
    }

    public async Task<PromotionDto?> GetByIdAsync(long id)
    {
        var campaign = await _context.PromotionCampaigns.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        return campaign is null ? null : ToDto(campaign);
    }

    public async Task<PromotionDto> CreateAsync(SavePromotionRequest request, string? actor)
    {
        var error = await ValidateAsync(request);
        if (error is not null) throw new ArgumentException(error);

        var campaign = FromRequest(request);
        campaign.CreatedBy = actor;
        _context.PromotionCampaigns.Add(campaign);
        await _context.SaveChangesAsync();
        return ToDto(campaign);
    }

    public async Task<PromotionDto?> UpdateAsync(long id, SavePromotionRequest request, string? actor)
    {
        var error = await ValidateAsync(request, id);
        if (error is not null) throw new ArgumentException(error);

        var campaign = await _context.PromotionCampaigns.FirstOrDefaultAsync(c => c.Id == id);
        if (campaign is null) return null;

        CopyRequest(campaign, request);
        campaign.UpdatedBy = actor;
        campaign.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return ToDto(campaign);
    }

    public async Task<bool> ChangeStatusAsync(long id, PromotionStatus status, string? actor)
    {
        var campaign = await _context.PromotionCampaigns.FirstOrDefaultAsync(c => c.Id == id);
        if (campaign is null) return false;
        campaign.Status = status;
        campaign.UpdatedBy = actor;
        campaign.UpdatedAtUtc = DateTime.UtcNow;
        campaign.ConcurrencyToken = Guid.NewGuid();
        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<string?> ValidateAsync(SavePromotionRequest request, long? currentId = null)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 160)
            return "Campaign name is required and must be at most 160 characters.";
        if (!Enum.IsDefined(request.DiscountType) ||
            !Enum.IsDefined(request.TargetType) ||
            !Enum.IsDefined(request.Status))
            return "Campaign type, target, and status must be valid values.";
        if (request.DiscountValue <= 0 ||
            (request.DiscountType == PromotionDiscountType.Percentage && request.DiscountValue > 100))
            return "Discount must be greater than zero and a percentage cannot exceed 100.";
        if (request.MaximumDiscountAmount < 0 || request.MinimumOrderAmount < 0)
            return "Maximum discount and minimum order amount cannot be negative.";
        if (request.StartDateUtc.Kind == DateTimeKind.Unspecified || request.EndDateUtc.Kind == DateTimeKind.Unspecified ||
            request.StartDateUtc >= request.EndDateUtc)
            return "Campaign dates must include a timezone and the start must be before the end.";
        if (request.UsageLimit is <= 0)
            return "Usage limit must be greater than zero when specified.";
        if (request.AllowStacking)
            return "Promotion stacking is disabled; only the highest-priority eligible campaign can apply.";

        var code = NormalizeCode(request.CouponCode);
        if (code is not null && await _context.PromotionCampaigns.AnyAsync(c => c.Id != currentId && c.CouponCode == code))
            return "A campaign already uses this coupon code.";

        if (request.TargetType == PromotionTargetType.Product &&
            (!request.MenuItemId.HasValue || !await _context.MenuItems.AnyAsync(p => p.Id == request.MenuItemId && p.IsActive)))
            return "Select an active menu product for this campaign.";
        if (request.TargetType == PromotionTargetType.Variant &&
            (!request.MenuItemVariantId.HasValue || !await _context.MenuItemVariants.AnyAsync(v => v.Id == request.MenuItemVariantId)))
            return "Select a valid menu variant for this campaign.";
        if (request.TargetType == PromotionTargetType.Category &&
            (!request.CategoryId.HasValue || !await _context.Categories.AnyAsync(c => c.Id == request.CategoryId && c.IsActive)))
            return "Select an active category for this campaign.";
        if (request.BranchId.HasValue && !await _context.Branches.AnyAsync(b => b.Id == request.BranchId && b.IsActive))
            return "Select an active branch for this campaign.";

        return null;
    }

    private static bool Matches(PromotionCampaign campaign, PromotionLine line)
    {
        if (line.IsCustomCake && !campaign.IncludeCustomCakes) return false;
        return campaign.TargetType switch
        {
            PromotionTargetType.AllItems => true,
            PromotionTargetType.Product => campaign.MenuItemId == line.MenuItemId,
            PromotionTargetType.Variant => campaign.MenuItemVariantId == line.MenuItemVariantId,
            PromotionTargetType.Category => campaign.CategoryId == line.CategoryId,
            _ => false
        };
    }

    private static PromotionCampaign FromRequest(SavePromotionRequest request)
    {
        var campaign = new PromotionCampaign();
        CopyRequest(campaign, request);
        return campaign;
    }

    private static void CopyRequest(PromotionCampaign campaign, SavePromotionRequest request)
    {
        campaign.Name = request.Name.Trim();
        campaign.Description = request.Description?.Trim();
        campaign.DiscountType = request.DiscountType;
        campaign.DiscountValue = request.DiscountValue;
        campaign.MaximumDiscountAmount = request.MaximumDiscountAmount;
        campaign.TargetType = request.TargetType;
        campaign.MenuItemId = request.MenuItemId;
        campaign.MenuItemVariantId = request.MenuItemVariantId;
        campaign.CategoryId = request.CategoryId;
        campaign.BranchId = request.BranchId;
        campaign.CouponCode = NormalizeCode(request.CouponCode);
        campaign.MinimumOrderAmount = request.MinimumOrderAmount;
        campaign.UsageLimit = request.UsageLimit;
        campaign.Priority = request.Priority;
        campaign.AllowStacking = request.AllowStacking;
        campaign.IncludeCustomCakes = request.IncludeCustomCakes;
        campaign.RepeatWeekly = request.RepeatWeekly;
        campaign.Status = request.Status;
        campaign.StartDateUtc = request.StartDateUtc.ToUniversalTime();
        campaign.EndDateUtc = request.EndDateUtc.ToUniversalTime();
        campaign.ConcurrencyToken = Guid.NewGuid();
    }

    private static string? NormalizeCode(string? code)
    {
        var normalized = string.IsNullOrWhiteSpace(code) ? null : code.Trim().ToUpperInvariant();
        return normalized;
    }

    private static PromotionDto ToDto(PromotionCampaign campaign) => new(
        campaign.Id,
        campaign.Name,
        campaign.Description,
        campaign.DiscountType,
        campaign.DiscountValue,
        campaign.MaximumDiscountAmount,
        campaign.TargetType,
        campaign.MenuItemId,
        campaign.MenuItemVariantId,
        campaign.CategoryId,
        campaign.BranchId,
        campaign.CouponCode,
        campaign.MinimumOrderAmount,
        campaign.UsageLimit,
        campaign.RedemptionCount,
        campaign.Priority,
        campaign.AllowStacking,
        campaign.IncludeCustomCakes,
        campaign.Status,
        DateTime.SpecifyKind(campaign.StartDateUtc, DateTimeKind.Utc),
        DateTime.SpecifyKind(campaign.EndDateUtc, DateTimeKind.Utc),
        campaign.RepeatWeekly);
}

public sealed record PromotionLine(
    long MenuItemId,
    long? MenuItemVariantId,
    long CategoryId,
    int Quantity,
    decimal EligibleUnitPrice,
    bool IsCustomCake);
