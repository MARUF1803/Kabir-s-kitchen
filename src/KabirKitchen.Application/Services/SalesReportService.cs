using System.Globalization;
using System.Text;
using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public record SalesReportFilterDto(
    long? BranchId = null,
    DateTime? StartDateUtc = null,
    DateTime? EndDateUtc = null,
    OrderType? OrderType = null,
    string? CashierStaffName = null
);

public record SalesSummaryDto(
    decimal GrossSales,
    decimal TotalDiscounts,
    decimal TotalTax,
    decimal TotalDeliveryFees,
    decimal TotalServiceCharges,
    decimal NetSales,
    int TotalOrders,
    decimal AverageOrderValue,
    decimal TotalCollected,
    decimal TotalOutstanding,
    decimal TotalRefunded,
    int VoidOrderCount,
    decimal VoidTotalAmount,
    decimal TotalCOGS = 0,
    decimal TotalWastageCost = 0,
    decimal TotalPackagingCost = 0,
    decimal TotalDeliveryCost = 0,
    decimal TotalExpenses = 0,
    decimal TotalGrossProfit = 0,
    decimal GrossProfitMarginPercent = 0
);

public record SalesByBranchDto(long BranchId, string BranchName, int OrderCount, decimal TotalSales, decimal PercentageOfTotal = 0);
public record SalesBySourceDto(OrderType OrderType, string SourceName, int OrderCount, decimal TotalSales);
public record SalesByPaymentMethodDto(PaymentMethod Method, string MethodName, int TransactionCount, decimal TotalAmount);
public record SalesByCategoryDto(string CategoryName, int QuantitySold, decimal TotalRevenue);
public record CashierShiftSummaryDto(string CashierName, int OrderCount, decimal TotalSales, decimal CashCollected, decimal DigitalCollected);

public record ProductPerformanceDto(
    long MenuItemId,
    string ProductName,
    string CategoryName,
    int QuantitySold,
    decimal TotalRevenue,
    decimal PercentageOfSales
);

public record SalesByTimeDto(
    string PeriodKey,
    string DisplayLabel,
    int OrderCount,
    decimal TotalSales,
    decimal AverageTicket
);

public record ExpenseHeadDto(
    string ExpenseCategory,
    string Description,
    decimal Amount,
    decimal PercentageOfRevenue
);

public record SalesReportResponseDto(
    DateTime GeneratedAtUtc,
    DateTime FromDateUtc,
    DateTime ToDateUtc,
    SalesSummaryDto Summary,
    List<SalesByBranchDto> ByBranch,
    List<SalesBySourceDto> BySource,
    List<SalesByPaymentMethodDto> ByPaymentMethod,
    List<SalesByCategoryDto> ByCategory,
    List<CashierShiftSummaryDto> CashierSummaries,
    List<OrderResponseDto> RecentOrders,
    List<ProductPerformanceDto> TopSellingProducts,
    List<ProductPerformanceDto> LowSellingProducts,
    List<SalesByTimeDto> ByMonth,
    List<SalesByTimeDto> ByDayOfWeek,
    List<SalesByTimeDto> DailyTimeline,
    List<ExpenseHeadDto> CostBreakdown,
    string PeakSalesDay,
    string SlowestSalesDay,
    string BestPerformingBranch
);

public class SalesReportService
{
    private readonly IApplicationDbContext _context;

