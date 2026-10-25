using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Application.DTOs;

public record InitialPaymentDto(
    decimal Amount,
    PaymentMethod Method,
    string? TransactionReference = null,
    string? ReceivedByStaffName = null
);

public record CreateOrderRequestDto(
    long BranchId,
    OrderType OrderType,
    string CustomerName,
    string CustomerPhone,
    string? DeliveryAddress = null,
    long? DiningTableId = null,
    string? CustomerNotes = null,
    decimal DiscountAmount = 0,
    decimal DeliveryFee = 0,
    string? CouponCode = null,
    string? IdempotencyKey = null,
    string? CashierStaffName = null,
    long? CashierUserId = null,
    DateTime? ScheduledDeliveryTimeUtc = null,
    List<CreateOrderItemDto>? Items = null,
    List<InitialPaymentDto>? InitialPayments = null
);

public record CreateOrderItemDto(
    long MenuItemId,
    long? MenuItemVariantId,
    int Quantity,
    string? SpecialInstructions = null,
    List<long>? SelectedAddOnIds = null
);

public record PaymentResponseDto(
    long Id,
    decimal Amount,
    PaymentMethod Method,
    PaymentStatus Status,
    string? TransactionReference,
    string? ReceivedByStaffName,
    DateTime PaymentDateUtc
);

public record OrderResponseDto(
    long Id,
    long BranchId,
    string BranchName,
    string OrderNumber,
    string InvoiceNumber,
    OrderType OrderType,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    string CustomerName,
    string CustomerPhone,
    string? DeliveryAddress,
    string? DiningTableNumber,
    string? CashierStaffName,
    decimal SubTotal,
    decimal DiscountAmount,
    decimal TaxAmount,
    decimal ServiceCharge,
    decimal DeliveryFee,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal OutstandingAmount,
    bool IsVoid,
    int PrintCount,
    decimal TotalIngredientBOMCost,
    decimal EstimatedGrossProfit,
    DateTime CreatedAtUtc,
    List<OrderItemResponseDto> Items,
    List<PaymentResponseDto> Payments
);

public record OrderItemResponseDto(
    long Id,
    long MenuItemId,
    string ItemName,
    string? VariantName,
    decimal UnitPrice,
    int Quantity,
    decimal LineTotal,
    decimal UnitBOMCost,
    List<string> AddOns
);

public record OrderGrossProfitDto(
    long OrderId,
    string OrderNumber,
    DateTime OrderDate,
    decimal SellingPriceTotal,
    decimal DiscountDeduction,
    decimal IngredientBOMCostTotal,
    decimal PackagingCost,
    decimal DeliveryCost,
    decimal NetGrossProfitAmount,
    decimal ProfitMarginPercent
);

// ─── Professional Invoice Model ───
public record InvoiceRestaurantInfo(
    string BrandName,
    string Slogan,
    string BinNumber, // Business Identification Number
    string TradeLicense,
    string Helpline,
    string Email,
    string Website,
    string BranchName,
    string BranchAddress,
    string BranchPhone
);

public record InvoiceItemDto(
    string ItemName,
    string? VariantName,
    List<string> AddOns,
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal
);

public record InvoiceDto(
    string InvoiceNumber,
    string OrderNumber,
    long OrderId,
    OrderType OrderType,
    OrderStatus OrderStatus,
    PaymentStatus PaymentStatus,
    DateTime InvoiceDateUtc,
    string FormattedDate,
    string FormattedTime,
    InvoiceRestaurantInfo Restaurant,
    string CustomerName,
    string CustomerPhone,
    string? DeliveryAddress,
    string? DiningTableNumber,
    string? CashierStaffName,
    List<InvoiceItemDto> Items,
    decimal SubTotal,
    decimal DiscountAmount,
    decimal TaxAmount, // 5% VAT
    decimal ServiceCharge,
    decimal DeliveryFee,
    decimal GrandTotal,
    decimal PaidAmount,
    decimal OutstandingAmount,
    decimal ChangeDue,
    List<PaymentResponseDto> Payments,
    bool IsVoid,
    string? VoidReason,
    int PrintCount,
    DateTime? LastPrintedAtUtc,
    string QrVerificationUrl,
    string ThankYouMessage
);

public record RecordPrintRequestDto(
    string? StaffName,
    string? PrintFormat // "Thermal58", "Thermal80", "A4Pdf"
);

