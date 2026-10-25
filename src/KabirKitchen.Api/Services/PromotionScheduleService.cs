using KabirKitchen.Domain.Enums;
using KabirKitchen.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Services;

public sealed class PromotionScheduleService
{
    public async Task<int> UpdateCampaignStatusesAsync(
        KabirKitchenDbContext db,
        DateTime nowUtc,
        CancellationToken cancellationToken = default)
    {
        if (nowUtc.Kind != DateTimeKind.Utc)
        {
            throw new ArgumentException("Schedule time must be UTC.", nameof(nowUtc));
        }

        var dueCampaigns = await db.PromotionCampaigns
            .Where(campaign =>
                (campaign.Status == PromotionStatus.Scheduled && campaign.EndDateUtc <= nowUtc) ||
                (campaign.Status == PromotionStatus.Scheduled &&
                    campaign.StartDateUtc <= nowUtc && campaign.EndDateUtc > nowUtc) ||
                (campaign.Status == PromotionStatus.Active && campaign.EndDateUtc <= nowUtc))
            .ToListAsync(cancellationToken);

        foreach (var campaign in dueCampaigns)
        {
            if (campaign.RepeatWeekly && campaign.EndDateUtc <= nowUtc)
            {
                var missedWeeks = (long)Math.Floor((nowUtc - campaign.EndDateUtc).TotalDays / 7) + 1;
                var offset = TimeSpan.FromDays(missedWeeks * 7);
                campaign.StartDateUtc = campaign.StartDateUtc.Add(offset);
                campaign.EndDateUtc = campaign.EndDateUtc.Add(offset);
                campaign.Status = campaign.StartDateUtc <= nowUtc
                    ? PromotionStatus.Active
                    : PromotionStatus.Scheduled;
            }
            else
            {
                campaign.Status = campaign.EndDateUtc <= nowUtc
                    ? PromotionStatus.Expired
                    : PromotionStatus.Active;
            }
            campaign.UpdatedAtUtc = nowUtc;
            campaign.ConcurrencyToken = Guid.NewGuid();
        }

        if (dueCampaigns.Count > 0)
        {
            await db.SaveChangesAsync(cancellationToken);
        }

        return dueCampaigns.Count;
    }
}
