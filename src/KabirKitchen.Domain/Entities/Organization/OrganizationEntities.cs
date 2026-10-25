using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Identity;

namespace KabirKitchen.Domain.Entities.Organization;

public class Branch : BaseEntity, ISoftDelete
{
    public string BranchCode { get; set; } = string.Empty; // e.g. "DHN-01", "MIR-02"
    public string Name { get; set; } = string.Empty;       // Dhanmondi, Mirpur
    public string Address { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public TimeSpan OpeningTime { get; set; } = new TimeSpan(10, 0, 0);
    public TimeSpan ClosingTime { get; set; } = new TimeSpan(23, 0, 0);

    // Live counter cash drawer
    public decimal CashDrawerOpeningBalance { get; set; }
    public decimal CurrentCashDrawerBalance { get; set; }

    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public string? DeletedBy { get; set; }

    // Navigations
    public ICollection<UserBranchAssignment> StaffAssignments { get; set; } = new List<UserBranchAssignment>();
    public ICollection<DiningTable> DiningTables { get; set; } = new List<DiningTable>();
}

public class DiningTable : BaseEntity
{
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public string TableNumber { get; set; } = string.Empty;
    public int SeatingCapacity { get; set; } = 4;
    public bool IsOccupied { get; set; } = false;
    public string? ActiveOrderNumber { get; set; }
    public string? QrCodeKey { get; set; }
}
