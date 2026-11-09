using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Entities.Orders;
using KabirKitchen.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/cash-shifts")]
[Authorize]
public class CashShiftsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public CashShiftsController(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    // ── POST api/cash-shifts/open ───────────────────────────────────────────
    [HttpPost("open")]
    public async Task<IActionResult> OpenShift([FromBody] OpenShiftDto dto, CancellationToken ct)
    {
        var branch = await _context.Branches.FindAsync(new object[] { dto.BranchId }, ct);
        if (branch == null) return NotFound(new { error = "Branch not found." });

        var cashierUserId = _currentUser.UserId ?? 1; // Default to current user or fallback to system admin

        // Check if an open shift already exists for this branch/cashier
        var existingOpenShift = await _context.CashShifts
            .Include(s => s.Branch)
            .FirstOrDefaultAsync(s => s.BranchId == dto.BranchId && s.CashierUserId == cashierUserId && s.Status == CashShiftStatus.Open, ct);

        if (existingOpenShift != null)
        {
            return Ok(new
            {
                message = "An active open shift already exists.",
                shift = MapToDto(existingOpenShift)
            });
        }

        var today = DateTime.UtcNow;
        var dateStr = today.ToString("yyyyMMdd");
        var branchCode = (branch.Name ?? "BRN").Replace(" ", "").ToUpperInvariant()[..Math.Min(3, (branch.Name ?? "BRN").Length)];
        var shiftCount = await _context.CashShifts.CountAsync(s => s.BranchId == dto.BranchId && s.OpenedAtUtc.Date == today.Date, ct);
        var refNum = $"SFT-{branchCode}-{dateStr}-{(shiftCount + 1):D3}";

        var staffName = string.IsNullOrWhiteSpace(dto.CashierStaffName)
            ? (_currentUser.UserEmail ?? "Cashier")
            : dto.CashierStaffName.Trim();

        var shift = new CashShift
        {
            BranchId = dto.BranchId,
            CashierUserId = cashierUserId,
            ShiftReferenceNumber = refNum,
            CashierStaffName = staffName,
            OpenedAtUtc = DateTime.UtcNow,
            OpeningFloat = Math.Max(0, dto.OpeningFloat),
            ExpectedCashInDrawer = Math.Max(0, dto.OpeningFloat),
            Status = CashShiftStatus.Open,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.CashShifts.Add(shift);
        await _context.SaveChangesAsync(ct);

        shift.Branch = branch;
        return Ok(MapToDto(shift));
    }

    // ── GET api/cash-shifts/current ─────────────────────────────────────────
    [HttpGet("current")]
    public async Task<IActionResult> GetCurrentShift([FromQuery] long branchId, CancellationToken ct)
    {
        var cashierUserId = _currentUser.UserId ?? 1;
        var shift = await _context.CashShifts
            .Include(s => s.Branch)
            .FirstOrDefaultAsync(s => s.BranchId == branchId && s.CashierUserId == cashierUserId && s.Status == CashShiftStatus.Open, ct);

        if (shift == null)
        {
            // Look for any open shift at this branch if user doesn't have one
            shift = await _context.CashShifts
                .Include(s => s.Branch)
                .OrderByDescending(s => s.OpenedAtUtc)
                .FirstOrDefaultAsync(s => s.BranchId == branchId && s.Status == CashShiftStatus.Open, ct);
        }

        if (shift == null) return NotFound(new { message = "No open shift found for this branch." });

        await RecalculateShiftSalesAsync(shift, ct);
        return Ok(MapToDto(shift));
    }

    // ── POST api/cash-shifts/{id}/cash-drop ──────────────────────────────────
    [HttpPost("{id:long}/cash-drop")]
    public async Task<IActionResult> RecordCashDrop(long id, [FromBody] CashDropDto dto, CancellationToken ct)
    {
        if (dto.DropAmount <= 0)
            return BadRequest(new { error = "Drop amount must be greater than zero." });

        var shift = await _context.CashShifts
            .Include(s => s.Branch)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (shift == null) return NotFound();
        if (shift.Status != CashShiftStatus.Open)
            return BadRequest(new { error = "Can only drop cash from an open shift." });

        await RecalculateShiftSalesAsync(shift, ct);

        shift.CashDropAmount += dto.DropAmount;
        shift.ExpectedCashInDrawer = shift.OpeningFloat + shift.TotalCashSales - shift.CashDropAmount;
        if (!string.IsNullOrWhiteSpace(dto.Notes))
        {
            shift.ZReportNotes = string.IsNullOrWhiteSpace(shift.ZReportNotes)
                ? $"[Cash Drop: {dto.DropAmount:N2} - {dto.Notes}]"
                : $"{shift.ZReportNotes} | [Cash Drop: {dto.DropAmount:N2} - {dto.Notes}]";
        }
        shift.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        return Ok(MapToDto(shift));
    }

    // ── POST api/cash-shifts/{id}/close ─────────────────────────────────────
    [HttpPost("{id:long}/close")]
    public async Task<IActionResult> CloseShift(long id, [FromBody] CloseShiftDto dto, CancellationToken ct)
    {
        var shift = await _context.CashShifts
            .Include(s => s.Branch)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (shift == null) return NotFound();
        if (shift.Status != CashShiftStatus.Open)
            return BadRequest(new { error = "This shift is already closed." });

        await RecalculateShiftSalesAsync(shift, ct);

        shift.ClosedAtUtc = DateTime.UtcNow;
        shift.ActualCashCounted = dto.ActualCashCounted;
        shift.ExpectedCashInDrawer = shift.OpeningFloat + shift.TotalCashSales - shift.CashDropAmount;
        shift.VarianceOverShort = dto.ActualCashCounted - shift.ExpectedCashInDrawer;
        shift.Status = CashShiftStatus.Closed;
        shift.ZReportNotes = dto.ZReportNotes ?? shift.ZReportNotes;
        shift.ClosingSupervisorUserId = _currentUser.UserId;
        shift.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        return Ok(MapToDto(shift));
    }

    // ── GET api/cash-shifts ─────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetShifts(
        [FromQuery] long? branchId,
        [FromQuery] DateTime? date,
        [FromQuery] CashShiftStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default)
    {
        var query = _context.CashShifts
            .Include(s => s.Branch)
            .AsQueryable();

        if (branchId.HasValue)
            query = query.Where(s => s.BranchId == branchId.Value);
        if (date.HasValue)
            query = query.Where(s => s.OpenedAtUtc.Date == date.Value.Date);
        if (status.HasValue)
            query = query.Where(s => s.Status == status.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(s => s.OpenedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Ok(new
        {
            total,
            page,
            pageSize,
            items = items.Select(MapToDto)
        });
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    private async Task RecalculateShiftSalesAsync(CashShift shift, CancellationToken ct)
    {
        var startUtc = shift.OpenedAtUtc;
        var endUtc = shift.ClosedAtUtc ?? DateTime.UtcNow;

        // Sum order payments completed in this branch during this time window
        var payments = await _context.OrderPayments
            .Where(p => p.Order != null
                     && p.Order.BranchId == shift.BranchId
                     && p.CreatedAtUtc >= startUtc
                     && p.CreatedAtUtc <= endUtc
                     && p.Status == PaymentStatus.Paid)
            .GroupBy(p => p.Method)
            .Select(g => new { Method = g.Key, Total = g.Sum(x => x.Amount) })
            .ToListAsync(ct);

        shift.TotalCashSales = payments.FirstOrDefault(p => p.Method == PaymentMethod.Cash)?.Total ?? 0m;
        shift.TotalCardSales = payments.FirstOrDefault(p => p.Method == PaymentMethod.Card)?.Total ?? 0m;
        shift.TotalMfsSales = payments.Where(p => p.Method == PaymentMethod.bKash || p.Method == PaymentMethod.Nagad).Sum(p => p.Total);
        shift.ExpectedCashInDrawer = shift.OpeningFloat + shift.TotalCashSales - shift.CashDropAmount;
    }

    private static CashShiftResponseDto MapToDto(CashShift s) => new(
        s.Id,
        s.BranchId,
        s.Branch?.Name ?? "",
        s.ShiftReferenceNumber,
        s.CashierStaffName,
        s.OpenedAtUtc,
        s.ClosedAtUtc,
        s.OpeningFloat,
        s.TotalCashSales,
        s.TotalCardSales,
        s.TotalMfsSales,
        s.CashDropAmount,
        s.ExpectedCashInDrawer,
        s.ActualCashCounted,
        s.VarianceOverShort,
        s.Status,
        s.Status.ToString(),
        s.ZReportNotes
    );
}
