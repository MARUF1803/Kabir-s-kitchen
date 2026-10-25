using FluentAssertions;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Entities.Bakery;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Promotions;
using KabirKitchen.Domain.Enums;
using KabirKitchen.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Tests;

public sealed class CustomCakePromotionTests
{
    [Fact]
    public async Task CustomCakeOffer_IsAppliedBeforeCalculatingRequiredAdvance_AndPriceIsServerOwned()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var context = new KabirKitchenDbContext(options);

        var now = DateTime.UtcNow;
        context.Branches.Add(new Branch { Id = 1, BranchCode = "DHN-01", Name = "Dhanmondi", IsActive = true });
        context.MenuItems.Add(new MenuItem
        {
            Id = 10,
            CategoryId = 2,
            Name = "Custom Cake",
            Slug = "custom-cake",
            BasePrice = 1000m,
            IsActive = true,
            IsCustomCake = true
        });
        context.PromotionCampaigns.Add(new PromotionCampaign
        {
            Name = "Cake 20% offer",
            DiscountType = PromotionDiscountType.Percentage,
            DiscountValue = 20m,
            TargetType = PromotionTargetType.AllItems,
            IncludeCustomCakes = true,
            Status = PromotionStatus.Active,
            StartDateUtc = now.AddDays(-1),
            EndDateUtc = now.AddDays(1),
            ConcurrencyToken = Guid.NewGuid()
        });
        await context.SaveChangesAsync();

        var service = new CakeOrderService(context);
        var quote = await service.QuoteCustomCakeAsync(new QuoteCustomCakeRequestDto(1, 10, 1m, null));

        quote.IsSuccess.Should().BeTrue();
        quote.Value!.SubTotal.Should().Be(1000m);
        quote.Value.DiscountAmount.Should().Be(200m);
        quote.Value.EstimatedPrice.Should().Be(800m);
        quote.Value.AdvanceRequiredAmount.Should().Be(400m);
        (await context.PromotionCampaigns.SingleAsync()).RedemptionCount.Should().Be(0);

        var created = await service.CreateCakeRequestAsync(new CreateCustomCakeRequestDto(
            1,
            "Customer",
            "01700000000",
            null,
            1m,
            "Chocolate",
            "Fresh Cream",
            "1 Tier",
            null,
            "Happy Birthday",
            null,
            DateTime.UtcNow.AddDays(1),
            "04:00 PM - 06:00 PM",
            10,
            null));

        created.IsSuccess.Should().BeTrue();
        created.Value!.SubTotal.Should().Be(1000m);
        created.Value.DiscountAmount.Should().Be(200m);
        created.Value.EstimatedPrice.Should().Be(800m);
        created.Value.AdvanceRequiredAmount.Should().Be(400m);
        (await context.CakeCustomOrders.SingleAsync()).EstimatedPrice.Should().Be(800m);
        (await context.PromotionCampaigns.SingleAsync()).RedemptionCount.Should().Be(1);
    }

    [Fact]
    public async Task CustomCakeOffer_DoesNotApplyUnlessCampaignIncludesCustomCakes()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var context = new KabirKitchenDbContext(options);
        var now = DateTime.UtcNow;
        context.Branches.Add(new Branch { Id = 1, BranchCode = "DHN-01", Name = "Dhanmondi", IsActive = true });
        context.MenuItems.Add(new MenuItem
        {
            Id = 10,
            CategoryId = 2,
            Name = "Custom Cake",
            Slug = "custom-cake",
            BasePrice = 1000m,
            IsActive = true,
            IsCustomCake = true
        });
        context.PromotionCampaigns.Add(new PromotionCampaign
        {
            Name = "Food offer",
            DiscountType = PromotionDiscountType.Percentage,
            DiscountValue = 20m,
            TargetType = PromotionTargetType.AllItems,
            IncludeCustomCakes = false,
            Status = PromotionStatus.Active,
            StartDateUtc = now.AddDays(-1),
            EndDateUtc = now.AddDays(1),
            ConcurrencyToken = Guid.NewGuid()
        });
        await context.SaveChangesAsync();

        var quote = await new CakeOrderService(context)
            .QuoteCustomCakeAsync(new QuoteCustomCakeRequestDto(1, 10, 1m, null));

        quote.IsSuccess.Should().BeTrue();
        quote.Value!.DiscountAmount.Should().Be(0m);
        quote.Value.EstimatedPrice.Should().Be(1000m);
        quote.Value.AdvanceRequiredAmount.Should().Be(500m);
    }
}
