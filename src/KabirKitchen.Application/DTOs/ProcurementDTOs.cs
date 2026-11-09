using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Application.DTOs;

public record SupplierDto(
    long Id,
    string Name,
    string ContactPerson,
    string Phone,
    string Email,
    string Address,
    decimal TotalPayableBalance,
    bool IsActive
);

public record CreateSupplierDto(
    string Name,
    string ContactPerson,
    string Phone,
    string Email,
    string Address
);

public record UpdateSupplierDto(
    string Name,
    string ContactPerson,
    string Phone,
    string Email,
    string Address,
    bool IsActive
);

public record PurchaseOrderItemDto(
    long IngredientId,
    string? IngredientName,
    decimal QuantityOrdered,
    decimal QuantityReceived,
    UnitType UnitUsed,
    decimal UnitCost,
    decimal LineTotal
);

public record CreatePurchaseOrderItemDto(
    long IngredientId,
    decimal QuantityOrdered,
    UnitType UnitUsed,
    decimal UnitCost
);

public record CreatePurchaseOrderDto(
    long BranchId,
    long SupplierId,
    string? InvoiceOrChallanNumber,
    string? Notes,
    List<CreatePurchaseOrderItemDto> Items
);

public record PurchasePaymentDto(
    long Id,
    decimal Amount,
    PaymentMethod Method,
    string? TransactionReference,
    string? Notes,
    DateTime PaymentDateUtc
);

public record PurchaseOrderResponseDto(
    long Id,
    long BranchId,
    string BranchName,
    long SupplierId,
    string SupplierName,
    string PoNumber,
    PurchaseOrderStatus Status,
    decimal SubTotal,
    decimal TaxAmount,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal DueAmount,
    DateTime OrderDateUtc,
    DateTime? ReceivedDateUtc,
    string? InvoiceOrChallanNumber,
    string? Notes,
    List<PurchaseOrderItemDto> Items,
    List<PurchasePaymentDto> Payments
);

public record ReceivePurchaseOrderItemDto(
    long PurchaseOrderItemId,
    decimal QuantityReceived,
    decimal? ActualUnitCost = null,
    DateTime? ExpiryDateUtc = null
);

public record ReceivePurchaseOrderDto(
    string? InvoiceOrChallanNumber,
    string? Notes,
    List<ReceivePurchaseOrderItemDto> ReceivedItems,
    DateTime? ActualReceivedDateUtc = null  // Optional: actual physical receipt date; defaults to server time
);

public record RecordPurchasePaymentDto(
    long BranchId,
    decimal Amount,
    PaymentMethod Method,
    string? TransactionReference,
    string? Notes
);
