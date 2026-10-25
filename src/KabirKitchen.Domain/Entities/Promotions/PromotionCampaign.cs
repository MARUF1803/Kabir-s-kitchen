using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Promotions;

public sealed class PromotionCampaign : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public PromotionDiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal? MaximumDiscountAmount { get; set; }
    public PromotionTargetType TargetType { get; set; }
    public long? MenuItemId { get; set; }
    public long? MenuItemVariantId { get; set; }
    public long? CategoryId { get; set; }
    public long? BranchId { get; set; }
    public string? CouponCode { get; set; }
    public decimal MinimumOrderAmount { get; set; }
    public int? UsageLimit { get; set; }
    public int RedemptionCount { get; set; }
    public int Priority { get; set; }
    public bool AllowStacking { get; set; }
    public bool IncludeCustomCakes { get; set; }
    public bool RepeatWeekly { get; set; }
    public PromotionStatus Status { get; set; } = PromotionStatus.Draft;
    public DateTime StartDateUtc { get; set; }
    public DateTime EndDateUtc { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
}
