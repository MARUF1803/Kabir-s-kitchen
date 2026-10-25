using FluentAssertions;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Procurement;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;
using KabirKitchen.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Tests;

public class ProcurementAndGrnTests
{
    private (KabirKitchenDbContext context, ProcurementService procurementService, Ingredient ingredient) SetupTestDatabase()
    {
        var options = new DbContextOptionsBuilder<KabirKitchenDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new KabirKitchenDbContext(options);

        var branch = new Branch { Id = 1, Name = "Dhanmondi Branch", BranchCode = "DHN", CurrentCashDrawerBalance = 50000m };
        context.Branches.Add(branch);

        var supplier = new Supplier
        {
            Id = 1,
            Name = "Fresh Farms Ltd",
            ContactPerson = "Rahim",
            Phone = "01700000001",
            Email = "rahim@freshfarms.com",
            TotalPayableBalance = 0,
            IsActive = true
        };
        context.Suppliers.Add(supplier);

        var ingredient = new Ingredient
        {
            Id = 10,
            Name = "Basmati Rice",
            BaseUnit = UnitType.Kilogram,
            CurrentAverageCostPerBaseUnit = 120m,
            MinimumAlertStock = 50m
        };
        context.Ingredients.Add(ingredient);

        context.SaveChanges();

        var inventoryEngine = new InventoryEngineService(context);
        var procurementService = new ProcurementService(context, inventoryEngine);

        return (context, procurementService, ingredient);
    }

    [Fact]
    public async Task CreatePurchaseOrder_ShouldCreateDraftPO_WithCalculatedTotals()
    {
        // Arrange
        var (_, procurementService, ingredient) = SetupTestDatabase();

        var request = new CreatePurchaseOrderDto(
            BranchId: 1,
            SupplierId: 1,
            InvoiceOrChallanNumber: "CH-2026-001",
            Notes: "Urgent kitchen restock",
            Items: new List<CreatePurchaseOrderItemDto>
            {
                new(ingredient.Id, QuantityOrdered: 100, UnitUsed: UnitType.Kilogram, UnitCost: 120m)
            }
        );

        // Act
        var result = await procurementService.CreatePurchaseOrderAsync(request);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var po = result.Value;
        po.Status.Should().Be(PurchaseOrderStatus.Draft);
        po.TotalAmount.Should().Be(12000m);
        po.PaidAmount.Should().Be(0m);
        po.DueAmount.Should().Be(12000m);
        po.Items.Should().HaveCount(1);
        po.Items[0].QuantityOrdered.Should().Be(100);
        po.Items[0].QuantityReceived.Should().Be(0);
    }

    [Fact]
    public async Task ReceiveGoodsNote_ShouldUpdateLiveStock_AndSupplierPayableBalance()
    {
        // Arrange
        var (context, procurementService, ingredient) = SetupTestDatabase();

        var createRequest = new CreatePurchaseOrderDto(
            BranchId: 1,
            SupplierId: 1,
            InvoiceOrChallanNumber: "CH-2026-002",
            Notes: "Weekly grains",
            Items: new List<CreatePurchaseOrderItemDto>
            {
                new(ingredient.Id, QuantityOrdered: 50, UnitUsed: UnitType.Kilogram, UnitCost: 130m)
            }
        );
        var createResult = await procurementService.CreatePurchaseOrderAsync(createRequest);
        var poId = createResult.Value.Id;
        var poItemId = createResult.Value.Items[0].IngredientId;

        // Fetch persisted PO item ID
        var persistedPo = await context.PurchaseOrders.Include(p => p.Items).FirstAsync(p => p.Id == poId);
        var actualPoItemId = persistedPo.Items.First().Id;

        var grnRequest = new ReceivePurchaseOrderDto(
            InvoiceOrChallanNumber: "CH-2026-002-FINAL",
            Notes: "Inspected and accepted at loading dock",
            ReceivedItems: new List<ReceivePurchaseOrderItemDto>
            {
                new(actualPoItemId, QuantityReceived: 50, ActualUnitCost: 130m)
            }
        );

        // Act
        var grnResult = await procurementService.ReceiveGoodsNoteAsync(poId, grnRequest, userId: 1);

        // Assert
        grnResult.IsSuccess.Should().BeTrue();
        var updatedPo = grnResult.Value;
        updatedPo.Status.Should().Be(PurchaseOrderStatus.Received);
        updatedPo.TotalAmount.Should().Be(6500m);

        // Verify inventory stock intake
        var stock = await context.BranchIngredientStocks
            .FirstOrDefaultAsync(s => s.BranchId == 1 && s.IngredientId == ingredient.Id);
        stock.Should().NotBeNull();
        stock!.CurrentStockQuantity.Should().Be(50m);
        stock.LastPurchaseCostPerUnit.Should().Be(130m);

        // Verify supplier payable balance
        var supplier = await context.Suppliers.FindAsync(1L);
        supplier!.TotalPayableBalance.Should().Be(6500m);
    }

    [Fact]
    public async Task AddPurchasePayment_ShouldReduceSupplierBalance_AndRecordPayment()
    {
        // Arrange
        var (context, procurementService, ingredient) = SetupTestDatabase();

        var createRequest = new CreatePurchaseOrderDto(
            BranchId: 1,
            SupplierId: 1,
            InvoiceOrChallanNumber: "CH-2026-003",
            Notes: "Restock",
            Items: new List<CreatePurchaseOrderItemDto>
            {
                new(ingredient.Id, QuantityOrdered: 20, UnitUsed: UnitType.Kilogram, UnitCost: 100m)
            }
        );
        var createResult = await procurementService.CreatePurchaseOrderAsync(createRequest);
        var poId = createResult.Value.Id;
        var persistedPo = await context.PurchaseOrders.Include(p => p.Items).FirstAsync(p => p.Id == poId);
        var actualPoItemId = persistedPo.Items.First().Id;

        // GRN
        await procurementService.ReceiveGoodsNoteAsync(poId, new ReceivePurchaseOrderDto(
            InvoiceOrChallanNumber: "CH-003",
            Notes: "Received",
            ReceivedItems: new List<ReceivePurchaseOrderItemDto> { new(actualPoItemId, 20, 100m) }
        ), userId: 1);

        // Act: Make 1500 BDT cash payment
        var paymentResult = await procurementService.AddPurchasePaymentAsync(poId, new RecordPurchasePaymentDto(
            BranchId: 1,
            Amount: 1500m,
            Method: PaymentMethod.Cash,
            TransactionReference: "VOUCHER-001",
            Notes: "Partial payment on delivery"
        ));

        // Assert
        paymentResult.IsSuccess.Should().BeTrue();
        var po = paymentResult.Value;
        po.PaidAmount.Should().Be(1500m);
        po.DueAmount.Should().Be(500m);

        var supplier = await context.Suppliers.FindAsync(1L);
        supplier!.TotalPayableBalance.Should().Be(500m);

        var branch = await context.Branches.FindAsync(1L);
        branch!.CurrentCashDrawerBalance.Should().Be(48500m); // 50000 - 1500
    }
}
