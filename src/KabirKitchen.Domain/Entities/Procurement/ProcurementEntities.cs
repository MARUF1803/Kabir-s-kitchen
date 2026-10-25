using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Procurement;

public class Supplier : BaseEntity, ISoftDelete
{
    public string Name { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public decimal TotalPayableBalance { get; set; } = 0;
    public bool IsActive { get; set; } = true;

    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public string? DeletedBy { get; set; }

    public ICollection<PurchaseOrder> PurchaseOrders { get; set; } = new List<PurchaseOrder>();
}

public class PurchaseOrder : BaseEntity
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public long SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    public string PoNumber { get; set; } = string.Empty; // e.g., "PO-20261008-001"
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Draft;
    
    public decimal SubTotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal DueAmount => TotalAmount - PaidAmount;

    public DateTime OrderDateUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReceivedDateUtc { get; set; }
    public string? InvoiceOrChallanNumber { get; set; }
    public string? Notes { get; set; }

    public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
    public ICollection<PurchasePayment> Payments { get; set; } = new List<PurchasePayment>();
}

public class PurchaseOrderItem : BaseEntity
{
    public long PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }

    public long IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public decimal QuantityOrdered { get; set; }
    public decimal QuantityReceived { get; set; }
    public UnitType UnitUsed { get; set; }
    public decimal UnitCost { get; set; }
    public decimal LineTotal => QuantityReceived > 0 ? QuantityReceived * UnitCost : QuantityOrdered * UnitCost;
}

public class PurchasePayment : BaseEntity
{
    public long PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }

    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public string? TransactionReference { get; set; }
    public string? Notes { get; set; }
    public DateTime PaymentDateUtc { get; set; } = DateTime.UtcNow;
}
