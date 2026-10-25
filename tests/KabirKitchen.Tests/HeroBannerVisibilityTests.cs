using FluentAssertions;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Entities.Banners;
using KabirKitchen.Domain.Entities.Promotions;
using KabirKitchen.Domain.Enums;
using KabirKitchen.Infrastructure.Persistence;
using KabirKitchen.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Tests;

public class HeroBannerVisibilityTests
{
    [Fact]
    public async Task GetVisibleAsync_ShouldReturnOnlyActiveScheduledGlobalOrBranchBanners()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var dbContext = new KabirKitchenDbContext(options);
        var now = new DateTime(2026, 10, 9, 12, 0, 0, DateTimeKind.Utc);
        dbContext.HeroBanners.AddRange(
            new HeroBanner { Title = "Global", IsActive = true, StartDate = now.AddDays(-1), EndDate = now.AddDays(1), DisplayOrder = 2, BranchId = null },
            new HeroBanner { Title = "Branch", IsActive = true, StartDate = now.AddDays(-1), EndDate = now.AddDays(1), DisplayOrder = 1, BranchId = 1 },
            new HeroBanner { Title = "Other branch", IsActive = true, StartDate = now.AddDays(-1), EndDate = now.AddDays(1), DisplayOrder = 0, BranchId = 2 },
            new HeroBanner { Title = "Expired", IsActive = true, StartDate = now.AddDays(-2), EndDate = now.AddDays(-1), DisplayOrder = 0, BranchId = null },
            new HeroBanner { Title = "Inactive", IsActive = false, StartDate = now.AddDays(-1), EndDate = now.AddDays(1), DisplayOrder = 0, BranchId = null },
            new HeroBanner { Title = "Legacy offer", Subtitle = "Flat 20% OFF", IsActive = true, StartDate = now.AddDays(-1), EndDate = now.AddDays(1), DisplayOrder = 0, BranchId = null });
        await dbContext.SaveChangesAsync();

        var service = new HeroBannerService(dbContext, new LocalFileStorage());
        var result = await service.GetVisibleAsync(1, now);

        result.IsSuccess.Should().BeTrue();
        result.Value.Select(b => b.Title).Should().Equal("Branch", "Global");
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectPromotionalClaimsWithoutCampaign()
    {
        var service = CreateService(out var dbContext);
        await using (dbContext)
        {
            var result = await service.CreateAsync(CreateRequest(title: "Flat 20% OFF"));

            result.IsSuccess.Should().BeFalse();
            result.Error.Should().Contain("linked to a real campaign");
        }
    }

    [Fact]
    public async Task CreateAsync_ShouldDeriveBannerBadgeFromCampaignAndRejectFalseClaims()
    {
        var service = CreateService(out var dbContext);
        await using (dbContext)
        {
            var now = DateTime.UtcNow;
            dbContext.PromotionCampaigns.Add(new PromotionCampaign
            {
                Name = "Weekend offer",
                DiscountType = PromotionDiscountType.Percentage,
                DiscountValue = 20,
                TargetType = PromotionTargetType.AllItems,
                Status = PromotionStatus.Active,
                StartDateUtc = now.AddDays(-1),
                EndDateUtc = now.AddDays(2)
            });
            await dbContext.SaveChangesAsync();

            var matching = await service.CreateAsync(CreateRequest(
                title: "Weekend offer",
                campaignId: 1,
                badgeText: "20% OFF"));
            matching.IsSuccess.Should().BeTrue();
            matching.Value.BadgeText.Should().Be("20% OFF");
            matching.Value.CampaignName.Should().Be("Weekend offer");

            var mismatched = await service.CreateAsync(CreateRequest(
                title: "Save 50% on meals",
                campaignId: 1));
            mismatched.IsSuccess.Should().BeFalse();
            mismatched.Error.Should().Contain("must match");
        }
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectFixedDiscountClaimThatDiffersFromCampaign()
    {
        var service = CreateService(out var dbContext);
        await using (dbContext)
        {
            var now = DateTime.UtcNow;
            dbContext.PromotionCampaigns.Add(new PromotionCampaign
            {
                Name = "Fixed deal",
                DiscountType = PromotionDiscountType.FixedAmount,
                DiscountValue = 100,
                TargetType = PromotionTargetType.AllItems,
                Status = PromotionStatus.Active,
                StartDateUtc = now.AddDays(-1),
                EndDateUtc = now.AddDays(2)
            });
            await dbContext.SaveChangesAsync();

            var result = await service.CreateAsync(CreateRequest(
                title: "Flat ৳50 OFF",
                campaignId: 1));

            result.IsSuccess.Should().BeFalse();
            result.Error.Should().Contain("must match");
        }
    }

    [Theory]
    [InlineData("https://example.com/offer")]
    [InlineData("//example.com/offer")]
    [InlineData("javascript:alert(1)")]
    public async Task CreateAsync_ShouldRejectUnsafeCtaDestinations(string destination)
    {
        var service = CreateService(out var dbContext);
        await using (dbContext)
        {
            var request = CreateRequest(title: "Freshly prepared favorites");
            request.ButtonLink = destination;

            var result = await service.CreateAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Error.Should().Contain("CTA destination");
        }
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectBannerScheduledOutsideCampaignDates()
    {
        var service = CreateService(out var dbContext);
        await using (dbContext)
        {
            var now = DateTime.UtcNow;
            dbContext.PromotionCampaigns.Add(new PromotionCampaign
            {
                Name = "Limited campaign",
                DiscountType = PromotionDiscountType.Percentage,
                DiscountValue = 15,
                TargetType = PromotionTargetType.AllItems,
                Status = PromotionStatus.Scheduled,
                StartDateUtc = now.AddDays(-1),
                EndDateUtc = now.AddHours(12)
            });
            await dbContext.SaveChangesAsync();

            var request = CreateRequest(title: "Limited campaign", campaignId: 1);
            request.EndDate = now.AddDays(1);

            var result = await service.CreateAsync(request);

            result.IsSuccess.Should().BeFalse();
            result.Error.Should().Contain("within the linked campaign schedule");
        }
    }

    private static HeroBannerService CreateService(out KabirKitchenDbContext dbContext)
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        dbContext = new KabirKitchenDbContext(options);
        return new HeroBannerService(dbContext, new LocalFileStorage());
    }

    private static CreateHeroBannerRequestDto CreateRequest(
        string title,
        long? campaignId = null,
        string? badgeText = null)
    {
        var now = DateTime.UtcNow;
        return new CreateHeroBannerRequestDto
        {
            Title = title,
            Subtitle = "A fresh menu for your table.",
            ButtonText = "Browse menu",
            ButtonLink = "#menu",
            MediaType = BannerMediaType.Image,
            ImageUrl = "/images/menu.jpg",
            AltText = "Freshly prepared menu",
            PromotionCampaignId = campaignId,
            BadgeText = badgeText,
            StartDate = now.AddHours(-1),
            EndDate = now.AddDays(1)
        };
    }
}
