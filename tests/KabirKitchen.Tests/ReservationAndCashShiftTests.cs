using FluentAssertions;
using KabirKitchen.Domain.Entities.Kitchen;
using KabirKitchen.Domain.Entities.Orders;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Identity;
using KabirKitchen.Domain.Enums;
using Xunit;

namespace KabirKitchen.Tests;

public class ReservationAndCashShiftTests
{
    [Fact]
    public void TableReservation_InitialState_ShouldBePending()
    {
        var reservation = new TableReservation
        {
            BranchId = 1,
            CustomerName = "Tanvir Ahmed",
            CustomerPhone = "01711000000",
            ReservationDateUtc = DateTime.UtcNow.AddDays(1),
            GuestCount = 4,
            ReferenceCode = "RES-DHN-20261109-0001"
        };

        reservation.Status.Should().Be(ReservationStatus.Pending);
        reservation.AssignedTableNumber.Should().BeNull();
        reservation.GuestCount.Should().Be(4);
    }

    [Fact]
    public void TableReservation_Confirm_ShouldUpdateStatusAndTable()
    {
        var reservation = new TableReservation
        {
            BranchId = 1,
            CustomerName = "Rahim Mia",
            CustomerPhone = "01811000000",
            ReservationDateUtc = DateTime.UtcNow.AddDays(2),
            GuestCount = 6,
            ReferenceCode = "RES-GUL-20261109-0002"
        };

        // Act
        reservation.Status = ReservationStatus.Confirmed;
        reservation.AssignedTableNumber = "Table 12 (Window)";
        reservation.StaffNotes = "Anniversary celebration";

        // Assert
        reservation.Status.Should().Be(ReservationStatus.Confirmed);
        reservation.AssignedTableNumber.Should().Be("Table 12 (Window)");
        reservation.StaffNotes.Should().Be("Anniversary celebration");
    }

    [Fact]
    public void CashShift_ExpectedCash_ShouldCalculateProperly()
    {
        // Opening Float: 2000 BDT
        // Cash Sales: 15000 BDT
        // Cash Drop to safe: 5000 BDT
        // Expected Cash in Drawer = 2000 + 15000 - 5000 = 12000 BDT
        var shift = new CashShift
        {
            BranchId = 1,
            CashierUserId = 5,
            ShiftReferenceNumber = "SFT-DHN-20261109-001",
            CashierStaffName = "Counter Cashier",
            OpenedAtUtc = DateTime.UtcNow.AddHours(-6),
            OpeningFloat = 2000m,
            TotalCashSales = 15000m,
            TotalCardSales = 6000m,
            TotalMfsSales = 4500m,
            CashDropAmount = 5000m
        };

        shift.ExpectedCashInDrawer = shift.OpeningFloat + shift.TotalCashSales - shift.CashDropAmount;
        shift.ExpectedCashInDrawer.Should().Be(12000m);
    }

    [Fact]
    public void CashShift_ZReportClosing_ShouldCalculateShortageAndOverageAccurately()
    {
        // Case 1: Shortage
        var shift1 = new CashShift
        {
            OpeningFloat = 1000m,
            TotalCashSales = 5000m,
            CashDropAmount = 0m,
            ExpectedCashInDrawer = 6000m
        };

        // Actual physical cash counted: 5800 BDT (Short by 200 BDT)
        decimal countedShort = 5800m;
        shift1.ActualCashCounted = countedShort;
        shift1.VarianceOverShort = countedShort - shift1.ExpectedCashInDrawer;

        shift1.VarianceOverShort.Should().Be(-200m);

        // Case 2: Overage
        var shift2 = new CashShift
        {
            OpeningFloat = 1000m,
            TotalCashSales = 5000m,
            CashDropAmount = 0m,
            ExpectedCashInDrawer = 6000m
        };

        // Actual physical cash counted: 6150 BDT (Over by 150 BDT)
        decimal countedOver = 6150m;
        shift2.ActualCashCounted = countedOver;
        shift2.VarianceOverShort = countedOver - shift2.ExpectedCashInDrawer;

        shift2.VarianceOverShort.Should().Be(150m);
    }
}

