using FluentAssertions;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Promotions;
using KabirKitchen.Domain.Enums;
using KabirKitchen.Infrastructure.Persistence;
using KabirKitchen.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace KabirKitchen.Tests;

public class UnifiedBillingAndReportingTests
{
    private (KabirKitchenDbContext dbContext, OrderEngineService orderEngine, SalesReportService reportService, InvoicePdfService pdfService) CreateServices()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var dbContext = new KabirKitchenDbContext(options);

        // Seed basic branch
        var branch = new Branch
        {
            Id = 1,
            Name = "Dhanmondi Flagship",
            BranchCode = "DHN",
            Address = "Road 8/A, Dhanmondi, Dhaka",
            ContactPhone = "+8801700000000",
            IsActive = true
        };
        dbContext.Branches.Add(branch);

        // Seed menu item with variant and addon
        var item1 = new MenuItem
        {
            Id = 10,
            Name = "Royal Kacchi Biryani",
            BasePrice = 450m,
            IsActive = true
        };
        var variant1 = new MenuItemVariant
        {
            Id = 101,
            MenuItemId = 10,
            VariantName = "Platter (1:2)",
            AdditionalPrice = 150m
        };
        var addon1 = new AddOn
        {
            Id = 201,
            Name = "Extra Boiled Egg",
            Price = 30m,
            IsActive = true
        };

        dbContext.MenuItems.Add(item1);
        dbContext.MenuItemVariants.Add(variant1);
        dbContext.AddOns.Add(addon1);
        dbContext.MenuItemAddOns.Add(new MenuItemAddOn { MenuItemId = item1.Id, AddOnId = addon1.Id });
        dbContext.SaveChanges();

        var costingService = new RecipeCostingService(dbContext);
        var inventoryEngine = new InventoryEngineService(dbContext);
        var orderEngine = new OrderEngineService(dbContext, costingService, inventoryEngine);
        var reportService = new SalesReportService(dbContext);
        var pdfService = new InvoicePdfService();

