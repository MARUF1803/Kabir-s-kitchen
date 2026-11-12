using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Application.DTOs;

public record CreateCustomCakeRequestDto(
    long BranchId,
    string CustomerName,
    string CustomerPhone,
    string? DeliveryAddress,
    decimal WeightKg,
    string Flavor,
    string CreamType,
    string TierCount,
    string? ColorTheme,
    string? MessageOnCake,
    string? ReferenceImageUrl,
    DateTime DeliveryDate,
    string DeliveryTimeSlot,
    long MenuItemId,
    string? CouponCode
);

public record QuoteCustomCakeRequestDto(
    long BranchId,
    long MenuItemId,
    decimal WeightKg,
    string? CouponCode
);

public record CustomCakePriceQuoteDto(
    long BranchId,
    long MenuItemId,
    decimal WeightKg,
    decimal SubTotal,
    decimal DiscountAmount,
    decimal EstimatedPrice,
    decimal AdvanceRequiredAmount,
    string? CampaignName,
    DateTime? CampaignEndDateUtc
);

public record VerifyCakeAdvancePaymentDto(
    long CakeCustomOrderId,
    decimal AdvanceAmountPaid,
    string PaymentTransactionRef,
    string VerifiedByStaffName
);

public record CakeCustomOrderResponseDto(
    long Id,
    long BranchId,
    string BranchName,
    string CustomOrderNumber,
    string CustomerName,
    string CustomerPhone,
    decimal WeightKg,
    string Flavor,
    string CreamType,
    string? MessageOnCake,
    string? ReferenceImageUrl,
    DateTime DeliveryDate,
    string DeliveryTimeSlot,
    long? MenuItemId,
    decimal SubTotal,
    decimal DiscountAmount,
    decimal EstimatedPrice,
    long? PromotionCampaignId,
    string? PromotionCampaignName,
    decimal AdvanceRequiredAmount,
    decimal AdvancePaidAmount,
    bool IsAdvanceVerified,
    CakeOrderStatus Status,
    string? AdvancePaymentTransactionRef = null
);

public record SubmitCakePaymentProofDto(
    long CakeCustomOrderId,
    string PaymentMethod,
    string SenderPhoneOrAccount,
    string TransactionId,
    decimal PaidAmount,
    string? CustomerNote = null
);

public record CakeProductionCalendarSlotDto(
    DateTime DeliveryDate,
    string TimeSlot,
    int TotalCakesBooked,
    int CapacityLimit,
    bool IsSlotFull,
    List<string> CakeSummaries
);

public record BakeryAggregatedBOMPlanDto(
    DateTime TargetDate,
    int TotalCakesCount,
    List<AggregatedIngredientRequirementDto> RequiredIngredients
);

public record ApplyCakeSpecialDiscountDto(
    long CakeCustomOrderId,
    decimal DiscountAmount,
    string? Reason
);

public record AggregatedIngredientRequirementDto(
    string IngredientName,
    decimal TotalQuantityNeeded,
    UnitType UnitUsed,
    decimal CurrentStockOnBranch,
    bool IsStockSufficient
);
