using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Kitchen;

public class KitchenTicket : BaseEntity
{
    public long OrderId { get; set; }
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public string TicketNumber { get; set; } = string.Empty; // e.g. "KDS-001"
    public OrderStatus Status { get; set; } = OrderStatus.Confirmed; // Confirmed -> Preparing -> Ready
    public int PriorityLevel { get; set; } = 1; // 1 Normal, 2 High, 3 Urgent

    public DateTime ReceivedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? StartedPreparingAtUtc { get; set; }
    public DateTime? ReadyAtUtc { get; set; }
    public long? AssignedChefUserId { get; set; }
    public string? ChefRemarks { get; set; }
}

public class WastageRecord : BaseEntity
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public long IngredientId { get; set; }
    public Ingredient? Ingredient { get; set; }

    public decimal QuantityWasted { get; set; }
    public UnitType UnitUsed { get; set; }
    public decimal UnitCostAtWastage { get; set; }
    public decimal TotalCostLoss => QuantityWasted * UnitCostAtWastage;

    public string Reason { get; set; } = string.Empty; // "Expired", "Burnt in Cooking", "Spilled", "Quality Check Failed"
    public long? ReportedByUserId { get; set; }
    public string? StaffName { get; set; }
    public DateTime RecordedAtUtc { get; set; } = DateTime.UtcNow;
}
