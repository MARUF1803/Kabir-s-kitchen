using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Domain.Common;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Globalization;
using System.Web;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace KabirKitchen.Infrastructure.Services;

public class PaymentGatewayService : IPaymentGatewayService
{
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<PaymentGatewayService> _logger;
    private readonly IHostEnvironment _environment;

    public PaymentGatewayService(
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<PaymentGatewayService> logger,
        IHostEnvironment environment)
    {
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _environment = environment;
    }

    public async Task<Result<PaymentInitResult>> InitiateBkashPaymentAsync(long orderId, decimal amount, string orderNumber)
    {
        var appKey = _configuration["PaymentGateways:bKash:AppKey"];
        var baseUrl = _configuration["PaymentGateways:bKash:BaseUrl"];

        if (string.IsNullOrWhiteSpace(appKey) ||
            string.IsNullOrWhiteSpace(_configuration["PaymentGateways:bKash:AppSecret"]) ||
            string.IsNullOrWhiteSpace(_configuration["PaymentGateways:bKash:Username"]) ||
            string.IsNullOrWhiteSpace(_configuration["PaymentGateways:bKash:Password"]) ||
            string.IsNullOrWhiteSpace(baseUrl))
        {
            return Result<PaymentInitResult>.Failure("bKash is not configured. Contact the site administrator.");
        }

        if (!_environment.IsDevelopment() &&
            (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var bkashUri) ||
             bkashUri.Scheme != Uri.UriSchemeHttps ||
             bkashUri.Host.Contains("sandbox", StringComparison.OrdinalIgnoreCase)))
        {
            return Result<PaymentInitResult>.Failure("bKash must use a valid production HTTPS gateway URL.");
        }

        var callbackUrl = _configuration["PaymentGateways:bKash:CallbackUrl"];
        if (string.IsNullOrWhiteSpace(callbackUrl) ||
            !_environment.IsDevelopment() &&
            (!Uri.TryCreate(callbackUrl, UriKind.Absolute, out var callbackUri) ||
             callbackUri.Scheme != Uri.UriSchemeHttps))
        {
            return Result<PaymentInitResult>.Failure("A valid HTTPS bKash callback URL must be configured.");
        }

        try
        {
            var client = _httpClientFactory.CreateClient("bKash");
            var tokenResult = await GetBkashIdTokenAsync(client, baseUrl, appKey);
            if (tokenResult.IsFailure)
            {
                return Result<PaymentInitResult>.Failure(tokenResult.Error!);
            }

            var payload = new
            {
                mode = "0011",
                payerReference = orderNumber,
                callbackURL = callbackUrl,
                amount = amount.ToString("F2", CultureInfo.InvariantCulture),
                currency = "BDT",
                intent = "sale",
                merchantInvoiceNumber = orderNumber
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl.TrimEnd('/')}/tokenized/checkout/create")
            {
                Content = JsonContent.Create(payload)
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenResult.Value);
            request.Headers.Add("X-APP-Key", appKey);
            var response = await client.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return Result<PaymentInitResult>.Failure("Failed to initiate payment session with bKash.");
            }

            var json = await response.Content.ReadFromJsonAsync<BkashCreateResponse>();
            if (json == null ||
                string.IsNullOrWhiteSpace(json.PaymentID) ||
                !Uri.TryCreate(json.BkashURL, UriKind.Absolute, out var redirectUri) ||
                redirectUri.Scheme != Uri.UriSchemeHttps)
            {
                return Result<PaymentInitResult>.Failure("Invalid response from bKash gateway.");
            }

            return Result<PaymentInitResult>.Success(new PaymentInitResult(json.PaymentID, json.BkashURL, "bKash"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while initiating bKash payment for order {OrderId}", orderId);
            return Result<PaymentInitResult>.Failure($"bKash gateway error: {ex.Message}");
        }
    }

