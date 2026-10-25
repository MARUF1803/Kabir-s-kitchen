using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Promotions;

public sealed class PromotionEngagement : BaseEntity
{
    public long PromotionCampaignId { get; set; }
    public PromotionCampaign? PromotionCampaign { get; set; }
    public long BranchId { get; set; }
    public PromotionEngagementType Type { get; set; }
    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;
}
