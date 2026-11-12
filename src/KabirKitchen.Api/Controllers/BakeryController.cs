using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BakeryController : ControllerBase
{
    private readonly CakeOrderService _cakeService;
    private readonly ICurrentUserService _currentUser;

    public BakeryController(CakeOrderService cakeService, ICurrentUserService currentUser)
    {
        _cakeService = cakeService;
        _currentUser = currentUser;
    }

    [HttpPost("custom-cake/quote")]
    public async Task<IActionResult> QuoteCustomCake([FromBody] QuoteCustomCakeRequestDto request)
    {
        var result = await _cakeService.QuoteCustomCakeAsync(request);
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { message = result.Error });
    }

    [HttpPost("custom-cake")]
    public async Task<IActionResult> CreateCustomCake([FromBody] CreateCustomCakeRequestDto request)
    {
        var result = await _cakeService.CreateCakeRequestAsync(request);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Value);
    }

    [HttpPost("custom-cake/submit-payment-proof")]
    public async Task<IActionResult> SubmitPaymentProof([FromBody] SubmitCakePaymentProofDto dto)
    {
        if (dto.CakeCustomOrderId <= 0 || string.IsNullOrWhiteSpace(dto.TransactionId))
        {
            return BadRequest(new { message = "Valid Cake Order ID and Transaction ID / Reference are required." });
        }

        var result = await _cakeService.SubmitPaymentProofAsync(dto);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Value);
    }

    [HttpPost("verify-advance")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Cashier")]
    public async Task<IActionResult> VerifyAdvancePayment([FromBody] VerifyCakeAdvancePaymentDto dto)
    {
        var branchId = await _cakeService.GetBranchIdAsync(dto.CakeCustomOrderId);
        if (!branchId.HasValue) return NotFound(new { message = "Cake order not found." });
        if (!_currentUser.HasAccessToBranch(branchId.Value)) return Forbid();

        var result = await _cakeService.VerifyAdvancePaymentAsync(dto);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(new { message = "Cake 50% advance payment verified successfully." });
    }

    [HttpPut("{id}/start-baking")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> StartBaking(long id)
    {
        var branchId = await _cakeService.GetBranchIdAsync(id);
        if (!branchId.HasValue) return NotFound(new { message = "Cake order not found." });
        if (!_currentUser.HasAccessToBranch(branchId.Value)) return Forbid();

        var result = await _cakeService.StartBakingAsync(id);
        if (result.IsFailure)
        {
            // Enforces the strict rule: "Advance payment verified na hole production status InBaking kora jabe na"
            return BadRequest(new { message = result.Error });
        }

        return Ok(new { message = "Production started. Cake is now in baking." });
    }

    [HttpGet("calendar")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> GetProductionCalendar([FromQuery] long branchId, [FromQuery] DateTime? date = null)
    {
        if (!_currentUser.HasAccessToBranch(branchId))
        {
            return Forbid();
        }

        var targetDate = date ?? DateTime.UtcNow;
        var slots = await _cakeService.GetProductionCalendarAsync(branchId, targetDate);
        return Ok(slots);
    }

    [HttpGet("bom-plan")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> GetAggregatedBOMPlan([FromQuery] long branchId, [FromQuery] DateTime? date = null)
    {
        if (!_currentUser.HasAccessToBranch(branchId))
        {
            return Forbid();
        }

        var targetDate = date ?? DateTime.UtcNow.AddDays(1);
        var plan = await _cakeService.GetAggregatedBOMPlanAsync(branchId, targetDate);
        return Ok(plan);
    }

    [HttpGet("orders")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Cashier,Chef")]
    public async Task<IActionResult> GetCakeOrders([FromQuery] long? branchId, [FromQuery] string? search)
    {
        if (branchId.HasValue && branchId.Value > 0 && !_currentUser.HasAccessToBranch(branchId.Value))
        {
            return Forbid();
        }

        var orders = await _cakeService.GetCakeOrdersAsync(branchId, search);
        return Ok(orders);
    }

    /// <summary>
    /// STRICT RULE: Admin ছাড়া আর কেউ কাস্টম কেকের দাম বা ডিসকাউন্ট কমাতে পারবে না।
    /// </summary>
    [HttpPost("apply-discount")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> ApplySpecialDiscount([FromBody] ApplyCakeSpecialDiscountDto dto)
    {
        var branchId = await _cakeService.GetBranchIdAsync(dto.CakeCustomOrderId);
        if (!branchId.HasValue) return NotFound(new { message = "Cake order not found." });
        if (!_currentUser.HasAccessToBranch(branchId.Value)) return Forbid();

        string adminName = _currentUser.UserEmail ?? _currentUser.UserId?.ToString() ?? "Admin";
        var result = await _cakeService.ApplySpecialDiscountAsync(dto.CakeCustomOrderId, dto.DiscountAmount, dto.Reason, adminName);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Value);
    }
}
