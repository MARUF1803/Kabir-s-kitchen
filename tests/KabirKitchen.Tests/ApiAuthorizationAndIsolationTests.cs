using FluentAssertions;
using KabirKitchen.Api.Controllers;
using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Entities.Orders;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Enums;
using KabirKitchen.Infrastructure.Persistence;
using KabirKitchen.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using System.Security.Claims;

namespace KabirKitchen.Tests;

public class ApiAuthorizationAndIsolationTests
{
    private (KabirKitchenDbContext context, ICurrentUserService currentUser, ClaimsPrincipal principal) SetupContextWithUser(
        long? userId, string role, long? branchId, bool isSuperAdmin = false)
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new KabirKitchenDbContext(options);

        var claims = new List<Claim>();
        if (userId.HasValue) claims.Add(new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString()));
        if (!string.IsNullOrWhiteSpace(role)) claims.Add(new Claim(ClaimTypes.Role, role));
        if (branchId.HasValue) claims.Add(new Claim("BranchId", branchId.Value.ToString()));
        if (isSuperAdmin) claims.Add(new Claim("IsGlobalSuperAdmin", "true"));

        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        var httpContext = new DefaultHttpContext { User = principal };
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        httpContextAccessor.Setup(h => h.HttpContext).Returns(httpContext);

        var currentUser = new CurrentUserService(httpContextAccessor.Object);

        return (context, currentUser, principal);
    }

    [Fact]
    public async Task OrdersController_GetOrders_ShouldReturnForbid_WhenStaffAccessesOtherBranch()
    {
        // Arrange: Manager of Branch 1 attempts to query Branch 2
        var (context, currentUser, principal) = SetupContextWithUser(userId: 1, role: "BranchManager", branchId: 1);
        var costingService = new RecipeCostingService(context);
        var inventoryEngine = new InventoryEngineService(context);
        var orderEngine = new OrderEngineService(context, costingService, inventoryEngine);
        var pdfService = new Mock<IInvoicePdfService>();

        var controller = new OrdersController(context, orderEngine, pdfService.Object, currentUser)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } }
        };

        // Act
        var result = await controller.GetOrders(branchId: 2);

        // Assert
        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task OrdersController_GetOrderById_ShouldReturnForbid_WhenGuestDoesNotProvideMatchingPhone()
    {
        // Arrange: Unauthenticated caller trying to access customer order without valid phone
        var (context, currentUser, principal) = SetupContextWithUser(userId: null, role: "", branchId: null);
        var branch = new Branch { Id = 1, Name = "Dhanmondi", BranchCode = "DHN" };
        context.Branches.Add(branch);

        var order = new Order
        {
            OrderNumber = "ORD-TEST-001",
            BranchId = 1,
            CustomerName = "Alice",
            CustomerPhone = "01711111111",
            SubTotal = 500,
            TotalAmount = 500,
            IsDeleted = false
        };
        context.Orders.Add(order);
        await context.SaveChangesAsync();

        var costingService = new RecipeCostingService(context);
        var inventoryEngine = new InventoryEngineService(context);
        var orderEngine = new OrderEngineService(context, costingService, inventoryEngine);
        var pdfService = new Mock<IInvoicePdfService>();

        var controller = new OrdersController(context, orderEngine, pdfService.Object, currentUser)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } }
        };

        // Act: Guest attempts to access with wrong phone or no phone
        var resultNoPhone = await controller.GetOrderById(order.Id, phone: null);
        var resultWrongPhone = await controller.GetOrderById(order.Id, phone: "01822222222");
        var resultCorrectPhone = await controller.GetOrderById(order.Id, phone: "01711111111");

        // Assert
        resultNoPhone.Should().BeOfType<ForbidResult>();
        resultWrongPhone.Should().BeOfType<ForbidResult>();
        resultCorrectPhone.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task ReportsController_GetSalesReport_ShouldReturnForbid_WhenBranchManagerAccessesOtherBranch()
    {
        // Arrange: Branch 1 manager tries to access Branch 2 sales report
        var (context, currentUser, principal) = SetupContextWithUser(userId: 10, role: "BranchManager", branchId: 1);
        var salesReportService = new SalesReportService(context);

        var controller = new ReportsController(salesReportService, currentUser)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } }
        };

        // Act
        var result = await controller.GetSalesReport(branchId: 2);

        // Assert
        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task InventoryController_RecordStockTransaction_ShouldReturnForbid_WhenUserBelongsToDifferentBranch()
    {
        // Arrange: Staff assigned to Branch 1 attempts stock change on Branch 2
        var (context, currentUser, principal) = SetupContextWithUser(userId: 5, role: "BranchManager", branchId: 1);
        var inventoryEngine = new InventoryEngineService(context);

        var controller = new InventoryController(context, inventoryEngine, currentUser)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } }
        };

        var request = new StockTransactionRequestDto(
            BranchId: 2,
            IngredientId: 1,
            TransactionType: StockTransactionType.PurchaseGRN,
            QuantityChange: 10,
            UnitUsed: UnitType.Kilogram,
            UnitCost: 100,
            ReferenceDocumentType: "PO",
            ReferenceDocumentNumber: "PO-100",
            Remarks: "Intake"
        );

        // Act
        var result = await controller.RecordStockTransaction(request);

        // Assert
        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task InventoryController_GetBranchStocks_ShouldReturnForbid_WhenUserBelongsToDifferentBranch()
    {
        // Arrange
        var (context, currentUser, principal) = SetupContextWithUser(userId: 5, role: "Cashier", branchId: 1);
        var inventoryEngine = new InventoryEngineService(context);

        var controller = new InventoryController(context, inventoryEngine, currentUser)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } }
        };

        // Act: Query Branch 2 stocks
        var result = await controller.GetBranchStocks(branchId: 2);

        // Assert
        result.Should().BeOfType<ForbidResult>();
    }
}
