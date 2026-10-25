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
    decimal VoidTotalAmount
);

public record SalesByBranchDto(long BranchId, string BranchName, int OrderCount, decimal TotalSales);
public record SalesBySourceDto(OrderType OrderType, string SourceName, int OrderCount, decimal TotalSales);
public record SalesByPaymentMethodDto(PaymentMethod Method, string MethodName, int TransactionCount, decimal TotalAmount);
public record SalesByCategoryDto(string CategoryName, int QuantitySold, decimal TotalRevenue);
public record CashierShiftSummaryDto(string CashierName, int OrderCount, decimal TotalSales, decimal CashCollected, decimal DigitalCollected);

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
    List<OrderResponseDto> RecentOrders
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
            VoidTotalAmount: voidAmount
        );

        // 2. By Branch
        var byBranch = validOrders
            .GroupBy(o => new { o.BranchId, BranchName = o.Branch?.Name ?? $"Branch #{o.BranchId}" })
            .Select(g => new SalesByBranchDto(g.Key.BranchId, g.Key.BranchName, g.Count(), g.Sum(o => o.TotalAmount)))
            .OrderByDescending(b => b.TotalSales)
            .ToList();

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
            .Take(10)
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

        // 7. Recent Orders
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
            RecentOrders: recentOrders
        );

        return Result<SalesReportResponseDto>.Success(response);
    }

    public async Task<Result<string>> GenerateCsvExportAsync(SalesReportFilterDto filter)
    {
        var reportResult = await GetSalesReportAsync(filter);
        if (reportResult.IsFailure) return Result<string>.Failure(reportResult.Error ?? "Unable to generate sales report.");

        var report = reportResult.Value;
        var sb = new StringBuilder();

        sb.AppendLine("KABIR'S KITCHEN - OFFICIAL SALES REPORT");
        sb.AppendLine($"Generated At: {report.GeneratedAtUtc:yyyy-MM-dd HH:mm:ss} UTC");
        sb.AppendLine($"Period: {report.FromDateUtc:yyyy-MM-dd} to {report.ToDateUtc:yyyy-MM-dd}");
        sb.AppendLine();

        sb.AppendLine("SUMMARY METRICS");
        sb.AppendLine("Metric,Value (BDT)");
        sb.AppendLine($"Gross Sales,{report.Summary.GrossSales:F2}");
        sb.AppendLine($"Total Discounts,{report.Summary.TotalDiscounts:F2}");
        sb.AppendLine($"Total Tax (VAT 5%),{report.Summary.TotalTax:F2}");
        sb.AppendLine($"Total Delivery Fees,{report.Summary.TotalDeliveryFees:F2}");
        sb.AppendLine($"Net Sales Total,{report.Summary.NetSales:F2}");
        sb.AppendLine($"Total Completed Orders,{report.Summary.TotalOrders}");
        sb.AppendLine($"Average Order Value (AOV),{report.Summary.AverageOrderValue:F2}");
        sb.AppendLine($"Total Collected Payments,{report.Summary.TotalCollected:F2}");
        sb.AppendLine($"Outstanding Customer Due,{report.Summary.TotalOutstanding:F2}");
        sb.AppendLine($"Total Refunded,{report.Summary.TotalRefunded:F2}");
        sb.AppendLine($"Void Orders Count,{report.Summary.VoidOrderCount}");
        sb.AppendLine($"Void Total Amount,{report.Summary.VoidTotalAmount:F2}");
        sb.AppendLine();

        sb.AppendLine("SALES BY CHANNEL");
        sb.AppendLine("Channel,Orders,Total (BDT)");
        foreach (var s in report.BySource)
        {
            sb.AppendLine($"{s.SourceName},{s.OrderCount},{s.TotalSales:F2}");
        }
        sb.AppendLine();

        sb.AppendLine("SALES BY BRANCH");
        sb.AppendLine("Branch Name,Orders,Total (BDT)");
        foreach (var b in report.ByBranch)
        {
            sb.AppendLine($"\"{b.BranchName}\",{b.OrderCount},{b.TotalSales:F2}");
        }
        sb.AppendLine();

        sb.AppendLine("SALES BY PAYMENT METHOD");
        sb.AppendLine("Payment Method,Transactions,Total (BDT)");
        foreach (var p in report.ByPaymentMethod)
        {
            sb.AppendLine($"{p.MethodName},{p.TransactionCount},{p.TotalAmount:F2}");
        }
        sb.AppendLine();

        sb.AppendLine("CASHIER & SHIFT CLOSING");
        sb.AppendLine("Cashier,Orders,Total Sales (BDT),Cash Collected (BDT),Digital Collected (BDT)");
        foreach (var c in report.CashierSummaries)
        {
            sb.AppendLine($"\"{c.CashierName}\",{c.OrderCount},{c.TotalSales:F2},{c.CashCollected:F2},{c.DigitalCollected:F2}");
        }
        sb.AppendLine();

        sb.AppendLine("RECENT ORDERS RECORD");
        sb.AppendLine("Invoice Number,Order Number,Branch,Date,Type,Customer,Phone,Total (BDT),Paid (BDT),Due (BDT),Status");
        foreach (var o in report.RecentOrders)
        {
            sb.AppendLine($"{o.InvoiceNumber},{o.OrderNumber},\"{o.BranchName}\",{o.CreatedAtUtc:yyyy-MM-dd HH:mm},{o.OrderType},\"{o.CustomerName}\",{o.CustomerPhone},{o.TotalAmount:F2},{o.PaidAmount:F2},{o.OutstandingAmount:F2},{o.PaymentStatus}");
        }

        return Result<string>.Success(sb.ToString());
    }
}