    public SalesReportService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<SalesReportResponseDto>> GetSalesReportAsync(SalesReportFilterDto filter)
    {
        var fromDate = filter.StartDateUtc ?? DateTime.UtcNow.Date.AddDays(-30);
        var toDate = filter.EndDateUtc ?? DateTime.UtcNow;

        var query = _context.Orders
            .Include(o => o.Branch)
            .Include(o => o.Payments)
            .Include(o => o.Items).ThenInclude(i => i.MenuItem).ThenInclude(m => m!.Category)
            .Where(o => o.CreatedAtUtc >= fromDate && o.CreatedAtUtc <= toDate)
            .AsNoTracking();

        if (filter.BranchId.HasValue && filter.BranchId.Value > 0)
        {
            query = query.Where(o => o.BranchId == filter.BranchId.Value);
        }

        if (filter.OrderType.HasValue)
        {
            query = query.Where(o => o.OrderType == filter.OrderType.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.CashierStaffName))
        {
            query = query.Where(o => o.CashierStaffName == filter.CashierStaffName);
        }

        var allOrders = await query.ToListAsync();
        var validOrders = allOrders.Where(o => !o.IsVoid && o.Status != OrderStatus.Cancelled).ToList();
        var voidOrders = allOrders.Where(o => o.IsVoid || o.Status == OrderStatus.Cancelled).ToList();

        // 1. Summary Metrics
        decimal grossSales = validOrders.Sum(o => o.SubTotal);
        decimal totalDiscounts = validOrders.Sum(o => o.DiscountAmount);
        decimal totalTax = validOrders.Sum(o => o.TaxAmount);
        decimal totalDeliveryFees = validOrders.Sum(o => o.DeliveryFee);
        decimal totalServiceCharges = validOrders.Sum(o => o.ServiceCharge);
        decimal netSales = validOrders.Sum(o => o.TotalAmount);
        int totalOrdersCount = validOrders.Count;
        decimal aov = totalOrdersCount > 0 ? Math.Round(netSales / totalOrdersCount, 2) : 0;
        decimal totalCollected = validOrders.Sum(o => o.PaidAmount);
        decimal totalOutstanding = validOrders.Sum(o => o.OutstandingAmount);
        decimal totalRefunded = validOrders.Sum(o => o.RefundAmount);
        int voidCount = voidOrders.Count;
        decimal voidAmount = voidOrders.Sum(o => o.TotalAmount);

        // Cost and Expense Computations
        decimal totalCOGS = validOrders.Sum(o => o.TotalIngredientBOMCost);
        decimal totalPackaging = validOrders.Sum(o => o.PackagingCost);
        decimal totalDeliveryCost = validOrders.Sum(o => o.DeliveryCost);

        // Wastage Loss query
        var wastageQuery = _context.WastageRecords
            .Where(w => w.CreatedAtUtc >= fromDate && w.CreatedAtUtc <= toDate)
            .AsNoTracking();
        if (filter.BranchId.HasValue && filter.BranchId.Value > 0)
        {
            wastageQuery = wastageQuery.Where(w => w.BranchId == filter.BranchId.Value);
        }
        var wastageRecords = await wastageQuery.ToListAsync();
        decimal totalWastageCost = wastageRecords.Sum(w => w.QuantityWasted * w.UnitCostAtWastage);

        decimal totalExpenses = totalCOGS + totalWastageCost + totalPackaging + totalDeliveryCost;
        decimal totalGrossProfit = (grossSales - totalDiscounts) - totalExpenses;
        decimal profitMarginPercent = grossSales > 0 ? Math.Round((totalGrossProfit / grossSales) * 100, 2) : 0;

        var summary = new SalesSummaryDto(
            GrossSales: grossSales,
            TotalDiscounts: totalDiscounts,
            TotalTax: totalTax,
            TotalDeliveryFees: totalDeliveryFees,
            TotalServiceCharges: totalServiceCharges,
            NetSales: netSales,
            TotalOrders: totalOrdersCount,
            AverageOrderValue: aov,
            TotalCollected: totalCollected,
            TotalOutstanding: totalOutstanding,
            TotalRefunded: totalRefunded,
            VoidOrderCount: voidCount,
            VoidTotalAmount: voidAmount,
            TotalCOGS: totalCOGS,
            TotalWastageCost: totalWastageCost,
            TotalPackagingCost: totalPackaging,
            TotalDeliveryCost: totalDeliveryCost,
            TotalExpenses: totalExpenses,
            TotalGrossProfit: totalGrossProfit,
            GrossProfitMarginPercent: profitMarginPercent
        );

        // 2. By Branch
        var byBranch = validOrders
            .GroupBy(o => new { o.BranchId, BranchName = o.Branch?.Name ?? $"Branch #{o.BranchId}" })
            .Select(g => {
                var branchSales = g.Sum(o => o.TotalAmount);
                var pct = netSales > 0 ? Math.Round((branchSales / netSales) * 100, 1) : 0;
                return new SalesByBranchDto(g.Key.BranchId, g.Key.BranchName, g.Count(), branchSales, pct);
            })
            .OrderByDescending(b => b.TotalSales)
            .ToList();

        string bestBranch = byBranch.FirstOrDefault()?.BranchName ?? "N/A";

        // 3. By Source
        var bySource = validOrders
            .GroupBy(o => o.OrderType)
            .Select(g => new SalesBySourceDto(g.Key, g.Key.ToString(), g.Count(), g.Sum(o => o.TotalAmount)))
            .OrderByDescending(s => s.TotalSales)
            .ToList();

        // 4. By Payment Method
        var allPayments = validOrders.SelectMany(o => o.Payments).ToList();
        var byPaymentMethod = allPayments
            .GroupBy(p => p.Method)
            .Select(g => new SalesByPaymentMethodDto(g.Key, g.Key.ToString(), g.Count(), g.Sum(p => p.Amount)))
            .OrderByDescending(p => p.TotalAmount)
            .ToList();

        // 5. By Category
        var allItems = validOrders.SelectMany(o => o.Items).ToList();
        var byCategory = allItems
            .GroupBy(i => i.MenuItem?.Category?.Name ?? "General Menu")
            .Select(g => new SalesByCategoryDto(g.Key, g.Sum(i => i.Quantity), g.Sum(i => i.UnitPrice * i.Quantity)))
            .OrderByDescending(c => c.TotalRevenue)
            .Take(15)
            .ToList();

        // 6. Cashier Summaries
        var cashierSummaries = validOrders
            .GroupBy(o => string.IsNullOrWhiteSpace(o.CashierStaffName) ? "Online / Self-Checkout" : o.CashierStaffName)
            .Select(g => {
                var payments = g.SelectMany(o => o.Payments).ToList();
                decimal cash = payments.Where(p => p.Method == PaymentMethod.Cash).Sum(p => p.Amount);
                decimal digital = payments.Where(p => p.Method != PaymentMethod.Cash).Sum(p => p.Amount);
                return new CashierShiftSummaryDto(g.Key, g.Count(), g.Sum(o => o.TotalAmount), cash, digital);
            })
            .OrderByDescending(c => c.TotalSales)
            .ToList();

        // 7. Product Performance: Top Selling & Low Selling Products
        var productGroups = allItems
            .GroupBy(i => new { i.MenuItemId, Name = i.MenuItem?.Name ?? "Unknown Item", Category = i.MenuItem?.Category?.Name ?? "Menu" })
            .Select(g => {
                var qty = g.Sum(i => i.Quantity);
                var rev = g.Sum(i => i.UnitPrice * i.Quantity);
                var pct = netSales > 0 ? Math.Round((rev / netSales) * 100, 2) : 0;
                return new ProductPerformanceDto(g.Key.MenuItemId, g.Key.Name, g.Key.Category, qty, rev, pct);
            })
            .ToList();

        var topProducts = productGroups.OrderByDescending(p => p.QuantitySold).Take(10).ToList();
        var lowProducts = productGroups.OrderBy(p => p.QuantitySold).Take(10).ToList();

        // 8. Time Breakdown: By Month
        var byMonth = validOrders
            .GroupBy(o => o.CreatedAtUtc.ToString("yyyy-MM"))
            .OrderBy(g => g.Key)
            .Select(g => {
                var mSales = g.Sum(o => o.TotalAmount);
                var mCount = g.Count();
                var label = DateTime.TryParseExact(g.Key + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt)
                    ? dt.ToString("MMM yyyy")
                    : g.Key;
                return new SalesByTimeDto(g.Key, label, mCount, mSales, mCount > 0 ? Math.Round(mSales / mCount, 2) : 0);
            })
            .ToList();

        // 9. Time Breakdown: By Day of Week (Sun-Sat)
        var daysOrder = new[] { DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday, DayOfWeek.Saturday };
        var byDayOfWeek = daysOrder
            .Select(d => {
                var dayOrders = validOrders.Where(o => o.CreatedAtUtc.DayOfWeek == d).ToList();
                var dSales = dayOrders.Sum(o => o.TotalAmount);
                var dCount = dayOrders.Count;
                return new SalesByTimeDto(d.ToString(), d.ToString(), dCount, dSales, dCount > 0 ? Math.Round(dSales / dCount, 2) : 0);
            })
            .ToList();

        var peakDay = byDayOfWeek.OrderByDescending(d => d.TotalSales).FirstOrDefault()?.DisplayLabel ?? "N/A";
        var slowestDay = byDayOfWeek.OrderBy(d => d.TotalSales).FirstOrDefault()?.DisplayLabel ?? "N/A";

        // 10. Daily Timeline (last 30 days or filtered range)
        var dailyTimeline = validOrders
            .GroupBy(o => o.CreatedAtUtc.Date)
            .OrderBy(g => g.Key)
            .Select(g => {
                var dSales = g.Sum(o => o.TotalAmount);
                var dCount = g.Count();
                return new SalesByTimeDto(g.Key.ToString("yyyy-MM-dd"), g.Key.ToString("dd MMM"), dCount, dSales, dCount > 0 ? Math.Round(dSales / dCount, 2) : 0);
            })
            .ToList();

        // 11. Cost & Expense Breakdown by Head
        var costBreakdown = new List<ExpenseHeadDto>
        {
            new("Food Ingredients (BOM COGS)", "Direct cost of raw materials and ingredients consumed in recipes", totalCOGS, grossSales > 0 ? Math.Round((totalCOGS / grossSales) * 100, 1) : 0),
            new("Kitchen Wastage & Spoilage", "Cost of expired, burnt, or quality failed ingredients", totalWastageCost, grossSales > 0 ? Math.Round((totalWastageCost / grossSales) * 100, 1) : 0),
            new("Packaging Materials", "Food containers, bags, boxes, and cutlery for takeaway/delivery", totalPackaging, grossSales > 0 ? Math.Round((totalPackaging / grossSales) * 100, 1) : 0),
            new("Rider Logistics & Delivery", "Direct logistics and fuel allowance cost for delivery riders", totalDeliveryCost, grossSales > 0 ? Math.Round((totalDeliveryCost / grossSales) * 100, 1) : 0),
            new("Promotional Discounts Given", "Reductions from coupon codes and campaign offers", totalDiscounts, grossSales > 0 ? Math.Round((totalDiscounts / grossSales) * 100, 1) : 0),
            new("Govt VAT (5%)", "Statutory value-added tax collected and transferred to NBR", totalTax, grossSales > 0 ? Math.Round((totalTax / grossSales) * 100, 1) : 0)
        };

        // 12. Recent Orders
        var recentOrders = validOrders
            .OrderByDescending(o => o.CreatedAtUtc)
            .Take(50)
            .Select(o => new OrderResponseDto(
                o.Id,
                o.BranchId,
                o.Branch?.Name ?? "",
                o.OrderNumber,
                string.IsNullOrWhiteSpace(o.InvoiceNumber) ? $"INV-{o.OrderNumber}" : o.InvoiceNumber,
                o.OrderType,
                o.Status,
                o.PaymentStatus,
                o.CustomerName,
                o.CustomerPhone,
                o.DeliveryAddress,
                null,
                o.CashierStaffName,
                o.SubTotal,
                o.DiscountAmount,
                o.TaxAmount,
                o.ServiceCharge,
                o.DeliveryFee,
                o.TotalAmount,
                o.PaidAmount,
                o.OutstandingAmount,
                o.IsVoid,
                o.PrintCount,
                o.TotalIngredientBOMCost,
                o.EstimatedGrossProfit,
                o.CreatedAtUtc,
                new List<OrderItemResponseDto>(),
                new List<PaymentResponseDto>()
            ))
            .ToList();

        var response = new SalesReportResponseDto(
            GeneratedAtUtc: DateTime.UtcNow,
            FromDateUtc: fromDate,
            ToDateUtc: toDate,
            Summary: summary,
            ByBranch: byBranch,
            BySource: bySource,
            ByPaymentMethod: byPaymentMethod,
            ByCategory: byCategory,
            CashierSummaries: cashierSummaries,
            RecentOrders: recentOrders,
            TopSellingProducts: topProducts,
            LowSellingProducts: lowProducts,
            ByMonth: byMonth,
            ByDayOfWeek: byDayOfWeek,
            DailyTimeline: dailyTimeline,
            CostBreakdown: costBreakdown,
            PeakSalesDay: peakDay,
            SlowestSalesDay: slowestDay,
            BestPerformingBranch: bestBranch
        );

        return Result<SalesReportResponseDto>.Success(response);
    }

