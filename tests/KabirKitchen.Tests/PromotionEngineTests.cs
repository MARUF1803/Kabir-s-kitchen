using FluentAssertions;
using KabirKitchen.Api.Services;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Entities.Promotions;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Enums;
using KabirKitchen.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Tests;

public sealed class PromotionEngineTests
{
    private static async Task<KabirKitchenDbContext> CreateContextAsync(params PromotionCampaign[] campaigns)
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var context = new KabirKitchenDbContext(options);
        context.PromotionCampaigns.AddRange(campaigns);
        await context.SaveChangesAsync();
        return context;
    }

    private static PromotionCampaign Campaign(
        string name,
        DateTime starts,
        DateTime ends,
        decimal value,
        int priority = 0,
        long? branchId = null) => new()
    {
        Name = name,
        DiscountType = PromotionDiscountType.Percentage,
        DiscountValue = value,
        TargetType = PromotionTargetType.AllItems,
        Status = PromotionStatus.Active,
        StartDateUtc = starts,
        EndDateUtc = ends,
        Priority = priority,
        BranchId = branchId
    };

    [Fact]
    public async Task CalculateOrderDiscountAsync_UsesHighestPriorityAndRoundsToTwoDecimals()
    {
        var now = new DateTime(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);
        await using var context = await CreateContextAsync(
            Campaign("Low priority", now.AddHours(-1), now.AddHours(1), 50m, 1),
            Campaign("Priority offer", now.AddHours(-1), now.AddHours(1), 12.345m, 10));
        var engine = new PromotionEngineService(context);

        var result = await engine.CalculateOrderDiscountAsync(
            1, 100m, [new PromotionLine(10, null, 2, 1, 100m, false)], null, now);

        result.Campaign!.Name.Should().Be("Priority offer");
        result.Discount.Should().Be(12.35m);
    }

    [Fact]
    public async Task CalculateOrderDiscountAsync_RejectsCampaignAtEndBoundary()
    {
        var now = new DateTime(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);
        await using var context = await CreateContextAsync(
            Campaign("Expired at boundary", now.AddHours(-1), now, 25m));
        var engine = new PromotionEngineService(context);

        var result = await engine.CalculateOrderDiscountAsync(
            1, 100m, [new PromotionLine(10, null, 2, 1, 100m, false)], null, now);

        result.Campaign.Should().BeNull();
        result.Discount.Should().Be(0m);
    }

    [Fact]
    public async Task CalculateOrderDiscountAsync_ExcludesCustomCakeUnlessCampaignOptsIn()
    {
        var now = new DateTime(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);
        await using var context = await CreateContextAsync(
            Campaign("Cake offer", now.AddHours(-1), now.AddHours(1), 20m));
        var engine = new PromotionEngineService(context);

        var result = await engine.CalculateOrderDiscountAsync(
            1, 100m, [new PromotionLine(10, null, 2, 1, 100m, true)], null, now);

        result.Campaign.Should().BeNull();
        result.Discount.Should().Be(0m);
    }

    [Fact]
    public async Task CalculateOrderDiscountAsync_CapsFixedCouponAndChecksBranchAndUsageLimit()
    {
        var now = new DateTime(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);
        var coupon = Campaign("Coupon", now.AddHours(-1), now.AddHours(1), 80m, 0, 3);
        coupon.DiscountType = PromotionDiscountType.FixedAmount;
        coupon.CouponCode = "SAVE80";
        coupon.UsageLimit = 1;
        coupon.RedemptionCount = 0;
        await using var context = await CreateContextAsync(coupon);
        var engine = new PromotionEngineService(context);
        var line = new[] { new PromotionLine(10, null, 2, 1, 25m, false) };

        var discount = await engine.CalculateOrderDiscountAsync(3, 25m, line, " save80 ", now);
        discount.Discount.Should().Be(25m);
        discount.Campaign!.RedemptionCount.Should().Be(1);
        await context.SaveChangesAsync();

        var usedCoupon = await engine.CalculateOrderDiscountAsync(3, 25m, line, "SAVE80", now);
        usedCoupon.Campaign.Should().BeNull();
        usedCoupon.Error.Should().NotBeNull();

        var wrongBranch = await engine.CalculateOrderDiscountAsync(4, 25m, line, "SAVE80", now);
        wrongBranch.Campaign.Should().BeNull();
        wrongBranch.Error.Should().NotBeNull();
    }

    [Fact]
    public async Task ScheduleService_RecoversDueCampaignsAndLeavesPausedCampaignsAlone()
    {
        var now = new DateTime(2026, 10, 24, 7, 0, 0, DateTimeKind.Utc);
        var due = Campaign("Due", now.AddMinutes(-1), now.AddHours(1), 10m);
        due.Status = PromotionStatus.Scheduled;
        var expired = Campaign("Expired", now.AddHours(-2), now.AddMinutes(-1), 10m);
        expired.Status = PromotionStatus.Scheduled;
        var paused = Campaign("Paused", now.AddHours(-1), now.AddHours(1), 10m);
        paused.Status = PromotionStatus.Paused;
        await using var context = await CreateContextAsync(due, expired, paused);
        var schedule = new PromotionScheduleService();

        var updated = await schedule.UpdateCampaignStatusesAsync(context, now);

        updated.Should().Be(2);
        due.Status.Should().Be(PromotionStatus.Active);
        expired.Status.Should().Be(PromotionStatus.Expired);
        paused.Status.Should().Be(PromotionStatus.Paused);
        (await schedule.UpdateCampaignStatusesAsync(context, now)).Should().Be(0);
    }

    [Fact]
    public async Task ScheduleService_AdvancesWeeklyCampaignToCurrentOccurrenceAfterDowntime()
    {
        var start = new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc);
        var end = start.AddHours(2);
        var now = new DateTime(2026, 10, 24, 7, 0, 0, DateTimeKind.Utc);
        var recurring = Campaign("Weekly", start, end, 10m);
        recurring.Status = PromotionStatus.Active;
        recurring.RepeatWeekly = true;
        await using var context = await CreateContextAsync(recurring);
        var schedule = new PromotionScheduleService();

        var updated = await schedule.UpdateCampaignStatusesAsync(context, now);

        updated.Should().Be(1);
        recurring.StartDateUtc.Should().Be(new DateTime(2026, 10, 29, 12, 0, 0, DateTimeKind.Utc));
        recurring.EndDateUtc.Should().Be(new DateTime(2026, 10, 29, 14, 0, 0, DateTimeKind.Utc));
        recurring.Status.Should().Be(PromotionStatus.Scheduled);
        (await schedule.UpdateCampaignStatusesAsync(context, now)).Should().Be(0);
    }

    [Fact]
    public async Task RecordEngagementAsync_TracksCampaignEventsForEligibleBranch()
    {
        var now = new DateTime(2026, 10, 24, 7, 0, 0, DateTimeKind.Utc);
        var campaign = Campaign("Tracked campaign", now.AddHours(-1), now.AddHours(1), 10m);
        await using var context = await CreateContextAsync(campaign);
        context.Branches.Add(new Branch { Id = 1, Name = "Test Branch", BranchCode = "TST", IsActive = true });
        await context.SaveChangesAsync();
        var engine = new PromotionEngineService(context);

        (await engine.RecordEngagementAsync(
            new PromotionEngagementRequest(campaign.Id, 1, PromotionEngagementType.Impression), now)).Should().BeTrue();
        (await engine.RecordEngagementAsync(
            new PromotionEngagementRequest(campaign.Id, 1, PromotionEngagementType.Click), now)).Should().BeTrue();
        (await engine.RecordEngagementAsync(
            new PromotionEngagementRequest(campaign.Id, 2, PromotionEngagementType.Click), now)).Should().BeFalse();

        var report = (await engine.GetReportsAsync()).Single();
        report.Impressions.Should().Be(1);
        report.Clicks.Should().Be(1);
    }
}
