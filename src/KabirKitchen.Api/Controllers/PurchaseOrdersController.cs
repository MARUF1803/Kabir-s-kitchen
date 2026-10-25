using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
public class PurchaseOrdersController : ControllerBase
{
    private readonly ProcurementService _procurementService;
    private readonly ICurrentUserService _currentUser;

    public PurchaseOrdersController(ProcurementService procurementService, ICurrentUserService currentUser)
    {
        _procurementService = procurementService;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<IActionResult> GetPurchaseOrders(
        [FromQuery] long? branchId = null,
        [FromQuery] PurchaseOrderStatus? status = null)
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

        var orders = await _procurementService.GetPurchaseOrdersAsync(branchId, status);
        return Ok(orders);
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetPurchaseOrderById(long id)
    {
        var result = await _procurementService.GetPurchaseOrderByIdAsync(id);
        if (result.IsFailure)
        {
            return NotFound(new { message = result.Error });
        }

        if (!_currentUser.HasAccessToBranch(result.Value.BranchId))
        {
            return Forbid();
        }

        return Ok(result.Value);
    }

    [HttpPost]
    public async Task<IActionResult> CreatePurchaseOrder([FromBody] CreatePurchaseOrderDto dto)
    {
        if (!_currentUser.HasAccessToBranch(dto.BranchId))
        {
            return Forbid();
        }

        var result = await _procurementService.CreatePurchaseOrderAsync(dto);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return CreatedAtAction(nameof(GetPurchaseOrderById), new { id = result.Value.Id }, result.Value);
    }

    /// <summary>
    /// Processes Goods Received Note (GRN), updating live inventory and supplier ledger.
    /// </summary>
    [HttpPost("{id:long}/receive")]
    public async Task<IActionResult> ReceiveGoods(long id, [FromBody] ReceivePurchaseOrderDto dto)
    {
        var poResult = await _procurementService.GetPurchaseOrderByIdAsync(id);
        if (poResult.IsFailure)
        {
            return NotFound(new { message = poResult.Error });
        }

        if (!_currentUser.HasAccessToBranch(poResult.Value.BranchId))
        {
            return Forbid();
        }

        var result = await _procurementService.ReceiveGoodsNoteAsync(id, dto, _currentUser.UserId);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Records payment made to supplier against this purchase order.
    /// </summary>
    [HttpPost("{id:long}/payments")]
    public async Task<IActionResult> AddPayment(long id, [FromBody] RecordPurchasePaymentDto dto)
    {
        var poResult = await _procurementService.GetPurchaseOrderByIdAsync(id);
        if (poResult.IsFailure)
        {
            return NotFound(new { message = poResult.Error });
        }

        if (!_currentUser.HasAccessToBranch(poResult.Value.BranchId))
        {
            return Forbid();
        }

        var result = await _procurementService.AddPurchasePaymentAsync(id, dto);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Value);
    }
}
