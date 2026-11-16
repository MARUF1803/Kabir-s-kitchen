using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Organization;

namespace KabirKitchen.Domain.Entities.Identity;

public class StaffAttendance : BaseEntity
{
    public long UserId { get; set; }
    public User? User { get; set; }

    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public DateTime AttendanceDate { get; set; } // Midnight Date

    public DateTime? CheckInTimeUtc { get; set; }
    public DateTime? CheckOutTimeUtc { get; set; }

    public TimeSpan ShiftStartTime { get; set; } = new TimeSpan(9, 0, 0);
    public TimeSpan ShiftEndTime { get; set; } = new TimeSpan(18, 0, 0);
    public int GraceMinutesAllowed { get; set; } = 15;

    public int LateMinutes { get; set; } = 0;
    public int EarlyExitMinutes { get; set; } = 0;
    public decimal TotalWorkHours { get; set; } = 0;
    public decimal OvertimeHours { get; set; } = 0;

    public string Status { get; set; } = "Present"; // Present, Late, Overtime, HalfDay, EarlyLeave
    public string PunchSource { get; set; } = "Biometric"; // Biometric_Fingerprint, Biometric_Face, Web_Terminal, Manual
    public string? DeviceSerialOrIp { get; set; }
    public string? Remarks { get; set; }
}

