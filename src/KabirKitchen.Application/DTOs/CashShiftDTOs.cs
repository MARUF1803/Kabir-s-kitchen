using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Application.DTOs;

// ── Request DTOs ─────────────────────────────────────────────────────────────

public record OpenShiftDto(
    long BranchId,
    decimal OpeningFloat,
    string CashierStaffName
);

public record CloseShiftDto(
    decimal ActualCashCounted,
    string? ZReportNotes
);

public record CashDropDto(
    long ShiftId,
    decimal DropAmount,
    string? Notes
);

// ── Response DTO ─────────────────────────────────────────────────────────────

public record CashShiftResponseDto(
    long Id,
    long BranchId,
    string BranchName,
    string ShiftReferenceNumber,
    string CashierStaffName,
    DateTime OpenedAtUtc,
    DateTime? ClosedAtUtc,
    decimal OpeningFloat,
    decimal TotalCashSales,
    decimal TotalCardSales,
    decimal TotalMfsSales,
    decimal CashDropAmount,
    decimal ExpectedCashInDrawer,
    decimal? ActualCashCounted,
    decimal? VarianceOverShort,
    CashShiftStatus Status,
    string StatusLabel,
    string? ZReportNotes
);

