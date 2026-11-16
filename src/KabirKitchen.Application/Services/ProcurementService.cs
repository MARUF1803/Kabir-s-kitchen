using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Procurement;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public class ProcurementService
{
    private readonly IApplicationDbContext _context;
    private readonly InventoryEngineService _inventoryEngine;

    public ProcurementService(IApplicationDbContext context, InventoryEngineService inventoryEngine)
    {
        _context = context;
        _inventoryEngine = inventoryEngine;
    }

    public async Task<List<SupplierDto>> GetSuppliersAsync()
    {
        return await _context.Suppliers
            .Where(s => !s.IsDeleted)
            .OrderBy(s => s.Name)
            .Select(s => new SupplierDto(
                s.Id,
                s.Name,
                s.ContactPerson,
                s.Phone,
                s.Email,
                s.Address,
                s.TotalPayableBalance,
                s.IsActive
            ))
            .ToListAsync();
    }

    public async Task<Result<SupplierDto>> CreateSupplierAsync(CreateSupplierDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return Result<SupplierDto>.Failure("Supplier name is required.");

        var supplier = new Supplier
        {
            Name = dto.Name.Trim(),
            ContactPerson = dto.ContactPerson?.Trim() ?? "",
            Phone = dto.Phone?.Trim() ?? "",
            Email = dto.Email?.Trim() ?? "",
            Address = dto.Address?.Trim() ?? "",
            TotalPayableBalance = 0,
            IsActive = true
        };

        _context.Suppliers.Add(supplier);
        await _context.SaveChangesAsync();

        return Result<SupplierDto>.Success(new SupplierDto(
            supplier.Id,
            supplier.Name,
            supplier.ContactPerson,
            supplier.Phone,
            supplier.Email,
            supplier.Address,
            supplier.TotalPayableBalance,
            supplier.IsActive
        ));
    }

    public async Task<Result<SupplierDto>> UpdateSupplierAsync(long id, UpdateSupplierDto dto)
    {
        var supplier = await _context.Suppliers.FindAsync(id);
        if (supplier == null || supplier.IsDeleted)
            return Result<SupplierDto>.Failure("Supplier not found.");

        supplier.Name = dto.Name.Trim();
        supplier.ContactPerson = dto.ContactPerson?.Trim() ?? "";
        supplier.Phone = dto.Phone?.Trim() ?? "";
        supplier.Email = dto.Email?.Trim() ?? "";
        supplier.Address = dto.Address?.Trim() ?? "";
        supplier.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();

        return Result<SupplierDto>.Success(new SupplierDto(
            supplier.Id,
            supplier.Name,
            supplier.ContactPerson,
            supplier.Phone,
            supplier.Email,
            supplier.Address,
            supplier.TotalPayableBalance,
            supplier.IsActive
        ));
    }

    public async Task<List<PurchaseOrderResponseDto>> GetPurchaseOrdersAsync(long? branchId = null, PurchaseOrderStatus? status = null)
    {
        var query = _context.PurchaseOrders
            .Include(po => po.Branch)
            .Include(po => po.Supplier)
            .Include(po => po.Items).ThenInclude(i => i.Ingredient)
            .Include(po => po.Payments)
            .OrderByDescending(po => po.OrderDateUtc)
            .AsQueryable();

        if (branchId.HasValue && branchId.Value > 0)
        {
            query = query.Where(po => po.BranchId == branchId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(po => po.Status == status.Value);
        }

        var orders = await query.Take(50).ToListAsync();

        return orders.Select(MapToResponseDto).ToList();
    }

    public async Task<Result<PurchaseOrderResponseDto>> GetPurchaseOrderByIdAsync(long id)
    {
        var po = await _context.PurchaseOrders
            .Include(p => p.Branch)
            .Include(p => p.Supplier)
            .Include(p => p.Items).ThenInclude(i => i.Ingredient)
            .Include(p => p.Payments)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (po == null) return Result<PurchaseOrderResponseDto>.Failure("Purchase order not found.");

        return Result<PurchaseOrderResponseDto>.Success(MapToResponseDto(po));
    }

    public async Task<Result<PurchaseOrderResponseDto>> CreatePurchaseOrderAsync(CreatePurchaseOrderDto dto)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            return Result<PurchaseOrderResponseDto>.Failure("At least one purchase order item is required.");

        var branch = await _context.Branches.FindAsync(dto.BranchId);
        if (branch == null) return Result<PurchaseOrderResponseDto>.Failure("Branch not found.");

        var supplier = await _context.Suppliers.FindAsync(dto.SupplierId);
        if (supplier == null) return Result<PurchaseOrderResponseDto>.Failure("Supplier not found.");

        var datePrefix = DateTime.UtcNow.ToString("yyyyMMdd");
        string poNumber;
        int attempt = 0;
        do
        {
            var countToday = await _context.PurchaseOrders
                .CountAsync(p => p.PoNumber.StartsWith($"PO-{datePrefix}"));
            poNumber = $"PO-{datePrefix}-{(countToday + 1 + attempt):D3}";
            attempt++;
        } while (await _context.PurchaseOrders.AnyAsync(p => p.PoNumber == poNumber) && attempt < 10);

        decimal subtotal = 0;
        var poItems = new List<PurchaseOrderItem>();

        foreach (var itemDto in dto.Items)
        {
            var lineTotal = itemDto.QuantityOrdered * itemDto.UnitCost;
            subtotal += lineTotal;

            poItems.Add(new PurchaseOrderItem
            {
                IngredientId = itemDto.IngredientId,
                QuantityOrdered = itemDto.QuantityOrdered,
                QuantityReceived = 0,
                UnitUsed = itemDto.UnitUsed,
                UnitCost = itemDto.UnitCost
            });
        }

        var po = new PurchaseOrder
        {
            BranchId = dto.BranchId,
            SupplierId = dto.SupplierId,
            PoNumber = poNumber,
            Status = PurchaseOrderStatus.Draft,
            SubTotal = subtotal,
            TaxAmount = 0,
            TotalAmount = subtotal,
            PaidAmount = 0,
            OrderDateUtc = DateTime.UtcNow,
            InvoiceOrChallanNumber = dto.InvoiceOrChallanNumber,
            Notes = dto.Notes,
            Items = poItems
        };

        _context.PurchaseOrders.Add(po);
        await _context.SaveChangesAsync();

        return await GetPurchaseOrderByIdAsync(po.Id);
    }

    public async Task<Result<PurchaseOrderResponseDto>> ReceiveGoodsNoteAsync(
        long purchaseOrderId, ReceivePurchaseOrderDto dto, long? userId)
    {
        var po = await _context.PurchaseOrders
            .Include(p => p.Items).ThenInclude(i => i.Ingredient)
            .Include(p => p.Supplier)
            .Include(p => p.Payments)
            .FirstOrDefaultAsync(p => p.Id == purchaseOrderId);

        if (po == null) return Result<PurchaseOrderResponseDto>.Failure("Purchase order not found.");
        if (po.Status == PurchaseOrderStatus.Received)
            return Result<PurchaseOrderResponseDto>.Failure("This purchase order has already been fully received.");

        decimal previousSubTotal = po.Items.Sum(i => i.QuantityReceived * i.UnitCost);

        foreach (var receivedItemDto in dto.ReceivedItems)
        {
            var item = po.Items.FirstOrDefault(i => i.Id == receivedItemDto.PurchaseOrderItemId);
            if (item == null) continue;

            item.QuantityReceived = receivedItemDto.QuantityReceived;
            if (receivedItemDto.ActualUnitCost.HasValue && receivedItemDto.ActualUnitCost.Value > 0)
            {
                item.UnitCost = receivedItemDto.ActualUnitCost.Value;
            }

            // Trigger double-entry inventory ledger intake (GRN)
            var stockResult = await _inventoryEngine.RecordStockTransactionAsync(
                po.BranchId,
                item.IngredientId,
                StockTransactionType.PurchaseGRN,
                item.QuantityReceived,
                item.UnitUsed,
                item.UnitCost,
                "PurchaseOrder",
                po.PoNumber,
                $"GRN intake for PO {po.PoNumber}. Challan: {dto.InvoiceOrChallanNumber}",
                userId
            );

            if (stockResult.IsFailure)
            {
                return Result<PurchaseOrderResponseDto>.Failure($"Failed to update stock for item {item.IngredientId}: {stockResult.Error}");
            }

            // Create InventoryLot for this receipt
            var lotService = new LotManagementService(_context);
            var lotNumber = await lotService.GenerateRawMaterialLotNumberAsync();
            var rawLot = lotService.CreateRawMaterialLot(
                lotNumber: lotNumber,
                branchId: po.BranchId,
                ingredientId: item.IngredientId,
                quantity: item.QuantityReceived,
                unitCost: item.UnitCost,
                expiryDateUtc: receivedItemDto.ExpiryDateUtc,
                hasExpiry: receivedItemDto.ExpiryDateUtc.HasValue,
                sourceReference: po.PoNumber
            );
            _context.InventoryLots.Add(rawLot);
            await _context.SaveChangesAsync();

            var alloc = LotManagementService.CreateReceiptAllocation(rawLot, stockResult.Value.Id);
            _context.IngredientLotAllocations.Add(alloc);
        }

        // Determine new status: Received only if ALL items are fully received
        bool allReceived = po.Items.All(i => i.QuantityReceived >= i.QuantityOrdered);
        po.Status = allReceived ? PurchaseOrderStatus.Received : PurchaseOrderStatus.PartiallyReceived;
        po.ReceivedDateUtc = dto.ActualReceivedDateUtc?.ToUniversalTime() ?? DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(dto.InvoiceOrChallanNumber))
            po.InvoiceOrChallanNumber = dto.InvoiceOrChallanNumber;
        if (!string.IsNullOrWhiteSpace(dto.Notes))
            po.Notes = (po.Notes + " " + dto.Notes).Trim();

        // Financial ledger: Update TotalAmount based on actual received quantities
        // Use delta to avoid double-counting on partial receives
        po.SubTotal = po.Items.Sum(i => i.QuantityReceived * i.UnitCost);
        po.TotalAmount = po.SubTotal + po.TaxAmount;
        decimal balanceDelta = po.SubTotal - previousSubTotal;

        if (po.Supplier != null && balanceDelta != 0)
        {
            po.Supplier.TotalPayableBalance += balanceDelta;
        }

        await _context.SaveChangesAsync();

        return await GetPurchaseOrderByIdAsync(po.Id);
    }

    public async Task<Result<PurchaseOrderResponseDto>> AddPurchasePaymentAsync(
        long purchaseOrderId, RecordPurchasePaymentDto dto)
    {
        var po = await _context.PurchaseOrders
            .Include(p => p.Supplier)
            .Include(p => p.Payments)
            .FirstOrDefaultAsync(p => p.Id == purchaseOrderId);

        if (po == null) return Result<PurchaseOrderResponseDto>.Failure("Purchase order not found.");
        if (dto.Amount <= 0) return Result<PurchaseOrderResponseDto>.Failure("Payment amount must be greater than zero.");
        if (dto.Amount > po.DueAmount)
            return Result<PurchaseOrderResponseDto>.Failure($"Payment amount (৳{dto.Amount:N2}) cannot exceed remaining due amount (৳{po.DueAmount:N2}). Total bill: ৳{po.TotalAmount:N2}, Already paid: ৳{po.PaidAmount:N2}.");

        var payment = new PurchasePayment
        {
            PurchaseOrderId = purchaseOrderId,
            BranchId = dto.BranchId > 0 ? dto.BranchId : po.BranchId,
            Amount = dto.Amount,
            Method = dto.Method,
            TransactionReference = dto.TransactionReference,
            Notes = dto.Notes,
            PaymentDateUtc = DateTime.UtcNow
        };

        _context.PurchasePayments.Add(payment);
        po.PaidAmount += dto.Amount;

        // Reduce supplier payable balance
        if (po.Supplier != null)
        {
            po.Supplier.TotalPayableBalance -= dto.Amount;
        }

        // Deduct from branch cash drawer if paid via cash
        if (dto.Method == PaymentMethod.Cash)
        {
            var branch = await _context.Branches.FindAsync(payment.BranchId);
            if (branch != null)
            {
                branch.CurrentCashDrawerBalance -= dto.Amount;
            }
        }

        await _context.SaveChangesAsync();

        return await GetPurchaseOrderByIdAsync(po.Id);
    }

    private static PurchaseOrderResponseDto MapToResponseDto(PurchaseOrder po)
    {
        return new PurchaseOrderResponseDto(
            po.Id,
            po.BranchId,
            po.Branch?.Name ?? "",
            po.SupplierId,
            po.Supplier?.Name ?? "",
            po.PoNumber,
            po.Status,
            po.SubTotal,
            po.TaxAmount,
            po.TotalAmount,
            po.PaidAmount,
            po.DueAmount,
            po.OrderDateUtc,
            po.ReceivedDateUtc,
            po.InvoiceOrChallanNumber,
            po.Notes,
            po.Items.Select(i => new PurchaseOrderItemDto(
                i.IngredientId,
                i.Ingredient?.Name ?? "",
                i.QuantityOrdered,
                i.QuantityReceived,
                i.UnitUsed,
                i.UnitCost,
                i.LineTotal
            )).ToList(),
            po.Payments.Select(p => new PurchasePaymentDto(
                p.Id,
                p.Amount,
                p.Method,
                p.TransactionReference,
                p.Notes,
                p.PaymentDateUtc
            )).ToList()
        );
    }
}