    public async Task<Result<PaymentVerificationResult>> ExecuteBkashPaymentAsync(string paymentId, string orderNumber)
    {
        var appKey = _configuration["PaymentGateways:bKash:AppKey"];

        if (string.IsNullOrWhiteSpace(appKey))
        {
            return Result<PaymentVerificationResult>.Failure("bKash is not configured.");
        }

        try
        {
            var baseUrl = _configuration["PaymentGateways:bKash:BaseUrl"];
            if (string.IsNullOrWhiteSpace(baseUrl) ||
                !_environment.IsDevelopment() &&
                (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var bkashUri) ||
                 bkashUri.Scheme != Uri.UriSchemeHttps ||
                 bkashUri.Host.Contains("sandbox", StringComparison.OrdinalIgnoreCase)))
            {
                return Result<PaymentVerificationResult>.Failure("bKash gateway URL is not configured correctly.");
            }

            var client = _httpClientFactory.CreateClient("bKash");
            var tokenResult = await GetBkashIdTokenAsync(client, baseUrl, appKey);
            if (tokenResult.IsFailure)
            {
                return Result<PaymentVerificationResult>.Failure(tokenResult.Error!);
            }

            using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl.TrimEnd('/')}/tokenized/checkout/execute")
            {
                Content = JsonContent.Create(new { paymentID = paymentId })
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenResult.Value);
            request.Headers.Add("X-APP-Key", appKey);
            var response = await client.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                return Result<PaymentVerificationResult>.Failure("bKash payment execution failed.");
            }

            var json = await response.Content.ReadFromJsonAsync<BkashExecuteResponse>();
            if (json != null && json.StatusCode == "0000")
            {
                if (string.IsNullOrWhiteSpace(json.PaymentID) ||
                    !string.Equals(json.PaymentID, paymentId, StringComparison.Ordinal) ||
                    !decimal.TryParse(json.Amount, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount) ||
                    amount <= 0 ||
                    string.IsNullOrWhiteSpace(json.TrxID) ||
                    string.IsNullOrWhiteSpace(json.MerchantInvoiceNumber))
                {
                    return Result<PaymentVerificationResult>.Failure("bKash returned incomplete or mismatched payment details.");
                }

                return Result<PaymentVerificationResult>.Success(new PaymentVerificationResult(
                    true, json.TrxID, amount, paymentId, null, json.MerchantInvoiceNumber
                ));
            }

            return Result<PaymentVerificationResult>.Failure(json?.StatusMessage ?? "Payment not completed.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "bKash execution failed for {PaymentId}", paymentId);
            return Result<PaymentVerificationResult>.Failure(ex.Message);
        }
    }

    public async Task<Result<PaymentInitResult>> InitiateSslCommerzPaymentAsync(
        long orderId, decimal amount, string orderNumber, string customerName, string customerPhone, string customerEmail)
    {
        var storeId = _configuration["PaymentGateways:SSLCommerz:StoreId"];
        var isSandbox = _configuration.GetValue<bool>("PaymentGateways:SSLCommerz:IsSandbox", true);
        if (!_environment.IsDevelopment() && isSandbox)
        {
            return Result<PaymentInitResult>.Failure("SSLCommerz sandbox mode cannot be used in production.");
        }

        var baseUrl = isSandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com";

        var storePassword = _configuration["PaymentGateways:SSLCommerz:StorePassword"];
        if (string.IsNullOrWhiteSpace(storeId) || string.IsNullOrWhiteSpace(storePassword))
        {
            return Result<PaymentInitResult>.Failure("SSLCommerz is not configured. Contact the site administrator.");
        }

        var ipnUrl = _configuration["PaymentGateways:SSLCommerz:IpnUrl"];
        if (string.IsNullOrWhiteSpace(ipnUrl) ||
            !_environment.IsDevelopment() &&
            (!Uri.TryCreate(ipnUrl, UriKind.Absolute, out var ipnUri) || ipnUri.Scheme != Uri.UriSchemeHttps))
        {
            return Result<PaymentInitResult>.Failure("A valid HTTPS SSLCommerz callback URL must be configured.");
        }

        try
        {
            var client = _httpClientFactory.CreateClient("SSLCommerz");
            var formData = new Dictionary<string, string>
            {
                ["store_id"] = storeId,
                ["store_passwd"] = storePassword,
                ["total_amount"] = amount.ToString("F2", CultureInfo.InvariantCulture),
                ["currency"] = "BDT",
                ["tran_id"] = orderNumber,
                ["success_url"] = $"{ipnUrl}?status=success",
                ["fail_url"] = $"{ipnUrl}?status=fail",
                ["cancel_url"] = $"{ipnUrl}?status=cancel",
                ["cus_name"] = customerName,
                ["cus_email"] = string.IsNullOrWhiteSpace(customerEmail) ? "customer@kabirskitchen.com" : customerEmail,
                ["cus_phone"] = customerPhone,
                ["shipping_method"] = "NO",
                ["product_name"] = "Food Order",
                ["product_category"] = "Restaurant",
                ["product_profile"] = "general"
            };

            var response = await client.PostAsync($"{baseUrl}/gwprocess/v4/api.php", new FormUrlEncodedContent(formData));
            if (!response.IsSuccessStatusCode)
            {
                return Result<PaymentInitResult>.Failure("Failed to initiate SSLCommerz session.");
            }

            var json = await response.Content.ReadFromJsonAsync<SslCommerzInitResponse>();
            if (json == null ||
                json.Status != "SUCCESS" ||
                string.IsNullOrWhiteSpace(json.SessionKey) ||
                !Uri.TryCreate(json.GatewayPageURL, UriKind.Absolute, out var redirectUri) ||
                redirectUri.Scheme != Uri.UriSchemeHttps)
            {
                return Result<PaymentInitResult>.Failure(json?.FailedReason ?? "SSLCommerz initialization failed.");
            }

            return Result<PaymentInitResult>.Success(new PaymentInitResult(json.SessionKey, json.GatewayPageURL, "SSLCommerz"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SSLCommerz init failed for order {OrderId}", orderId);
            return Result<PaymentInitResult>.Failure(ex.Message);
        }
    }

    public async Task<Result<PaymentVerificationResult>> ValidateSslCommerzPaymentAsync(string valId, string tranId, decimal amount)
    {
        var isSandbox = _configuration.GetValue<bool>("PaymentGateways:SSLCommerz:IsSandbox", true);
        if (!_environment.IsDevelopment() && isSandbox)
        {
            return Result<PaymentVerificationResult>.Failure("SSLCommerz sandbox validation is disabled outside development.");
        }

        var storeId = _configuration["PaymentGateways:SSLCommerz:StoreId"];
        var storePassword = _configuration["PaymentGateways:SSLCommerz:StorePassword"];
        if (string.IsNullOrWhiteSpace(storeId) || string.IsNullOrWhiteSpace(storePassword))
        {
            return Result<PaymentVerificationResult>.Failure("SSLCommerz is not configured.");
        }

        try
        {
            var baseUrl = isSandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com";
            var client = _httpClientFactory.CreateClient("SSLCommerz");
            var query = HttpUtility.ParseQueryString(string.Empty);
            query["val_id"] = valId;
            query["store_id"] = storeId;
            query["store_passwd"] = storePassword;
            query["format"] = "json";
            var url = $"{baseUrl}/validator/api/validationserverAPI.php?{query}";
            var response = await client.GetFromJsonAsync<SslCommerzValidationResponse>(url);

            if (response != null &&
                (response.Status == "VALID" || response.Status == "VALIDATED") &&
                string.Equals(response.TranId, tranId, StringComparison.Ordinal) &&
                string.Equals(response.CurrencyType, "BDT", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(response.BankTranId) &&
                decimal.TryParse(response.CurrencyAmount, NumberStyles.Number, CultureInfo.InvariantCulture, out var validatedAmount) &&
                validatedAmount > 0 &&
                validatedAmount == amount)
            {
                return Result<PaymentVerificationResult>.Success(new PaymentVerificationResult(
                    true, response.BankTranId ?? response.TranId, validatedAmount, valId, null
                ));
            }

            return Result<PaymentVerificationResult>.Failure("SSLCommerz transaction validation failed.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SSLCommerz validation error for valId {ValId}", valId);
            return Result<PaymentVerificationResult>.Failure(ex.Message);
        }
    }

    private class BkashCreateResponse
    {
        public string PaymentID { get; set; } = string.Empty;
        public string BkashURL { get; set; } = string.Empty;
    }

    private async Task<Result<string>> GetBkashIdTokenAsync(HttpClient client, string baseUrl, string appKey)
    {
        var appSecret = _configuration["PaymentGateways:bKash:AppSecret"];
        var username = _configuration["PaymentGateways:bKash:Username"];
        var password = _configuration["PaymentGateways:bKash:Password"];
        if (string.IsNullOrWhiteSpace(appSecret) ||
            string.IsNullOrWhiteSpace(username) ||
            string.IsNullOrWhiteSpace(password))
        {
            return Result<string>.Failure("bKash credentials are incomplete.");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl.TrimEnd('/')}/tokenized/checkout/token/grant")
        {
            Content = JsonContent.Create(new { app_key = appKey, app_secret = appSecret })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{appKey}:{appSecret}")));
        request.Headers.Add("username", username);
        request.Headers.Add("password", password);
        request.Headers.Add("X-APP-Key", appKey);

        using var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            return Result<string>.Failure("bKash authentication failed.");
        }

        var token = await response.Content.ReadFromJsonAsync<BkashTokenResponse>();
        if (token == null || token.StatusCode != "0000" || string.IsNullOrWhiteSpace(token.IdToken))
        {
            return Result<string>.Failure("bKash did not issue a valid access token.");
        }

        return Result<string>.Success(token.IdToken);
    }

    private class BkashTokenResponse
    {
        public string StatusCode { get; set; } = string.Empty;
        public string IdToken { get; set; } = string.Empty;
    }

    private class BkashExecuteResponse
    {
        public string StatusCode { get; set; } = string.Empty;
        public string StatusMessage { get; set; } = string.Empty;
        public string PaymentID { get; set; } = string.Empty;
        public string TrxID { get; set; } = string.Empty;
        public string Amount { get; set; } = string.Empty;
        public string MerchantInvoiceNumber { get; set; } = string.Empty;
    }

    private class SslCommerzInitResponse
    {
        public string Status { get; set; } = string.Empty;
        public string FailedReason { get; set; } = string.Empty;
        public string SessionKey { get; set; } = string.Empty;
        public string GatewayPageURL { get; set; } = string.Empty;
    }

    private class SslCommerzValidationResponse
    {
        public string Status { get; set; } = string.Empty;
        public string TranId { get; set; } = string.Empty;
        public string? BankTranId { get; set; }
        public string CurrencyType { get; set; } = string.Empty;
        public string CurrencyAmount { get; set; } = string.Empty;
    }
}
