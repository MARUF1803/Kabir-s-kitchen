using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Bakery;

public class CakeCustomOrder : BaseEntity, ISoftDelete
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public long? AssociatedOrderId { get; set; }
    public string CustomOrderNumber { get; set; } = string.Empty; // e.g. "CAKE-20261008-001"

    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? DeliveryAddress { get; set; }

    // Cake specifications
    public decimal WeightKg { get; set; } = 1.0m;
    public string Flavor { get; set; } = "Chocolate Fudge"; // Chocolate, Vanilla, Red Velvet, Black Forest
    public string CreamType { get; set; } = "Fresh Cream";  // Fresh Cream, Buttercream, Fondant
    public string TierCount { get; set; } = "1 Tier";       // 1 Tier, 2 Tier
    public string? ColorTheme { get; set; }
    public string? MessageOnCake { get; set; }               // "Happy Birthday Rafi"
    public string? ReferenceImageUrl { get; set; }           // Uploaded design photo

    // Scheduling & Capacity
    public DateTime DeliveryDate { get; set; }
    public string DeliveryTimeSlot { get; set; } = "05:00 PM - 07:00 PM";

    // Pricing & 50% Advance Verification Rule
    public long? MenuItemId { get; set; }
    public decimal SubTotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal EstimatedPrice { get; set; }
    public long? PromotionCampaignId { get; set; }
    public string? PromotionCampaignName { get; set; }
    public decimal AdvanceRequiredAmount => EstimatedPrice * 0.50m;
    public decimal AdvancePaidAmount { get; set; } = 0;
    public bool IsAdvanceVerified { get; set; } = false; // Backend must prevent baking until true!
    public string? AdvancePaymentTransactionRef { get; set; }

    public CakeOrderStatus Status { get; set; } = CakeOrderStatus.Draft;
    public string? BakerNotes { get; set; }

    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public string? DeletedBy { get; set; }
}