        return (dbContext, orderEngine, reportService, pdfService);
    }

    [Fact]
    public async Task CreateOrder_ShouldCalculateStrictPricing_AndApplyVatTaxAccurately()
    {
        // Arrange
        var (_, orderEngine, _, _) = CreateServices();

        var request = new CreateOrderRequestDto(
            BranchId: 1,
            OrderType: OrderType.Delivery,
            CustomerName: "Dr. Mahbub",
            CustomerPhone: "+8801711223344",
            DeliveryAddress: "House 12, Dhanmondi",
            DiscountAmount: 50m,
            DeliveryFee: 60m,
            Items: new List<CreateOrderItemDto>
            {
                new(
                    MenuItemId: 10,
                    MenuItemVariantId: 101, // 450 + 150 = 600 unit
                    Quantity: 2,           // 1200
                    SelectedAddOnIds: new List<long> { 201 } // + 30 per unit = 630 * 2 = 1260 subtotal
                )
            }
        );

        // Act
        var result = await orderEngine.CreateOrderAsync(request);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var order = result.Value;

        // Subtotal = (450 + 150 + 30) * 2 = 1260
        order.SubTotal.Should().Be(1260m);
        // Client supplied discount amounts are untrusted and must not change the server price.
        order.DiscountAmount.Should().Be(0m);

        // Taxable Base = 1260; 5% Tax (VAT) = 63
        order.TaxAmount.Should().Be(63m);
        order.DeliveryFee.Should().Be(60m);

        // Total = 1260 + 63 + 60 = 1383
        order.TotalAmount.Should().Be(1383m);
        order.InvoiceNumber.Should().StartWith("INV-DHN-");
        order.OrderNumber.Should().StartWith("KK-DHN-");
    }

    [Fact]
    public async Task CreateOrder_ShouldApplyDatabasePromotionAndSnapshotCampaignOnOrder()
    {
        var (dbContext, orderEngine, _, _) = CreateServices();
        var now = DateTime.UtcNow;
        var campaign = new PromotionCampaign
        {
            Name = "Database offer",
            DiscountType = PromotionDiscountType.Percentage,
            DiscountValue = 10m,
            TargetType = PromotionTargetType.AllItems,
            BranchId = 1,
            Status = PromotionStatus.Active,
            StartDateUtc = now.AddMinutes(-1),
            EndDateUtc = now.AddHours(1)
        };
        dbContext.PromotionCampaigns.Add(campaign);
        await dbContext.SaveChangesAsync();

        var order = await orderEngine.CreateOrderAsync(new CreateOrderRequestDto(
            BranchId: 1,
            OrderType: OrderType.Delivery,
            CustomerName: "Promotion test",
            CustomerPhone: "N/A",
            DiscountAmount: 99m,
            Items: [new CreateOrderItemDto(10, 101, 2, SelectedAddOnIds: [201])]));

        order.IsSuccess.Should().BeTrue();
        order.Value.DiscountAmount.Should().Be(120m);
        order.Value.TotalAmount.Should().Be(1257m);
        var savedOrder = await dbContext.Orders.SingleAsync();
        savedOrder.PromotionCampaignId.Should().Be(campaign.Id);
        savedOrder.PromotionCampaignName.Should().Be("Database offer");
        campaign.RedemptionCount.Should().Be(1);
    }

    [Fact]
    public async Task QuoteOrder_UsesOrderPricingAndDoesNotConsumeCouponRedemption()
    {
        var (dbContext, orderEngine, _, _) = CreateServices();
        var now = DateTime.UtcNow;
        var coupon = new PromotionCampaign
        {
            Name = "Ten percent",
            DiscountType = PromotionDiscountType.Percentage,
            DiscountValue = 10m,
            TargetType = PromotionTargetType.AllItems,
            BranchId = 1,
            CouponCode = "SAVE10",
            Status = PromotionStatus.Active,
            StartDateUtc = now.AddMinutes(-1),
            EndDateUtc = now.AddHours(1),
            UsageLimit = 1
        };
        dbContext.PromotionCampaigns.Add(coupon);
        await dbContext.SaveChangesAsync();

        var quote = await orderEngine.QuoteOrderAsync(new PromotionQuoteRequest(
            1,
            OrderType.Delivery,
            "SAVE10",
            [new PromotionQuoteItemRequest(10, 101, 2, [201])]));

        quote.IsSuccess.Should().BeTrue();
        quote.Value.SubTotal.Should().Be(1260m);
        quote.Value.DiscountAmount.Should().Be(120m);
        quote.Value.TaxAmount.Should().Be(57m);
        quote.Value.DeliveryFee.Should().Be(60m);
        quote.Value.TotalAmount.Should().Be(1257m);
        coupon.RedemptionCount.Should().Be(0);
    }

    [Fact]
    public async Task IdempotencyKey_ShouldPreventDuplicateOrders_WhenSubmittedTwice()
    {
        // Arrange
        var (_, orderEngine, _, _) = CreateServices();
        string key = "IDEM-TEST-" + Guid.NewGuid();

        var request = new CreateOrderRequestDto(
            BranchId: 1,
            OrderType: OrderType.POS,
            CustomerName: "Counter Guest",
            CustomerPhone: "N/A",
            IdempotencyKey: key,
            Items: new List<CreateOrderItemDto>
            {
                new(MenuItemId: 10, MenuItemVariantId: null, Quantity: 1)
            }
        );

        // Act
        var firstResult = await orderEngine.CreateOrderAsync(request);
        var secondResult = await orderEngine.CreateOrderAsync(request);

        // Assert
        firstResult.IsSuccess.Should().BeTrue();
        secondResult.IsSuccess.Should().BeTrue();
        secondResult.Value.Id.Should().Be(firstResult.Value.Id);
        secondResult.Value.OrderNumber.Should().Be(firstResult.Value.OrderNumber);
    }

    [Fact]
    public async Task SplitPayment_ShouldReconcilePaidAmount_AndOutstandingBalance()
    {
        // Arrange
        var (_, orderEngine, _, _) = CreateServices();

        var request = new CreateOrderRequestDto(
            BranchId: 1,
            OrderType: OrderType.POS,
            CustomerName: "Walk-in Guest",
            CustomerPhone: "+8801900000000",
            Items: new List<CreateOrderItemDto>
            {
                new(MenuItemId: 10, MenuItemVariantId: null, Quantity: 2) // 450 * 2 = 900 subtotal, 5% vat = 45 -> 945 total
            },
            InitialPayments: new List<InitialPaymentDto>
            {
                new(Amount: 500m, Method: PaymentMethod.Cash, ReceivedByStaffName: "Rafiul"),
                new(Amount: 300m, Method: PaymentMethod.bKash, TransactionReference: "TRX992", ReceivedByStaffName: "Rafiul")
            }
        );

        // Act
        var result = await orderEngine.CreateOrderAsync(request);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var order = result.Value;
        order.TotalAmount.Should().Be(945m); // 900 + 45 VAT
        order.PaidAmount.Should().Be(800m); // 500 + 300
        order.OutstandingAmount.Should().Be(145m); // 945 - 800
        order.PaymentStatus.Should().Be(PaymentStatus.PartiallyPaid);
        order.Payments.Should().HaveCount(2);
    }

    [Fact]
    public async Task InvoiceAndPdfGeneration_ShouldProduceValidDocument_MatchingPersistedOrder()
    {
        // Arrange
        var (_, orderEngine, _, pdfService) = CreateServices();

        var request = new CreateOrderRequestDto(
            BranchId: 1,
            OrderType: OrderType.DineIn,
            CustomerName: "Rahim Chowdhury",
            CustomerPhone: "+8801811223344",
            DiningTableId: 1,
            Items: new List<CreateOrderItemDto>
            {
                new(MenuItemId: 10, MenuItemVariantId: null, Quantity: 1)
            }
        );

        var orderResult = await orderEngine.CreateOrderAsync(request);
        orderResult.IsSuccess.Should().BeTrue();

        // Act 1: Get Invoice DTO
        var invoiceResult = await orderEngine.GetOrderInvoiceAsync(orderResult.Value.Id);
        invoiceResult.IsSuccess.Should().BeTrue();
        var invoice = invoiceResult.Value;

        invoice.InvoiceNumber.Should().Be(orderResult.Value.InvoiceNumber);
        invoice.GrandTotal.Should().Be(orderResult.Value.TotalAmount);
        invoice.Restaurant.BrandName.Should().Be("Kabir's Kitchen");

        // Act 2: Generate A4 PDF
        byte[] a4Pdf = pdfService.GenerateA4InvoicePdf(invoice);
        a4Pdf.Should().NotBeNullOrEmpty();
        string a4Header = Encoding.ASCII.GetString(a4Pdf[..8]);
        a4Header.Should().StartWith("%PDF-1.4");

        // Act 3: Generate Thermal Receipt PDF (80mm)
        byte[] thermalPdf = pdfService.GenerateThermalReceiptPdf(invoice, 80);
        thermalPdf.Should().NotBeNullOrEmpty();
        string thermalHeader = Encoding.ASCII.GetString(thermalPdf[..8]);
        thermalHeader.Should().StartWith("%PDF-1.4");
    }

    [Fact]
    public async Task SalesReportService_ShouldReconcileGrossNetAndChannelSales()
    {
        // Arrange
        var (_, orderEngine, reportService, _) = CreateServices();

        // Order 1: POS
        await orderEngine.CreateOrderAsync(new CreateOrderRequestDto(
            BranchId: 1,
            OrderType: OrderType.POS,
            CustomerName: "Guest 1",
            CustomerPhone: "123",
            CashierStaffName: "Rafiul",
            Items: new List<CreateOrderItemDto> { new(10, null, 1) }, // 450 + 22.50 = 472.50
            InitialPayments: new List<InitialPaymentDto> { new(472.50m, PaymentMethod.Cash) }
        ));

        // Order 2: Delivery
        await orderEngine.CreateOrderAsync(new CreateOrderRequestDto(
            BranchId: 1,
            OrderType: OrderType.Delivery,
            CustomerName: "Guest 2",
            CustomerPhone: "456",
            Items: new List<CreateOrderItemDto> { new(10, null, 1) }, // 450 + 22.50 + 60 = 532.50
            InitialPayments: new List<InitialPaymentDto> { new(532.50m, PaymentMethod.bKash) }
        ));

        // Act
        var filter = new SalesReportFilterDto(BranchId: 1, StartDateUtc: DateTime.UtcNow.AddHours(-1), EndDateUtc: DateTime.UtcNow.AddHours(1));
        var reportResult = await reportService.GetSalesReportAsync(filter);

        // Assert
        reportResult.IsSuccess.Should().BeTrue();
        var report = reportResult.Value;

        report.Summary.TotalOrders.Should().Be(2);
        report.Summary.GrossSales.Should().Be(900m); // 450 + 450
        report.Summary.TotalTax.Should().Be(45m); // 22.50 + 22.50
        report.Summary.TotalDeliveryFees.Should().Be(60m);
        report.Summary.NetSales.Should().Be(1005m); // 472.50 + 532.50
        report.Summary.TotalCollected.Should().Be(1005m);
        report.Summary.TotalOutstanding.Should().Be(0m);

        report.BySource.Should().HaveCount(2);
        report.ByPaymentMethod.Should().HaveCount(2);

        // CSV export
        var csvResult = await reportService.GenerateCsvExportAsync(filter);
        csvResult.IsSuccess.Should().BeTrue();
        csvResult.Value.Should().Contain("KABIR'S KITCHEN - OFFICIAL SALES REPORT");
        csvResult.Value.Should().Contain("Gross Sales,900.00");
    }

    [Fact]
    public async Task PrintAudit_ShouldIncrementCount_AndSetTimestamp()
    {
        // Arrange
        var (_, orderEngine, _, _) = CreateServices();

        var orderResult = await orderEngine.CreateOrderAsync(new CreateOrderRequestDto(
            BranchId: 1,
            OrderType: OrderType.POS,
            CustomerName: "Print Test",
            CustomerPhone: "111",
            Items: new List<CreateOrderItemDto> { new(10, null, 1) }
        ));

        long orderId = orderResult.Value.Id;

        // Act
        await orderEngine.RecordPrintAsync(orderId, "Staff-Rafiul", "Thermal80");
        await orderEngine.RecordPrintAsync(orderId, "Staff-Rafiul", "A4Pdf");

        var invoiceResult = await orderEngine.GetOrderInvoiceAsync(orderId);

        // Assert
        invoiceResult.Value.PrintCount.Should().Be(2);
        invoiceResult.Value.LastPrintedAtUtc.Should().NotBeNull();
    }
}
