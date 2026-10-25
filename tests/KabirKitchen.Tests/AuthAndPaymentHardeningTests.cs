using FluentAssertions;
using KabirKitchen.Api.Controllers;
using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Entities.Identity;
using KabirKitchen.Domain.Entities.Orders;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Enums;
using KabirKitchen.Application.Services;
using KabirKitchen.Infrastructure.Persistence;
using KabirKitchen.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace KabirKitchen.Tests;

public class AuthAndPaymentHardeningTests
{
    [Fact]
    public async Task Register_AlwaysAssignsCustomerRole_WhenPrivilegedRoleIsRequested()
    {
        await using var context = CreateContext();
        context.Roles.AddRange(
            new Role { Name = "Customer", NormalizedName = "CUSTOMER" },
            new Role { Name = "GlobalSuperAdmin", NormalizedName = "GLOBALSUPERADMIN" });
        await context.SaveChangesAsync();
        var controller = new AuthController(context, Mock.Of<IJwtTokenService>(), Mock.Of<ICurrentUserService>());

        var response = await controller.Register(new RegisterUserDto(
            "Test Customer",
            "customer@example.com",
            "01700000000",
            "long-enough-password",
            "GlobalSuperAdmin"));

        response.Should().BeOfType<OkObjectResult>();
        var assignedRole = await context.UserRoles.Include(assignment => assignment.Role)
            .Select(assignment => assignment.Role!.Name)
            .SingleAsync();
        assignedRole.Should().Be("Customer");
        (await context.Users.SingleAsync()).IsGlobalSuperAdmin.Should().BeFalse();
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public async Task Login_RejectsInactiveOrDeletedUsers(bool isActive, bool isDeleted)
    {
        await using var context = CreateContext();
        context.Users.Add(new User
        {
            FullName = "Inactive User",
            Email = "inactive@example.com",
            PhoneNumber = "01700000000",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("correct-password"),
            IsActive = isActive,
            IsDeleted = isDeleted
        });
        await context.SaveChangesAsync();
        var jwtService = new Mock<IJwtTokenService>();
        var controller = new AuthController(context, jwtService.Object, Mock.Of<ICurrentUserService>());

        var response = await controller.Login(new LoginRequestDto("inactive@example.com", "correct-password"));

        response.Should().BeOfType<UnauthorizedObjectResult>();
        jwtService.Verify(service => service.GenerateAccessToken(
            It.IsAny<User>(), It.IsAny<string>(), It.IsAny<long?>()), Times.Never);
    }

    [Fact]
    public async Task PaymentGateways_DoNotSimulateSuccessWithoutMerchantCredentials()
    {
        var settings = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var environment = new Mock<IHostEnvironment>();
        var clientFactory = new Mock<IHttpClientFactory>();
        foreach (var environmentName in new[] { Environments.Development, Environments.Production })
        {
            environment.SetupGet(x => x.EnvironmentName).Returns(environmentName);
            var service = new PaymentGatewayService(
                settings, clientFactory.Object, NullLogger<PaymentGatewayService>.Instance, environment.Object);

            var bkashInit = await service.InitiateBkashPaymentAsync(1, 100m, "ORDER-1");
            var sslInit = await service.InitiateSslCommerzPaymentAsync(
                1, 100m, "ORDER-1", "Customer", "01700000000", "customer@example.com");
            var bkashVerification = await service.ExecuteBkashPaymentAsync("BKASH_SIM_fake", "ORDER-1");
            var sslVerification = await service.ValidateSslCommerzPaymentAsync("SSL_SIM_fake", "ORDER-1", 100m);

            bkashInit.IsFailure.Should().BeTrue();
            sslInit.IsFailure.Should().BeTrue();
            bkashVerification.IsFailure.Should().BeTrue();
            sslVerification.IsFailure.Should().BeTrue();
        }

        clientFactory.Verify(factory => factory.CreateClient(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task AddPayment_RejectsAmountsAboveOutstandingBalance()
    {
        await using var context = CreateOrderContext();
        var orderEngine = CreateOrderEngine(context);

        var result = await orderEngine.AddPaymentAsync(1, new InitialPaymentDto(51m, PaymentMethod.Cash));

        result.IsFailure.Should().BeTrue();
        (await context.OrderPayments.CountAsync()).Should().Be(0);
        (await context.Orders.SingleAsync()).PaidAmount.Should().Be(50m);
    }

    [Fact]
    public async Task AddPayment_RejectsAnAlreadyRecordedTransactionReference()
    {
        await using var context = CreateOrderContext();
        context.OrderPayments.Add(new OrderPayment
        {
            OrderId = 1,
            BranchId = 1,
            Amount = 10m,
            Method = PaymentMethod.Card,
            TransactionReference = "TX-REPLAY"
        });
        await context.SaveChangesAsync();
        var orderEngine = CreateOrderEngine(context);

        var result = await orderEngine.AddPaymentAsync(1, new InitialPaymentDto(
            10m, PaymentMethod.Card, "TX-REPLAY"));

        result.IsFailure.Should().BeTrue();
        (await context.OrderPayments.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task VoidOrder_ReleasesCampaignRedemptionAndCannotBeAppliedTwice()
    {
        await using var context = CreateOrderContext();
        var campaign = new KabirKitchen.Domain.Entities.Promotions.PromotionCampaign
        {
            Name = "Limited offer",
            DiscountType = PromotionDiscountType.Percentage,
            DiscountValue = 10,
            TargetType = PromotionTargetType.AllItems,
            Status = PromotionStatus.Active,
            StartDateUtc = DateTime.UtcNow.AddDays(-1),
            EndDateUtc = DateTime.UtcNow.AddDays(1),
            RedemptionCount = 1
        };
        context.PromotionCampaigns.Add(campaign);
        await context.SaveChangesAsync();
        var order = await context.Orders.SingleAsync();
        order.PromotionCampaignId = campaign.Id;
        await context.SaveChangesAsync();
        var orderEngine = CreateOrderEngine(context);

        var voidResult = await orderEngine.VoidOrderAsync(order.Id, "Customer cancelled", "admin@example.com");
        voidResult.IsSuccess.Should().BeTrue();
        (await context.PromotionCampaigns.SingleAsync()).RedemptionCount.Should().Be(0);

        var duplicateVoid = await orderEngine.VoidOrderAsync(order.Id, "Duplicate", "admin@example.com");
        duplicateVoid.IsFailure.Should().BeTrue();
        (await context.PromotionCampaigns.SingleAsync()).RedemptionCount.Should().Be(0);
    }

    [Fact]
    public async Task VoidOrder_RequiresCancellationReason()
    {
        await using var context = CreateOrderContext();
        var orderEngine = CreateOrderEngine(context);

        var result = await orderEngine.VoidOrderAsync(1, " ", "admin@example.com");

        result.IsFailure.Should().BeTrue();
        (await context.Orders.SingleAsync()).IsVoid.Should().BeFalse();
    }

    [Fact]
    public async Task CancelledOrder_CannotReceivePaymentOrChangeStatus()
    {
        await using var context = CreateOrderContext();
        var orderEngine = CreateOrderEngine(context);
        (await orderEngine.VoidOrderAsync(1, "Customer cancelled", "admin@example.com")).IsSuccess.Should().BeTrue();

        var paymentResult = await orderEngine.AddPaymentAsync(1, new InitialPaymentDto(10m, PaymentMethod.Cash));
        var statusResult = await orderEngine.UpdateOrderStatusAsync(1, OrderStatus.Preparing);

        paymentResult.IsFailure.Should().BeTrue();
        statusResult.IsFailure.Should().BeTrue();
        (await context.Orders.SingleAsync()).PaidAmount.Should().Be(50m);
    }

    [Fact]
    public async Task OrderStaffAction_RejectsAccessToAnotherBranch()
    {
        await using var context = CreateOrderContext();
        var currentUser = new Mock<ICurrentUserService>();
        currentUser.Setup(user => user.HasAccessToBranch(1)).Returns(false);
        var controller = new OrdersController(
            context,
            CreateOrderEngine(context),
            Mock.Of<IInvoicePdfService>(),
            currentUser.Object);

        var response = await controller.VoidOrder(1, new VoidOrderRequestDto("Not authorized"));

        response.Should().BeOfType<ForbidResult>();
        (await context.Orders.SingleAsync()).IsVoid.Should().BeFalse();
    }

    private static KabirKitchenDbContext CreateOrderContext()
    {
        var context = CreateContext();
        context.Branches.Add(new Branch { Id = 1, Name = "Test Branch", BranchCode = "TST" });
        context.Orders.Add(new Order
        {
            Id = 1,
            BranchId = 1,
            OrderNumber = "ORDER-1",
            CustomerName = "Test Customer",
            CustomerPhone = "01700000000",
            TotalAmount = 100m,
            PaidAmount = 50m
        });
        context.SaveChanges();
        return context;
    }

    private static OrderEngineService CreateOrderEngine(KabirKitchenDbContext context)
    {
        return new OrderEngineService(
            context,
            new RecipeCostingService(context),
            new InventoryEngineService(context));
    }

    private static KabirKitchenDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new KabirKitchenDbContext(options);
    }
}
