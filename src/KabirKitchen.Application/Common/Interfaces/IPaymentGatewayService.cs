using KabirKitchen.Domain.Common;

namespace KabirKitchen.Application.Common.Interfaces;

public interface IPaymentGatewayService
{
    Task<Result<PaymentInitResult>> InitiateBkashPaymentAsync(long orderId, decimal amount, string orderNumber);
    Task<Result<PaymentVerificationResult>> ExecuteBkashPaymentAsync(string paymentId, string orderNumber);
    Task<Result<PaymentInitResult>> InitiateSslCommerzPaymentAsync(long orderId, decimal amount, string orderNumber, string customerName, string customerPhone, string customerEmail);
    Task<Result<PaymentVerificationResult>> ValidateSslCommerzPaymentAsync(string valId, string tranId, decimal amount);
}

public record PaymentInitResult(string PaymentId, string RedirectUrl, string Gateway);
public record PaymentVerificationResult(
    bool IsSuccess,
    string TransactionId,
    decimal Amount,
    string GatewayReference,
    string? ErrorMessage,
    string? MerchantInvoiceNumber = null);
