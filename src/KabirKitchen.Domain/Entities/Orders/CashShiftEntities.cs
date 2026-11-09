using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Identity;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Orders;

public class CashShift : BaseEntity
{
    public long BranchId { get; set; }
    public virtual Branch Branch { get; set; } = null!;

    public long CashierUserId { get; set; }
    public virtual User CashierUser { get; set; } = null!;

    public string ShiftReferenceNumber { get; set; } = string.Empty;
    public string CashierStaffName { get; set; } = string.Empty;

    public DateTime OpenedAtUtc { get; set; }
    public DateTime? ClosedAtUtc { get; set; }

    public decimal OpeningFloat { get; set; }
    public decimal TotalCashSales { get; set; }
    public decimal TotalCardSales { get; set; }
    public decimal TotalMfsSales { get; set; }
    public decimal CashDropAmount { get; set; }
    public decimal ExpectedCashInDrawer { get; set; }
    public decimal? ActualCashCounted { get; set; }
    public decimal? VarianceOverShort { get; set; }

    public CashShiftStatus Status { get; set; } = CashShiftStatus.Open;
    public string? ZReportNotes { get; set; }
    public long? ClosingSupervisorUserId { get; set; }
}

