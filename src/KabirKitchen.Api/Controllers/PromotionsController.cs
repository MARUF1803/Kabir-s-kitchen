using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/promotions")]
public sealed class PromotionsController : ControllerBase
{
    private readonly PromotionEngineService _service;
    private readonly OrderEngineService _orderEngine;
    private readonly ICurrentUserService _currentUser;
    private readonly IConfiguration _configuration;

    public PromotionsController(
        PromotionEngineService service,
        OrderEngineService orderEngine,
        ICurrentUserService currentUser,
        IConfiguration configuration)
    {
        _service = service;
        _orderEngine = orderEngine;
        _currentUser = currentUser;
        _configuration = configuration;
    }

    [HttpGet("calendar")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> GetCalendar(
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null)
    {
        if (fromUtc.HasValue && fromUtc.Value.Kind == DateTimeKind.Unspecified ||
            toUtc.HasValue && toUtc.Value.Kind == DateTimeKind.Unspecified ||
            fromUtc.HasValue && toUtc.HasValue && fromUtc.Value >= toUtc.Value)
        {
            return BadRequest(new { message = "Calendar dates must be timezone-aware and the end must follow the start." });
        }

        var scoped = IsBranchScoped;
        if (scoped && !_currentUser.BranchId.HasValue) return Forbid();
        var branchId = scoped ? _currentUser.BranchId : null;
        var campaigns = await _service.GetAllAsync(branchId, !scoped);
        var filtered = campaigns.Where(campaign =>
            (!fromUtc.HasValue || campaign.EndDateUtc >= fromUtc.Value.ToUniversalTime()) &&
            (!toUtc.HasValue || campaign.StartDateUtc <= toUtc.Value.ToUniversalTime()));
        return Ok(new
        {
            timeZoneId = _configuration["Restaurant:TimeZoneId"] ?? "Asia/Dhaka",
            campaigns = filtered
        });
    }

    [HttpGet("reports")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> GetReports()
    {
        var scoped = IsBranchScoped;
        if (scoped && !_currentUser.BranchId.HasValue) return Forbid();
        return Ok(await _service.GetReportsAsync(scoped ? _currentUser.BranchId : null));
    }

    [HttpPost("engagement")]
    [EnableRateLimiting("promotion-engagement")]
    public async Task<IActionResult> RecordEngagement([FromBody] PromotionEngagementRequest request)
    {
        var recorded = await _service.RecordEngagementAsync(request);
        return recorded
            ? NoContent()
            : BadRequest(new { message = "The campaign is not currently eligible for this branch or the event is invalid." });
    }

    [HttpPost("quote")]
    public async Task<IActionResult> Quote([FromBody] PromotionQuoteRequest request)
    {
        if (IsStaffRole(_currentUser.RoleName) && !_currentUser.HasAccessToBranch(request.BranchId))
        {
            return Forbid();
        }

        var quote = await _orderEngine.QuoteOrderAsync(request);
        return quote.IsSuccess ? Ok(quote.Value) : BadRequest(new { message = quote.Error });
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActive([FromQuery] long branchId)
    {
        if (branchId <= 0) return BadRequest(new { message = "A valid branch ID is required." });
        return Ok(await _service.GetActiveAsync(branchId));
    }

    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> GetAll()
    {
        var scoped = IsBranchScoped;
        if (scoped && !_currentUser.BranchId.HasValue) return Forbid();
        return Ok(await _service.GetAllAsync(scoped ? _currentUser.BranchId : null, !scoped));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> Create([FromBody] SavePromotionRequest request)
    {
        if (!CanManageBranch(request.BranchId))
            return Forbid();
        try
        {
            var result = await _service.CreateAsync(request, _currentUser.UserEmail);
            return Created("/api/promotions", result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPut("{id:long}")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> Update(long id, [FromBody] SavePromotionRequest request)
    {
        var existing = await _service.GetByIdAsync(id);
        if (existing is null) return NotFound();
        if (!CanManageBranch(existing.BranchId) || !CanManageBranch(request.BranchId))
            return Forbid();
        try
        {
            var result = await _service.UpdateAsync(id, request, _currentUser.UserEmail);
            return result is null ? NotFound() : Ok(result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { message = exception.Message });
        }
    }

    [HttpPatch("{id:long}/status")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> ChangeStatus(long id, [FromBody] ChangePromotionStatusRequest request)
    {
        var existing = await _service.GetByIdAsync(id);
        if (existing is null) return NotFound();
        if (!CanManageBranch(existing.BranchId))
            return Forbid();
        if (!Enum.IsDefined(request.Status))
            return BadRequest(new { message = "Promotion status is invalid." });
        var changed = await _service.ChangeStatusAsync(id, request.Status, _currentUser.UserEmail);
        return changed ? NoContent() : NotFound();
    }

    private bool IsBranchScoped =>
        (_currentUser.BranchId.HasValue && !_currentUser.IsGlobalSuperAdmin) ||
        string.Equals(_currentUser.RoleName, "BranchManager", StringComparison.OrdinalIgnoreCase);

    private bool CanManageBranch(long? branchId)
    {
        if (IsBranchScoped)
            return _currentUser.BranchId.HasValue && branchId == _currentUser.BranchId.Value;

        if (branchId is null)
            return true;

        return _currentUser.IsGlobalSuperAdmin || !_currentUser.BranchId.HasValue ||
               _currentUser.HasAccessToBranch(branchId.Value);
    }

    private static bool IsStaffRole(string? role) =>
        role is "Admin" or "SuperAdmin" or "BranchManager" or "Cashier" or "Chef";
}

public sealed record ChangePromotionStatusRequest(PromotionStatus Status);
