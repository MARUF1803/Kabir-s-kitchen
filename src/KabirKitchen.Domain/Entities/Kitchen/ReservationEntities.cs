using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Identity;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Kitchen;

public class TableReservation : BaseEntity
{
    public long BranchId { get; set; }
    public virtual Branch Branch { get; set; } = null!;

    public long? CustomerUserId { get; set; }
    public virtual User? CustomerUser { get; set; }

    public string ReferenceCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }

    public DateTime ReservationDateUtc { get; set; }
    public int GuestCount { get; set; }
    public string? SpecialRequests { get; set; }

    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;
    public string? AssignedTableNumber { get; set; }
    public string? RejectionReason { get; set; }
    public long? ConfirmedByUserId { get; set; }
    public string? StaffNotes { get; set; }
}

