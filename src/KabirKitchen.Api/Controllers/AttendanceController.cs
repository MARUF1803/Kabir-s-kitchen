using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Domain.Entities.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttendanceController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public AttendanceController(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Biometric & Terminal Punch Endpoint (Supports Fingerprint, Face, POS terminal, Web)
    /// Automatically detects Check-In vs Check-Out based on daily attendance state.
    /// </summary>
    [HttpPost("punch")]
    [AllowAnonymous] // Biometric devices/kiosks can punch via API token or directly
    public async Task<IActionResult> RecordPunch([FromBody] PunchRequestDto dto)
    {
        User? user = null;
        if (dto.UserId.HasValue && dto.UserId.Value > 0)
        {
            user = await _context.Users.FindAsync(dto.UserId.Value);
        }
        else if (!string.IsNullOrWhiteSpace(dto.EmailOrPhone))
        {
            var cleanKey = dto.EmailOrPhone.Trim().ToLower();
            user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == cleanKey || u.PhoneNumber == cleanKey);
        }

        if (user == null || user.IsDeleted || !user.IsActive)
        {
            return NotFound(new { message = "Active staff member not found with provided credentials." });
        }

        var punchTimeUtc = dto.PunchTimeUtc ?? DateTime.UtcNow;
        var bdTime = punchTimeUtc.AddHours(6); // Bangladesh Standard Time (UTC+6)
        var todayDate = bdTime.Date;

        long branchId = dto.BranchId;
        if (branchId <= 0)
        {
            var primaryBranch = await _context.UserBranchAssignments
                .Where(b => b.UserId == user.Id)
                .Select(b => b.BranchId)
                .FirstOrDefaultAsync();
            branchId = primaryBranch > 0 ? primaryBranch : 1;
        }

        var existingAttendance = await _context.StaffAttendances
            .FirstOrDefaultAsync(a => a.UserId == user.Id && a.AttendanceDate == todayDate);

        var shiftStartToday = todayDate.AddHours(9);  // 09:00 AM BD Time
        var shiftEndToday = todayDate.AddHours(18);    // 06:00 PM BD Time
        const int graceMinutes = 15;                  // 15 Minutes Grace Period

        if (existingAttendance == null)
        {
            // ── FIRST PUNCH OF THE DAY: CHECK-IN ──
            int lateMinutes = 0;
            string status = "Present";

            var graceDeadline = shiftStartToday.AddMinutes(graceMinutes);
            if (bdTime > graceDeadline)
            {
                lateMinutes = (int)(bdTime - shiftStartToday).TotalMinutes;
                status = "Late";
            }

            var newAttendance = new StaffAttendance
            {
                UserId = user.Id,
                BranchId = branchId,
                AttendanceDate = todayDate,
                CheckInTimeUtc = punchTimeUtc,
                ShiftStartTime = new TimeSpan(9, 0, 0),
                ShiftEndTime = new TimeSpan(18, 0, 0),
                GraceMinutesAllowed = graceMinutes,
                LateMinutes = lateMinutes,
                Status = status,
                PunchSource = dto.PunchSource ?? "Biometric_Fingerprint",
                DeviceSerialOrIp = dto.DeviceSerialOrIp,
                Remarks = dto.Remarks ?? (lateMinutes > 0 ? $"Late check-in by {lateMinutes} mins" : "On-time arrival")
            };

            _context.StaffAttendances.Add(newAttendance);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                type = "CheckIn",
                staffName = user.FullName,
                checkInTime = bdTime.ToString("hh:mm:ss tt"),
                status,
                lateMinutes,
                isLate = lateMinutes > 0,
                message = lateMinutes > 0
                    ? $"স্বাগতম {user.FullName}! চেক-ইন সফল হয়েছে ({lateMinutes} মিনিট লেট)।"
                    : $"স্বাগতম {user.FullName}! অন-টাইম চেক-ইন সম্পন্ন হয়েছে।"
            });
        }
        else
        {
            // ── SUBSEQUENT PUNCH: CHECK-OUT ──
            existingAttendance.CheckOutTimeUtc = punchTimeUtc;
            existingAttendance.UpdatedAtUtc = DateTime.UtcNow;

            var inTimeBd = (existingAttendance.CheckInTimeUtc ?? punchTimeUtc).AddHours(6);
            var workHours = (decimal)(bdTime - inTimeBd).TotalHours;
            existingAttendance.TotalWorkHours = Math.Max(0, Math.Round(workHours, 2));

            int earlyExitMinutes = 0;
            decimal overtimeHours = 0;

            if (bdTime < shiftEndToday)
            {
                earlyExitMinutes = (int)(shiftEndToday - bdTime).TotalMinutes;
                existingAttendance.EarlyExitMinutes = earlyExitMinutes;
                if (existingAttendance.Status != "Late")
                {
                    existingAttendance.Status = "EarlyLeave";
                }
            }
            else if (bdTime > shiftEndToday)
            {
                overtimeHours = Math.Round((decimal)(bdTime - shiftEndToday).TotalHours, 2);
                existingAttendance.OvertimeHours = overtimeHours;
                if (overtimeHours >= 0.5m)
                {
                    existingAttendance.Status = "Overtime";
                }
            }

            if (!string.IsNullOrWhiteSpace(dto.PunchSource))
            {
                existingAttendance.PunchSource = dto.PunchSource;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                type = "CheckOut",
                staffName = user.FullName,
                checkOutTime = bdTime.ToString("hh:mm:ss tt"),
                totalWorkHours = existingAttendance.TotalWorkHours,
                earlyExitMinutes,
                overtimeHours,
                status = existingAttendance.Status,
                message = overtimeHours > 0
                    ? $"বিদায় {user.FullName}! চেক-আউট সম্পন্ন হয়েছে (মোট কাজ: {existingAttendance.TotalWorkHours:0.##} ঘণ্টা, ওভারটাইম: {overtimeHours:0.##} ঘণ্টা)।"
                    : $"বিদায় {user.FullName}! চেক-আউট সম্পন্ন হয়েছে (মোট কাজ: {existingAttendance.TotalWorkHours:0.##} ঘণ্টা)।"
            });
        }
    }

    /// <summary>
    /// GET /api/attendance/daily — Retrieves daily attendance sheet for all staff in branch
    /// </summary>
    [HttpGet("daily")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> GetDailyAttendance(
        [FromQuery] long? branchId = null,
        [FromQuery] DateTime? date = null)
    {
        var targetDate = (date ?? DateTime.UtcNow).AddHours(6).Date;

        var staffQuery = _context.Users
            .Include(u => u.Roles).ThenInclude(r => r.Role)
            .Include(u => u.BranchAssignments).ThenInclude(b => b.Branch)
            .Where(u => !u.IsGlobalSuperAdmin && u.IsActive && !u.IsDeleted)
            .AsQueryable();

        if (branchId.HasValue && branchId.Value > 0)
        {
            staffQuery = staffQuery.Where(u => u.BranchAssignments.Any(b => b.BranchId == branchId.Value));
        }

        var staffList = await staffQuery.OrderBy(u => u.FullName).ToListAsync();

        var attendances = await _context.StaffAttendances
            .Where(a => a.AttendanceDate == targetDate && (!branchId.HasValue || a.BranchId == branchId.Value))
            .ToListAsync();

        var records = staffList.Select(staff =>
        {
            var att = attendances.FirstOrDefault(a => a.UserId == staff.Id);
            var inTimeBd = att?.CheckInTimeUtc.HasValue == true ? att.CheckInTimeUtc.Value.AddHours(6).ToString("hh:mm tt") : null;
            var outTimeBd = att?.CheckOutTimeUtc.HasValue == true ? att.CheckOutTimeUtc.Value.AddHours(6).ToString("hh:mm tt") : null;

            return new
            {
                userId = staff.Id,
                fullName = staff.FullName,
                email = staff.Email,
                phoneNumber = staff.PhoneNumber,
                role = staff.Roles.FirstOrDefault()?.Role?.Name ?? "Staff",
                branchName = staff.BranchAssignments.FirstOrDefault(b => b.IsPrimary)?.Branch?.Name ?? "Main Branch",
                attendanceId = att?.Id,
                date = targetDate.ToString("yyyy-MM-dd"),
                checkIn = inTimeBd,
                checkOut = outTimeBd,
                lateMinutes = att?.LateMinutes ?? 0,
                earlyExitMinutes = att?.EarlyExitMinutes ?? 0,
                totalWorkHours = att?.TotalWorkHours ?? 0,
                overtimeHours = att?.OvertimeHours ?? 0,
                status = att != null ? att.Status : "Absent",
                punchSource = att?.PunchSource ?? "—",
                remarks = att?.Remarks
            };
        }).ToList();

        var summary = new
        {
            totalStaff = records.Count,
            presentCount = records.Count(r => r.status != "Absent"),
            lateCount = records.Count(r => r.lateMinutes > 0),
            overtimeCount = records.Count(r => r.overtimeHours > 0),
            absentCount = records.Count(r => r.status == "Absent")
        };

        return Ok(new { date = targetDate.ToString("yyyy-MM-dd"), summary, records });
    }

    /// <summary>
    /// POST /api/attendance/manual — Admin manual correction for attendance
    /// </summary>
    [HttpPost("manual")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> ManualAdjustment([FromBody] ManualAttendanceDto dto)
    {
        var targetDate = dto.Date.Date;
        var record = await _context.StaffAttendances
            .FirstOrDefaultAsync(a => a.UserId == dto.UserId && a.AttendanceDate == targetDate);

        if (record == null)
        {
            record = new StaffAttendance
            {
                UserId = dto.UserId,
                BranchId = dto.BranchId > 0 ? dto.BranchId : 1,
                AttendanceDate = targetDate,
                CheckInTimeUtc = dto.CheckInTimeUtc,
                CheckOutTimeUtc = dto.CheckOutTimeUtc,
                LateMinutes = dto.LateMinutes,
                TotalWorkHours = dto.TotalWorkHours,
                OvertimeHours = dto.OvertimeHours,
                Status = dto.Status ?? "Present",
                PunchSource = "Manual_Admin",
                Remarks = dto.Remarks ?? "Manually updated by Administrator"
            };
            _context.StaffAttendances.Add(record);
        }
        else
        {
            if (dto.CheckInTimeUtc.HasValue) record.CheckInTimeUtc = dto.CheckInTimeUtc;
            if (dto.CheckOutTimeUtc.HasValue) record.CheckOutTimeUtc = dto.CheckOutTimeUtc;
            record.LateMinutes = dto.LateMinutes;
            record.TotalWorkHours = dto.TotalWorkHours;
            record.OvertimeHours = dto.OvertimeHours;
            if (!string.IsNullOrWhiteSpace(dto.Status)) record.Status = dto.Status;
            record.Remarks = dto.Remarks ?? "Updated by Administrator";
            record.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Attendance record updated successfully." });
    }
}

public record PunchRequestDto(
    long? UserId,
    string? EmailOrPhone,
    long BranchId,
    DateTime? PunchTimeUtc,
    string? PunchSource,
    string? DeviceSerialOrIp,
    string? Remarks
);

public record ManualAttendanceDto(
    long UserId,
    long BranchId,
    DateTime Date,
    DateTime? CheckInTimeUtc,
    DateTime? CheckOutTimeUtc,
    int LateMinutes,
    decimal TotalWorkHours,
    decimal OvertimeHours,
    string? Status,
    string? Remarks
);
