using FluentAssertions;
using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Entities.Bakery;
using KabirKitchen.Domain.Enums;
using KabirKitchen.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using System.Security.Claims;

namespace KabirKitchen.Tests;

public class CakeRuleTests
{
    [Fact]
    public async Task StartBakingAsync_ShouldFail_WhenAdvancePaymentIsNotVerified()
    {
        // Arrange: In-memory DbContext
        var options = new DbContextOptionsBuilder<KabirKitchen.Infrastructure.Persistence.KabirKitchenDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var dbContext = new KabirKitchen.Infrastructure.Persistence.KabirKitchenDbContext(options);

        var unverifiedCake = new CakeCustomOrder
        {
            CustomOrderNumber = "CAKE-TEST-001",
            EstimatedPrice = 1000m,
            AdvancePaidAmount = 0m,
            IsAdvanceVerified = false,
            Status = CakeOrderStatus.QuoteApproved
        };

        dbContext.CakeCustomOrders.Add(unverifiedCake);
        await dbContext.SaveChangesAsync();

        var cakeService = new CakeOrderService(dbContext);

        // Act
        var result = await cakeService.StartBakingAsync(unverifiedCake.Id);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Contain("50% advance payment is not verified");
    }
}

public class BranchSecurityTests
{
    [Fact]
    public void HasAccessToBranch_ShouldBlockAccess_WhenUserBelongsToDifferentBranch()
    {
        // Arrange
        var httpContext = new DefaultHttpContext();
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "101"),
            new Claim(ClaimTypes.Role, "Cashier"),
            new Claim("BranchId", "1"), // Assigned to Branch 1 (Dhanmondi)
            new Claim("IsGlobalSuperAdmin", "false")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        var mockAccessor = new Mock<IHttpContextAccessor>();
        mockAccessor.Setup(a => a.HttpContext).Returns(httpContext);

        var currentUserService = new CurrentUserService(mockAccessor.Object);

        // Act & Assert
        currentUserService.HasAccessToBranch(1).Should().BeTrue("User is assigned to Branch 1");
        currentUserService.HasAccessToBranch(2).Should().BeFalse("Dhanmondi cashier cannot access Branch 2 (Mirpur)");
    }

    [Fact]
    public void HasAccessToBranch_ShouldAllowAllBranches_ForGlobalSuperAdmin()
    {
        // Arrange
        var httpContext = new DefaultHttpContext();
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "1"),
            new Claim(ClaimTypes.Role, "Admin"),
            new Claim("IsGlobalSuperAdmin", "true")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        var mockAccessor = new Mock<IHttpContextAccessor>();
        mockAccessor.Setup(a => a.HttpContext).Returns(httpContext);

        var currentUserService = new CurrentUserService(mockAccessor.Object);

        // Act & Assert
        currentUserService.HasAccessToBranch(1).Should().BeTrue();
        currentUserService.HasAccessToBranch(99).Should().BeTrue("SuperAdmin can view all 100 branches");
    }
}
