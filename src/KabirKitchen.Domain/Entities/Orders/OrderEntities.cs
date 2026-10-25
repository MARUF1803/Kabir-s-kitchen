using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Identity;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Orders;

public class Order : BaseEntity, ISoftDelete
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public string OrderNumber { get; set; } = string.Empty; // e.g., "KK-DHN-20261008-001"
    public string InvoiceNumber { get; set; } = string.Empty; // e.g., "INV-DHN-20261008-001"
    public string? IdempotencyKey { get; set; }

    public OrderType OrderType { get; set; } = OrderType.Delivery;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;

    // Customer link
    public long? CustomerUserId { get; set; }
    public User? CustomerUser { get; set; }

    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? DeliveryAddress { get; set; }

    // Dine-in link
    public long? DiningTableId { get; set; }
    public DiningTable? DiningTable { get; set; }

    // Staff/Cashier metadata
    public long? CashierUserId { get; set; }
    public string? CashierStaffName { get; set; }

    // Amounts (strictly server-calculated)
    public decimal SubTotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public long? PromotionCampaignId { get; set; }
    public string? PromotionCampaignName { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal TaxAmount { get; set; } // 5% standard Bangladesh VAT
    public decimal ServiceCharge { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal OutstandingAmount => Math.Max(0, TotalAmount - PaidAmount);
    public decimal RefundAmount { get; set; }

    // Void and Cancel status
    public bool IsVoid { get; set; }
    public string? VoidReason { get; set; }
    public DateTime? VoidedAtUtc { get; set; }
    public string? VoidedByStaffName { get; set; }

    // Thermal Receipt & Invoice Print Audit
    public int PrintCount { get; set; }
    public DateTime? LastPrintedAtUtc { get; set; }
    public string? PrintedByStaffName { get; set; }

    // True Gross Profit & Cost tracking
    public decimal TotalIngredientBOMCost { get; set; } // Auto-calculated from Recipe BOM
    public decimal PackagingCost { get; set; } = 0;
    public decimal DeliveryCost { get; set; } = 0;
    public decimal EstimatedGrossProfit => (TotalAmount - DeliveryFee) - TotalIngredientBOMCost - PackagingCost - DeliveryCost;

    public string? CustomerNotes { get; set; }
    public string? KitchenNotes { get; set; }
    public DateTime? ScheduledDeliveryTimeUtc { get; set; }

    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public string? DeletedBy { get; set; }

    // Navigations
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<OrderPayment> Payments { get; set; } = new List<OrderPayment>();
}

public class OrderItem : BaseEntity
{
    public long OrderId { get; set; }
    public Order? Order { get; set; }

    public long MenuItemId { get; set; }
    public MenuItem? MenuItem { get; set; }

    public long? MenuItemVariantId { get; set; }
    public MenuItemVariant? MenuItemVariant { get; set; }

    public string ItemName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal => UnitPrice * Quantity;

    // Cost snapshot
    public decimal UnitBOMCostAtSale { get; set; }
    public decimal TotalItemBOMCost => UnitBOMCostAtSale * Quantity;

    public string? SpecialInstructions { get; set; }

    public ICollection<OrderItemAddOn> AddOns { get; set; } = new List<OrderItemAddOn>();
}

public class OrderItemAddOn : BaseEntity
{
    public long OrderItemId { get; set; }
    public OrderItem? OrderItem { get; set; }

    public long AddOnId { get; set; }
    public AddOn? AddOn { get; set; }

    public string AddOnName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; } = 1;
    public decimal LineTotal => UnitPrice * Quantity;
}

public class OrderPayment : BaseEntity
{
    public long OrderId { get; set; }
    public Order? Order { get; set; }

    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Paid;
    public string? TransactionReference { get; set; }
    public string? ReceivedByStaffName { get; set; }
    public DateTime PaymentDateUtc { get; set; } = DateTime.UtcNow;
}
