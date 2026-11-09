using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductionController : ControllerBase
{
    private readonly ProductionService _productionService;
    private readonly ICurrentUserService _currentUser;

    public ProductionController(
        ProductionService productionService,
        ICurrentUserService currentUser)
    {
        _productionService = productionService;
        _currentUser = currentUser;
    }

    [HttpGet("batches")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef,KitchenStaff")]
    public async Task<IActionResult> GetBatches([FromQuery] long? branchId, [FromQuery] ProductionBatchStatus? status)
    {
        if (branchId.HasValue && !_currentUser.HasAccessToBranch(branchId.Value))
            return Forbid();

        var batches = await _productionService.GetProductionBatchesAsync(branchId, status);
        return Ok(batches);
    }

    [HttpGet("batches/{id}")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef,KitchenStaff")]
    public async Task<IActionResult> GetBatchById(long id)
    {
        var batch = await _productionService.GetProductionBatchByIdAsync(id);
        if (batch == null) return NotFound(new { message = "Production batch not found." });
        if (!_currentUser.HasAccessToBranch(batch.BranchId)) return Forbid();
        return Ok(batch);
    }

    [HttpPost("batches")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> CreateBatch([FromBody] CreateProductionBatchRequestDto dto)
    {
        if (!_currentUser.HasAccessToBranch(dto.BranchId)) return Forbid();

        var userId = _currentUser.UserId ?? 0;
        var result = await _productionService.CreateProductionBatchAsync(dto, userId);
        if (result.IsFailure) return BadRequest(new { message = result.Error });
        return CreatedAtAction(nameof(GetBatchById), new { id = result.Value.Id }, result.Value);
    }

    [HttpPost("batches/{id}/start")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef,KitchenStaff")]
    public async Task<IActionResult> StartBatch(long id)
    {
        var existing = await _productionService.GetProductionBatchByIdAsync(id);
        if (existing == null) return NotFound(new { message = "Production batch not found." });
        if (!_currentUser.HasAccessToBranch(existing.BranchId)) return Forbid();

        var result = await _productionService.StartProductionBatchAsync(id);
        if (result.IsFailure) return BadRequest(new { message = result.Error });
        return Ok(result.Value);
    }

    [HttpPost("batches/{id}/complete")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> CompleteBatch(long id, [FromBody] CompleteProductionBatchRequestDto dto)
    {
        var existing = await _productionService.GetProductionBatchByIdAsync(id);
        if (existing == null) return NotFound(new { message = "Production batch not found." });
        if (!_currentUser.HasAccessToBranch(existing.BranchId)) return Forbid();

        var userId = _currentUser.UserId ?? 0;
        var result = await _productionService.CompleteProductionBatchAsync(id, dto, userId);
        if (result.IsFailure) return BadRequest(new { message = result.Error });
        return Ok(result.Value);
    }

    [HttpPost("batches/{id}/post")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> PostBatch(long id, [FromBody] PostProductionBatchRequestDto dto)
    {
        var existing = await _productionService.GetProductionBatchByIdAsync(id);
        if (existing == null) return NotFound(new { message = "Production batch not found." });
        if (!_currentUser.HasAccessToBranch(existing.BranchId)) return Forbid();

        var userId = _currentUser.UserId ?? 0;
        var result = await _productionService.PostProductionBatchAsync(id, dto.IdempotencyKey, userId);
        if (result.IsFailure) return BadRequest(new { message = result.Error });
        return Ok(result.Value);
    }

    [HttpPost("batches/{id}/cancel")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> CancelBatch(long id, [FromBody] CancelBatchRequestDto dto)
    {
        var existing = await _productionService.GetProductionBatchByIdAsync(id);
        if (existing == null) return NotFound(new { message = "Production batch not found." });
        if (!_currentUser.HasAccessToBranch(existing.BranchId)) return Forbid();

        var result = await _productionService.CancelProductionBatchAsync(id, dto.Reason);
        if (result.IsFailure) return BadRequest(new { message = result.Error });
        return Ok(new { message = "Production batch cancelled successfully." });
    }
}

public record CancelBatchRequestDto(string Reason);
