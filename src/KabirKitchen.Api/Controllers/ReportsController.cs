using System.Text;
using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
public class ReportsController : ControllerBase
{
    private readonly SalesReportService _salesReportService;
    private readonly ICurrentUserService _currentUser;

    public ReportsController(SalesReportService salesReportService, ICurrentUserService currentUser)
    {
        _salesReportService = salesReportService;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Gets detailed sales and business intelligence report from persisted transactions.
    /// Accessible to staff (Admin, Manager, SuperAdmin).
    /// </summary>
    [HttpGet("sales")]
    public async Task<IActionResult> GetSalesReport(
        [FromQuery] long? branchId = null,
        [FromQuery] DateTime? startDateUtc = null,
        [FromQuery] DateTime? endDateUtc = null,
        [FromQuery] OrderType? orderType = null,
        [FromQuery] string? cashierStaffName = null)
    {
        if (branchId.HasValue && branchId.Value > 0)
        {
            if (!_currentUser.HasAccessToBranch(branchId.Value))
            {
                return Forbid();
            }
        }
        else if (!_currentUser.IsGlobalSuperAdmin && _currentUser.BranchId.HasValue)
        {
            branchId = _currentUser.BranchId.Value;
        }

        var filter = new SalesReportFilterDto(branchId, startDateUtc, endDateUtc, orderType, cashierStaffName);
        var result = await _salesReportService.GetSalesReportAsync(filter);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Exports sales report as CSV download.
    /// </summary>
    [HttpGet("sales/csv")]
    public async Task<IActionResult> ExportSalesCsv(
        [FromQuery] long? branchId = null,
        [FromQuery] DateTime? startDateUtc = null,
        [FromQuery] DateTime? endDateUtc = null,
        [FromQuery] OrderType? orderType = null,
        [FromQuery] string? cashierStaffName = null)
    {
        if (branchId.HasValue && branchId.Value > 0)
        {
            if (!_currentUser.HasAccessToBranch(branchId.Value))
            {
                return Forbid();
            }
        }
        else if (!_currentUser.IsGlobalSuperAdmin && _currentUser.BranchId.HasValue)
        {
            branchId = _currentUser.BranchId.Value;
        }

        var filter = new SalesReportFilterDto(branchId, startDateUtc, endDateUtc, orderType, cashierStaffName);
        var result = await _salesReportService.GenerateCsvExportAsync(filter);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        var bytes = Encoding.UTF8.GetBytes(result.Value);
        string filename = $"SalesReport_{DateTime.UtcNow:yyyyMMdd_HHmm}.csv";
        return File(bytes, "text/csv", filename);
    }
}
