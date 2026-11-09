using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Entities.Kitchen;
using KabirKitchen.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReservationsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public ReservationsController(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    // ── POST api/reservations — public, no auth required ─────────────────────
    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> CreateReservation(
        [FromBody] CreateReservationRequestDto dto,
        CancellationToken ct)
    {
        if (dto.GuestCount < 1 || dto.GuestCount > 50)
            return BadRequest(new { error = "Guest count must be between 1 and 50." });
        if (dto.ReservationDateUtc <= DateTime.UtcNow)
            return BadRequest(new { error = "Reservation date must be in the future." });
        if (string.IsNullOrWhiteSpace(dto.CustomerName))
            return BadRequest(new { error = "Customer name is required." });
        if (string.IsNullOrWhiteSpace(dto.CustomerPhone))
            return BadRequest(new { error = "Customer phone is required." });

        var branch = await _context.Branches.FindAsync(new object[] { dto.BranchId }, ct);
        if (branch == null) return NotFound(new { error = "Branch not found." });

        // Generate reference code: RES-{BranchCode}-{YYYYMMDD}-{NNNN}
        var dateStr = dto.ReservationDateUtc.ToString("yyyyMMdd");
        var branchCode = (branch.Name ?? "BRN").Replace(" ", "").ToUpperInvariant()[..Math.Min(3, (branch.Name ?? "BRN").Length)];
        var countToday = await _context.TableReservations
            .Where(r => r.BranchId == dto.BranchId
                        && r.ReservationDateUtc.Date == dto.ReservationDateUtc.Date)
            .CountAsync(ct);
        var refCode = $"RES-{branchCode}-{dateStr}-{(countToday + 1):D4}";

        var reservation = new TableReservation
        {
            BranchId = dto.BranchId,
            CustomerUserId = _currentUser.UserId,
            ReferenceCode = refCode,
            CustomerName = dto.CustomerName.Trim(),
            CustomerPhone = dto.CustomerPhone.Trim(),
            CustomerEmail = dto.CustomerEmail?.Trim(),
            ReservationDateUtc = dto.ReservationDateUtc,
            GuestCount = dto.GuestCount,
            SpecialRequests = dto.SpecialRequests?.Trim(),
            Status = ReservationStatus.Pending,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.TableReservations.Add(reservation);
        await _context.SaveChangesAsync(ct);

        return Ok(new
        {
            id = reservation.Id,
            referenceCode = reservation.ReferenceCode,
            status = reservation.Status.ToString(),
            message = "Reservation submitted! You will receive a confirmation soon."
        });
    }

    // ── GET api/reservations — staff only ─────────────────────────────────────
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetReservations(
        [FromQuery] long? branchId,
        [FromQuery] DateTime? date,
        [FromQuery] ReservationStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = _context.TableReservations
            .Include(r => r.Branch)
            .AsQueryable();

        if (branchId.HasValue)
            query = query.Where(r => r.BranchId == branchId.Value);
        if (date.HasValue)
            query = query.Where(r => r.ReservationDateUtc.Date == date.Value.Date);
        if (status.HasValue)
            query = query.Where(r => r.Status == status.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(r => r.ReservationDateUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => MapToDto(r))
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }

    // ── GET api/reservations/{id} ─────────────────────────────────────────────
    [HttpGet("{id:long}")]
    [Authorize]
    public async Task<IActionResult> GetById(long id, CancellationToken ct)
    {
        var r = await _context.TableReservations
            .Include(r => r.Branch)
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        if (r == null) return NotFound();
        return Ok(MapToDto(r));
    }

    // ── PUT api/reservations/{id}/confirm ─────────────────────────────────────
    [HttpPut("{id:long}/confirm")]
    [Authorize(Roles = "Admin,BranchManager,Supervisor")]
    public async Task<IActionResult> Confirm(long id, [FromBody] ConfirmReservationDto dto, CancellationToken ct)
    {
        var r = await _context.TableReservations.FindAsync(new object[] { id }, ct);
        if (r == null) return NotFound();
        if (r.Status != ReservationStatus.Pending)
            return BadRequest(new { error = $"Cannot confirm a reservation with status {r.Status}." });

        r.Status = ReservationStatus.Confirmed;
        r.AssignedTableNumber = dto.AssignedTableNumber?.Trim();
        r.StaffNotes = dto.StaffNotes?.Trim();
        r.ConfirmedByUserId = _currentUser.UserId;
        r.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        return Ok(new { message = "Reservation confirmed.", referenceCode = r.ReferenceCode });
    }

    // ── PUT api/reservations/{id}/reject ──────────────────────────────────────
    [HttpPut("{id:long}/reject")]
    [Authorize(Roles = "Admin,BranchManager,Supervisor")]
    public async Task<IActionResult> Reject(long id, [FromBody] RejectReservationDto dto, CancellationToken ct)
    {
        var r = await _context.TableReservations.FindAsync(new object[] { id }, ct);
        if (r == null) return NotFound();
        if (r.Status == ReservationStatus.Seated || r.Status == ReservationStatus.Completed)
            return BadRequest(new { error = "Cannot reject an already seated or completed reservation." });

        r.Status = ReservationStatus.Rejected;
        r.RejectionReason = dto.Reason?.Trim();
        r.ConfirmedByUserId = _currentUser.UserId;
        r.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        return Ok(new { message = "Reservation rejected." });
    }

    // ── PUT api/reservations/{id}/seat ────────────────────────────────────────
    [HttpPut("{id:long}/seat")]
    [Authorize]
    public async Task<IActionResult> Seat(long id, CancellationToken ct)
    {
        var r = await _context.TableReservations.FindAsync(new object[] { id }, ct);
        if (r == null) return NotFound();
        if (r.Status != ReservationStatus.Confirmed)
            return BadRequest(new { error = "Only confirmed reservations can be marked as seated." });

        r.Status = ReservationStatus.Seated;
        r.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        return Ok(new { message = "Guest seated." });
    }

    // ── PUT api/reservations/{id}/complete ────────────────────────────────────
    [HttpPut("{id:long}/complete")]
    [Authorize]
    public async Task<IActionResult> Complete(long id, CancellationToken ct)
    {
        var r = await _context.TableReservations.FindAsync(new object[] { id }, ct);
        if (r == null) return NotFound();
        if (r.Status != ReservationStatus.Seated)
            return BadRequest(new { error = "Only seated reservations can be completed." });

        r.Status = ReservationStatus.Completed;
        r.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        return Ok(new { message = "Reservation completed." });
    }

    // ── PUT api/reservations/{id}/cancel ─────────────────────────────────────
    [HttpPut("{id:long}/cancel")]
    [AllowAnonymous]
    public async Task<IActionResult> Cancel(long id, [FromQuery] string? reason, CancellationToken ct)
    {
        var r = await _context.TableReservations.FindAsync(new object[] { id }, ct);
        if (r == null) return NotFound();
        if (r.Status == ReservationStatus.Seated || r.Status == ReservationStatus.Completed)
            return BadRequest(new { error = "Cannot cancel a seated or completed reservation." });

        r.Status = ReservationStatus.Cancelled;
        r.RejectionReason = reason?.Trim();
        r.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        return Ok(new { message = "Reservation cancelled." });
    }

    // ── Mapper ────────────────────────────────────────────────────────────────
    private static ReservationResponseDto MapToDto(TableReservation r) => new(
        r.Id,
        r.BranchId,
        r.Branch?.Name ?? "",
        r.ReferenceCode,
        r.CustomerName,
        r.CustomerPhone,
        r.CustomerEmail,
        r.ReservationDateUtc,
        r.GuestCount,
        r.SpecialRequests,
        r.Status,
        r.Status.ToString(),
        r.AssignedTableNumber,
        r.RejectionReason,
        r.StaffNotes,
        r.CreatedAtUtc
    );
}

