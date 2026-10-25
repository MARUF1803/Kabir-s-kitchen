using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly OrderEngineService _orderEngine;
    private readonly IInvoicePdfService _pdfService;
    private readonly ICurrentUserService _currentUser;

    public OrdersController(
        IApplicationDbContext context,
        OrderEngineService orderEngine,
        IInvoicePdfService pdfService,
        ICurrentUserService currentUser)
    {
        _context = context;
        _orderEngine = orderEngine;
        _pdfService = pdfService;
        _currentUser = currentUser;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequestDto request)
    {
        var isStaff = IsStaffUser();
        if (isStaff && !_currentUser.HasAccessToBranch(request.BranchId))
            return Forbid();
        if (!isStaff && request.InitialPayments is { Count: > 0 })
            return BadRequest(new { message = "Customer orders cannot submit payment records before server-side payment verification." });

        var trustedRequest = request with
        {
            CashierUserId = isStaff ? _currentUser.UserId : null,
            CashierStaffName = isStaff ? _currentUser.UserEmail : null
        };
        var result = await _orderEngine.CreateOrderAsync(trustedRequest, _currentUser.UserId);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return CreatedAtAction(nameof(GetOrderById), new { id = result.Value.Id }, result.Value);
    }

    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Cashier,Chef")]
    public async Task<IActionResult> GetOrders([FromQuery] long? branchId = null, [FromQuery] OrderStatus? status = null)
    {
        // Enforce branch isolation for branch-scoped staff
        if (branchId.HasValue && branchId.Value > 0)
        {
            if (!_currentUser.HasAccessToBranch(branchId.Value))
            {
                return Forbid();
            }
        }
        else if (!_currentUser.IsGlobalSuperAdmin && _currentUser.BranchId.HasValue)
        {
            branchId = _currentUser.BranchId.Value;
        }

        var query = _context.Orders
            .Include(o => o.Branch)
            .Include(o => o.Payments)
            .Include(o => o.Items).ThenInclude(i => i.AddOns)
            .OrderByDescending(o => o.CreatedAtUtc)
            .AsQueryable();

        if (branchId.HasValue && branchId.Value > 0)
        {
            query = query.Where(o => o.BranchId == branchId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(o => o.Status == status.Value);
        }

        var orders = await query.Take(50).ToListAsync();

        var response = orders.Select(o => new OrderResponseDto(
            o.Id,
            o.BranchId,
            o.Branch?.Name ?? "",
            o.OrderNumber,
            string.IsNullOrWhiteSpace(o.InvoiceNumber) ? $"INV-{o.OrderNumber}" : o.InvoiceNumber,
            o.OrderType,
            o.Status,
            o.PaymentStatus,
            o.CustomerName,
            o.CustomerPhone,
            o.DeliveryAddress,
            null,
            o.CashierStaffName,
            o.SubTotal,
            o.DiscountAmount,
            o.TaxAmount,
            o.ServiceCharge,
            o.DeliveryFee,
            o.TotalAmount,
            o.PaidAmount,
            o.OutstandingAmount,
            o.IsVoid,
            o.PrintCount,
            o.TotalIngredientBOMCost,
            o.EstimatedGrossProfit,
            o.CreatedAtUtc,
            o.Items.Select(i => new OrderItemResponseDto(
                i.Id,
                i.MenuItemId,
                i.ItemName,
                null,
                i.UnitPrice,
                i.Quantity,
                i.LineTotal,
                i.UnitBOMCostAtSale,
                i.AddOns.Select(a => a.AddOnName).ToList()
            )).ToList(),
            o.Payments.Select(p => new PaymentResponseDto(
                p.Id,
                p.Amount,
                p.Method,
                p.Status,
                p.TransactionReference,
                p.ReceivedByStaffName,
                p.PaymentDateUtc
            )).ToList()
        )).ToList();

        return Ok(response);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrderById(long id, [FromQuery] string? phone = null)
    {
        var order = await _context.Orders
            .Include(o => o.Branch)
            .Include(o => o.Payments)
            .Include(o => o.DiningTable)
            .Include(o => o.Items).ThenInclude(i => i.AddOns)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound(new { message = "Order not found." });

        if (!IsOrderAccessible(order, phone))
        {
            return Forbid();
        }

        var response = new OrderResponseDto(
            order.Id,
            order.BranchId,
            order.Branch?.Name ?? "",
            order.OrderNumber,
            string.IsNullOrWhiteSpace(order.InvoiceNumber) ? $"INV-{order.OrderNumber}" : order.InvoiceNumber,
            order.OrderType,
            order.Status,
            order.PaymentStatus,
            order.CustomerName,
            order.CustomerPhone,
            order.DeliveryAddress,
            order.DiningTable?.TableNumber,
            order.CashierStaffName,
            order.SubTotal,
            order.DiscountAmount,
            order.TaxAmount,
            order.ServiceCharge,
            order.DeliveryFee,
            order.TotalAmount,
            order.PaidAmount,
            order.OutstandingAmount,
            order.IsVoid,
            order.PrintCount,
            order.TotalIngredientBOMCost,
            order.EstimatedGrossProfit,
            order.CreatedAtUtc,
            order.Items.Select(i => new OrderItemResponseDto(
                i.Id,
                i.MenuItemId,
                i.ItemName,
                null,
                i.UnitPrice,
                i.Quantity,
                i.LineTotal,
                i.UnitBOMCostAtSale,
                i.AddOns.Select(a => a.AddOnName).ToList()
            )).ToList(),
            order.Payments.Select(p => new PaymentResponseDto(
                p.Id,
                p.Amount,
                p.Method,
                p.Status,
                p.TransactionReference,
                p.ReceivedByStaffName,
                p.PaymentDateUtc
            )).ToList()
        );

        return Ok(response);
    }

    /// <summary>
    /// Gets professional invoice data for the given order.
    /// </summary>
    [HttpGet("{id}/invoice")]
    public async Task<IActionResult> GetInvoice(long id, [FromQuery] string? phone = null)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!IsOrderAccessible(order, phone))
        {
            return Forbid();
        }

        var result = await _orderEngine.GetOrderInvoiceAsync(id);
        if (result.IsFailure) return NotFound(new { message = result.Error });

        return Ok(result.Value);
    }

    /// <summary>
    /// Generates A4 PDF tax invoice for download.
    /// </summary>
    [HttpGet("{id}/invoice/pdf")]
    public async Task<IActionResult> DownloadInvoicePdf(long id, [FromQuery] string? phone = null)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!IsOrderAccessible(order, phone))
        {
            return Forbid();
        }

        var result = await _orderEngine.GetOrderInvoiceAsync(id);
        if (result.IsFailure) return NotFound(new { message = result.Error });

        var invoice = result.Value;
        var pdfBytes = _pdfService.GenerateA4InvoicePdf(invoice);
        string fileName = $"Invoice_{invoice.InvoiceNumber}.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }

    /// <summary>
    /// Generates thermal receipt PDF for download or printing (58mm or 80mm).
    /// </summary>
    [HttpGet("{id}/invoice/receipt-pdf")]
    public async Task<IActionResult> DownloadReceiptPdf(long id, [FromQuery] string? phone = null, [FromQuery] int width = 80)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (!IsOrderAccessible(order, phone))
        {
            return Forbid();
        }

        var result = await _orderEngine.GetOrderInvoiceAsync(id);
        if (result.IsFailure) return NotFound(new { message = result.Error });

        var invoice = result.Value;
        var pdfBytes = _pdfService.GenerateThermalReceiptPdf(invoice, width == 58 ? 58 : 80);
        string fileName = $"Receipt_{invoice.InvoiceNumber}_{width}mm.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }

    /// <summary>
    /// Records print/reprint audit event.
    /// </summary>
    [HttpPost("{id}/print")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Cashier")]
    public async Task<IActionResult> RecordPrint(long id, [FromBody] RecordPrintRequestDto? request = null)
    {
        var accessError = await CheckStaffOrderBranchAccessAsync(id);
        if (accessError is not null) return accessError;
        var staffName = request?.StaffName ?? _currentUser.UserEmail ?? "Cashier";
        var format = request?.PrintFormat ?? "Thermal80";
        var result = await _orderEngine.RecordPrintAsync(id, staffName, format);
        if (result.IsFailure) return NotFound(new { message = result.Error });

        return Ok(new { message = "Print event recorded.", orderId = id, printTime = DateTime.UtcNow });
    }

    /// <summary>
    /// Voids an order with audit trail.
    /// </summary>
    [HttpPost("{id}/void")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> VoidOrder(long id, [FromBody] VoidOrderRequestDto request)
    {
        var accessError = await CheckStaffOrderBranchAccessAsync(id);
        if (accessError is not null) return accessError;
        var staffName = request.StaffName ?? _currentUser.UserEmail ?? "Admin";
        var result = await _orderEngine.VoidOrderAsync(id, request.Reason, staffName);
        if (result.IsFailure) return NotFound(new { message = result.Error });

        return Ok(new { message = "Order voided successfully.", orderId = id });
    }

    /// <summary>
    /// Adds payment to order.
    /// </summary>
    [HttpPost("{id}/payments")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Cashier")]
    public async Task<IActionResult> AddPayment(long id, [FromBody] InitialPaymentDto paymentDto)
    {
        var accessError = await CheckStaffOrderBranchAccessAsync(id);
        if (accessError is not null) return accessError;
        var result = await _orderEngine.AddPaymentAsync(id, paymentDto);
        if (result.IsFailure) return BadRequest(new { message = result.Error });

        return Ok(result.Value);
    }

    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Cashier,Chef")]
    public async Task<IActionResult> UpdateStatus(long id, [FromBody] OrderStatus newStatus)
    {
        var accessError = await CheckStaffOrderBranchAccessAsync(id);
        if (accessError is not null) return accessError;
        var result = await _orderEngine.UpdateOrderStatusAsync(id, newStatus);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(new { message = $"Order status updated to {newStatus}." });
    }

    [HttpGet("{id}/profit")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> GetOrderProfit(long id)
    {
        var accessError = await CheckStaffOrderBranchAccessAsync(id);
        if (accessError is not null) return accessError;
        var breakdown = await _orderEngine.GetOrderProfitBreakdownAsync(id);
        if (breakdown == null) return NotFound(new { message = "Order not found." });

        return Ok(breakdown);
    }

    private bool IsOrderAccessible(KabirKitchen.Domain.Entities.Orders.Order order, string? phone = null)
    {
        // 1. Staff access check with branch isolation
        if (IsStaffUser())
        {
            return _currentUser.HasAccessToBranch(order.BranchId);
        }

        // 2. Authenticated customer check
        if (_currentUser.UserId.HasValue)
        {
            return order.CustomerUserId.HasValue && order.CustomerUserId.Value == _currentUser.UserId.Value;
        }

        // 3. Unauthenticated guest order tracking: permitted if phone matches order customer phone
        if (!string.IsNullOrWhiteSpace(phone) && !string.IsNullOrWhiteSpace(order.CustomerPhone))
        {
            return string.Equals(order.CustomerPhone.Trim(), phone.Trim(), StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    private bool IsStaffUser()
    {
        return User.IsInRole("Admin") ||
               User.IsInRole("SuperAdmin") ||
               User.IsInRole("BranchManager") ||
               User.IsInRole("Cashier") ||
               User.IsInRole("Chef");
    }

    private async Task<IActionResult?> CheckStaffOrderBranchAccessAsync(long orderId)
    {
        var branchId = await _context.Orders
            .Where(order => order.Id == orderId)
            .Select(order => (long?)order.BranchId)
            .FirstOrDefaultAsync();
        if (!branchId.HasValue) return NotFound(new { message = "Order not found." });
        return _currentUser.HasAccessToBranch(branchId.Value) ? null : Forbid();
    }
}

public record VoidOrderRequestDto(string Reason, string? StaffName = null);
