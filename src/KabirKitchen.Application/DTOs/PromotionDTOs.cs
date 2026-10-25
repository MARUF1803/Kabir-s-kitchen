using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Application.DTOs;

public sealed record PromotionDto(
    long Id,
    string Name,
    string? Description,
    PromotionDiscountType DiscountType,
    decimal DiscountValue,
    decimal? MaximumDiscountAmount,
    PromotionTargetType TargetType,
    long? MenuItemId,
    long? MenuItemVariantId,
    long? CategoryId,
    long? BranchId,
    string? CouponCode,
    decimal MinimumOrderAmount,
    int? UsageLimit,
    int RedemptionCount,
    int Priority,
    bool AllowStacking,
    bool IncludeCustomCakes,
    PromotionStatus Status,
    DateTime StartDateUtc,
    DateTime EndDateUtc,
    bool RepeatWeekly = false);

public sealed record ActivePromotionDto(
    long Id,
    string Name,
    string? Description,
    PromotionDiscountType DiscountType,
    decimal DiscountValue,
    decimal? MaximumDiscountAmount,
    PromotionTargetType TargetType,
    long? MenuItemId,
    long? MenuItemVariantId,
    long? CategoryId,
    bool IncludeCustomCakes,
    decimal MinimumOrderAmount,
    DateTime EndDateUtc);

public sealed record SavePromotionRequest(
    string Name,
    string? Description,
    PromotionDiscountType DiscountType,
    decimal DiscountValue,
    decimal? MaximumDiscountAmount,
    PromotionTargetType TargetType,
    long? MenuItemId,
    long? MenuItemVariantId,
    long? CategoryId,
    long? BranchId,
    string? CouponCode,
    decimal MinimumOrderAmount,
    int? UsageLimit,
    int Priority,
    bool AllowStacking,
    bool IncludeCustomCakes,
    PromotionStatus Status,
    DateTime StartDateUtc,
    DateTime EndDateUtc,
    bool RepeatWeekly = false);

public sealed record PromotionQuoteRequest(
    long BranchId,
    OrderType OrderType,
    string? CouponCode,
    IReadOnlyList<PromotionQuoteItemRequest> Items);

public sealed record PromotionQuoteItemRequest(
    long MenuItemId,
    long? MenuItemVariantId,
    int Quantity,
    IReadOnlyList<long>? SelectedAddOnIds);

public sealed record PromotionQuoteItemDto(
    long MenuItemId,
    long? MenuItemVariantId,
    string Name,
    int Quantity,
    decimal UnitPrice,
    decimal AddOnsUnitPrice,
    decimal LineTotal);

public sealed record PromotionQuoteDto(
    long BranchId,
    OrderType OrderType,
    string? CampaignName,
    decimal SubTotal,
    decimal DiscountAmount,
    decimal TaxAmount,
    decimal DeliveryFee,
    decimal TotalAmount,
    DateTime QuotedAtUtc,
    DateTime? CampaignEndDateUtc,
    IReadOnlyList<PromotionQuoteItemDto> Items);

public sealed record PromotionReportDto(
    long CampaignId,
    string CampaignName,
    PromotionStatus Status,
    int Redemptions,
    int Orders,
    decimal Revenue,
    decimal DiscountTotal,
    long? Impressions,
    long? Clicks);

public sealed record PromotionEngagementRequest(
    long CampaignId,
    long BranchId,
    PromotionEngagementType Type);
