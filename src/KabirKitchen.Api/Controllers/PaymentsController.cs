using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IPaymentGatewayService _paymentGateway;
    private readonly OrderEngineService _orderEngine;
    private readonly INotificationService _notificationService;

    public PaymentsController(
        IApplicationDbContext context,
        IPaymentGatewayService paymentGateway,
        OrderEngineService orderEngine,
        INotificationService notificationService)
    {
        _context = context;
        _paymentGateway = paymentGateway;
        _orderEngine = orderEngine;
        _notificationService = notificationService;
    }

    [HttpPost("initiate")]
    public async Task<IActionResult> InitiatePayment([FromBody] InitiateDigitalPaymentRequestDto request)
    {
        var order = await _context.Orders.FindAsync(request.OrderId);
        if (order == null) return NotFound(new { message = "Order not found." });

        if (order.OutstandingAmount <= 0)
        {
            return BadRequest(new { message = "Order is already fully paid." });
        }

        if (request.Amount < 0 || request.Amount > order.OutstandingAmount)
        {
            return BadRequest(new { message = "Payment amount must not exceed the outstanding balance." });
        }

        decimal payable = request.Amount > 0 ? request.Amount : order.OutstandingAmount;
        if (payable <= 0)
        {
            return BadRequest(new { message = "Payment amount must be greater than zero." });
        }

        if (string.Equals(request.Gateway, "bKash", StringComparison.OrdinalIgnoreCase))
        {
            var result = await _paymentGateway.InitiateBkashPaymentAsync(order.Id, payable, order.OrderNumber);
            if (result.IsFailure) return BadRequest(new { message = result.Error });
            return Ok(result.Value);
        }
        else if (string.Equals(request.Gateway, "SSLCommerz", StringComparison.OrdinalIgnoreCase))
        {
            var result = await _paymentGateway.InitiateSslCommerzPaymentAsync(
                order.Id, payable, order.OrderNumber,
                order.CustomerName, order.CustomerPhone, "customer@kabirskitchen.com");
            if (result.IsFailure) return BadRequest(new { message = result.Error });
            return Ok(result.Value);
        }

        return BadRequest(new { message = "Unsupported payment gateway. Choose 'bKash' or 'SSLCommerz'." });
    }

    [HttpPost("bkash/callback")]
    public async Task<IActionResult> BkashCallback([FromBody] BkashCallbackDto dto)
    {
        if (!string.Equals(dto.Status, "success", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(dto.PaymentId))
        {
            return BadRequest(new { message = "bKash transaction was cancelled or unsuccessful." });
        }

        var order = await _context.Orders.FindAsync(dto.OrderId);
        if (order == null) return NotFound(new { message = "Order not found." });

        var execResult = await _paymentGateway.ExecuteBkashPaymentAsync(dto.PaymentId, order.OrderNumber);
        if (execResult.IsFailure || !execResult.Value.IsSuccess)
        {
            return BadRequest(new { message = execResult.Error ?? "bKash verification failed." });
        }

        if (execResult.Value.Amount <= 0 ||
            !string.Equals(execResult.Value.MerchantInvoiceNumber, order.OrderNumber, StringComparison.Ordinal))
        {
            return BadRequest(new { message = "Verified bKash payment does not match this order." });
        }

        var existingPayment = await _context.OrderPayments
            .AnyAsync(p => p.TransactionReference == execResult.Value.TransactionId);
        if (existingPayment)
        {
            return Ok(new { message = "This bKash payment was already processed.", orderId = order.Id });
        }

        if (execResult.Value.Amount > order.OutstandingAmount)
        {
            return BadRequest(new { message = "Verified bKash amount exceeds the outstanding order balance." });
        }

        decimal amountPaid = execResult.Value.Amount;

        var addPaymentResult = await _orderEngine.AddPaymentAsync(order.Id, new InitialPaymentDto(
            Amount: amountPaid,
            Method: PaymentMethod.bKash,
            TransactionReference: execResult.Value.TransactionId
        ));

        if (addPaymentResult.IsFailure)
        {
            return BadRequest(new { message = addPaymentResult.Error });
        }

        await _notificationService.NotifyAsync(
            order.CustomerUserId ?? 0,
            "bKash Payment Received",
            $"Payment of BDT {amountPaid} for order #{order.OrderNumber} received successfully via bKash. TrxID: {execResult.Value.TransactionId}"
        );

        return Ok(new
        {
            message = "bKash payment verified and credited to order.",
            orderId = order.Id,
            transactionId = execResult.Value.TransactionId,
            orderStatus = addPaymentResult.Value.Status,
            outstandingAmount = addPaymentResult.Value.OutstandingAmount
        });
    }

    [HttpPost("sslcommerz/ipn")]
    public async Task<IActionResult> SslCommerzIpn([FromForm] IFormCollection form)
    {
        string status = form["status"].ToString();
        string valId = form["val_id"].ToString();
        string tranId = form["tran_id"].ToString();
        if (!decimal.TryParse(form["amount"].ToString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var amount) ||
            amount <= 0 ||
            string.IsNullOrWhiteSpace(valId) ||
            string.IsNullOrWhiteSpace(tranId))
        {
            return BadRequest(new { message = "Transaction amount or reference is invalid." });
        }

        if (status != "VALID" && status != "VALIDATED")
        {
            return BadRequest(new { message = "Transaction status is not valid." });
        }

        var verifyResult = await _paymentGateway.ValidateSslCommerzPaymentAsync(valId, tranId, amount);
        if (verifyResult.IsFailure)
        {
            return BadRequest(new { message = verifyResult.Error });
        }

        var order = await _context.Orders.FirstOrDefaultAsync(o => o.OrderNumber == tranId);
        if (order == null) return NotFound(new { message = "Order not found for transaction." });

        var existingPayment = await _context.OrderPayments
            .AnyAsync(p => p.TransactionReference == verifyResult.Value.TransactionId);
        if (existingPayment)
        {
            return Ok(new { message = "This SSLCommerz payment was already processed.", orderId = order.Id });
        }

        if (verifyResult.Value.Amount <= 0 || verifyResult.Value.Amount > order.OutstandingAmount)
        {
            return BadRequest(new { message = "Verified SSLCommerz amount is invalid for this order." });
        }

        var addPaymentResult = await _orderEngine.AddPaymentAsync(order.Id, new InitialPaymentDto(
            Amount: verifyResult.Value.Amount,
            Method: PaymentMethod.Card,
            TransactionReference: verifyResult.Value.TransactionId
        ));
        if (addPaymentResult.IsFailure)
        {
            return BadRequest(new { message = addPaymentResult.Error });
        }

        await _notificationService.NotifyAsync(
            order.CustomerUserId ?? 0,
            "Card Payment Received",
            $"Payment of BDT {verifyResult.Value.Amount} for order #{order.OrderNumber} verified via SSLCommerz."
        );

        return Ok(new { message = "SSLCommerz IPN processed successfully." });
    }
}

public record InitiateDigitalPaymentRequestDto(long OrderId, string Gateway, decimal Amount = 0);
public record BkashCallbackDto(long OrderId, string PaymentId, string Status);