    public async Task<Result<string>> GenerateCsvExportAsync(SalesReportFilterDto filter)
    {
        var reportResult = await GetSalesReportAsync(filter);
        if (reportResult.IsFailure) return Result<string>.Failure(reportResult.Error ?? "Failed to generate report");

        var report = reportResult.Value;
        var sb = new StringBuilder();

        sb.AppendLine("=== KABIR'S KITCHEN - OFFICIAL SALES REPORT ===");
        sb.AppendLine($"Generated At (UTC):,{report.GeneratedAtUtc:yyyy-MM-dd HH:mm:ss}");
        sb.AppendLine($"Reporting Period:,{report.FromDateUtc:yyyy-MM-dd} to {report.ToDateUtc:yyyy-MM-dd}");
        sb.AppendLine();

        sb.AppendLine("=== EXECUTIVE SUMMARY & P&L ===");
        sb.AppendLine("Metric,Amount (BDT)");
        sb.AppendLine($"Gross Sales,{report.Summary.GrossSales:F2}");
        sb.AppendLine($"Discounts Allowed,-{report.Summary.TotalDiscounts:F2}");
        sb.AppendLine($"Govt Tax (VAT 5%),{report.Summary.TotalTax:F2}");
        sb.AppendLine($"Net Sales Total,{report.Summary.NetSales:F2}");
        sb.AppendLine($"Ingredient BOM Cost (COGS),{report.Summary.TotalCOGS:F2}");
        sb.AppendLine($"Kitchen Wastage Cost,{report.Summary.TotalWastageCost:F2}");
        sb.AppendLine($"Packaging Expenses,{report.Summary.TotalPackagingCost:F2}");
        sb.AppendLine($"Delivery Logistics Cost,{report.Summary.TotalDeliveryCost:F2}");
        sb.AppendLine($"Total Operating Expenses,{report.Summary.TotalExpenses:F2}");
        sb.AppendLine($"Estimated Gross Profit,{report.Summary.TotalGrossProfit:F2}");
        sb.AppendLine($"Gross Profit Margin (%),{report.Summary.GrossProfitMarginPercent:F2}%");
        sb.AppendLine($"Total Orders Completed,{report.Summary.TotalOrders}");
        sb.AppendLine($"Average Order Value (AOV),{report.Summary.AverageOrderValue:F2}");
        sb.AppendLine();

        sb.AppendLine("=== TOP SELLING PRODUCTS ===");
        sb.AppendLine("Product Name,Category,Quantity Sold,Total Revenue (BDT),% Share");
        foreach (var p in report.TopSellingProducts)
        {
            sb.AppendLine($"\"{p.ProductName}\",\"{p.CategoryName}\",{p.QuantitySold},{p.TotalRevenue:F2},{p.PercentageOfSales}%");
        }
        sb.AppendLine();

        sb.AppendLine("=== LOW SELLING PRODUCTS (ATTENTION NEEDED) ===");
        sb.AppendLine("Product Name,Category,Quantity Sold,Total Revenue (BDT),% Share");
        foreach (var p in report.LowSellingProducts)
        {
            sb.AppendLine($"\"{p.ProductName}\",\"{p.CategoryName}\",{p.QuantitySold},{p.TotalRevenue:F2},{p.PercentageOfSales}%");
        }
        sb.AppendLine();

        sb.AppendLine("=== BRANCH PERFORMANCE RANKING ===");
        sb.AppendLine("Branch Name,Order Count,Total Sales (BDT),% of Total Revenue");
        foreach (var b in report.ByBranch)
        {
            sb.AppendLine($"\"{b.BranchName}\",{b.OrderCount},{b.TotalSales:F2},{b.PercentageOfTotal}%");
        }
        sb.AppendLine();

        sb.AppendLine("=== SALES BY DAY OF WEEK ===");
        sb.AppendLine("Day of Week,Orders,Total Sales (BDT),Average Ticket (BDT)");
        foreach (var d in report.ByDayOfWeek)
        {
            sb.AppendLine($"{d.DisplayLabel},{d.OrderCount},{d.TotalSales:F2},{d.AverageTicket:F2}");
        }

        return Result<string>.Success(sb.ToString());
    }
}
