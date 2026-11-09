using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Application.DTOs;

// ── Request DTOs ─────────────────────────────────────────────────────────────

public record CreateReservationRequestDto(
    long BranchId,
    string CustomerName,
    string CustomerPhone,
    string? CustomerEmail,
    DateTime ReservationDateUtc,     // Expected as UTC ISO-8601
    int GuestCount,
    string? SpecialRequests
);

public record ConfirmReservationDto(
    string AssignedTableNumber,
    string? StaffNotes
);

public record RejectReservationDto(
    string Reason
);

public record SeatReservationDto(
    string? Notes
);

// ── Response DTO ─────────────────────────────────────────────────────────────

public record ReservationResponseDto(
    long Id,
    long BranchId,
    string BranchName,
    string ReferenceCode,
    string CustomerName,
    string CustomerPhone,
    string? CustomerEmail,
    DateTime ReservationDateUtc,
    int GuestCount,
    string? SpecialRequests,
    ReservationStatus Status,
    string StatusLabel,
    string? AssignedTableNumber,
    string? RejectionReason,
    string? StaffNotes,
    DateTime CreatedAtUtc
);

