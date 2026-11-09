using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EquipmentReservoirsController : ControllerBase
{
    private readonly ReservoirService _reservoirService;
    private readonly ICurrentUserService _currentUser;

    public EquipmentReservoirsController(
        ReservoirService reservoirService,
        ICurrentUserService currentUser)
    {
        _reservoirService = reservoirService;
        _currentUser = currentUser;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef,KitchenStaff")]
    public async Task<IActionResult> GetByBranch([FromQuery] long branchId)
    {
        if (branchId <= 0) return BadRequest(new { message = "Valid branch ID required." });
        if (!_currentUser.HasAccessToBranch(branchId)) return Forbid();

        var items = await _reservoirService.GetReservoirsByBranchAsync(branchId);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> Create([FromBody] CreateReservoirRequestDto dto)
    {
        if (!_currentUser.HasAccessToBranch(dto.BranchId)) return Forbid();

        var result = await _reservoirService.CreateReservoirAsync(
            dto.BranchId,
            dto.EquipmentName,
            dto.EquipmentCode,
            dto.IngredientId,
            dto.MaxCapacity);

        if (result.IsFailure) return BadRequest(new { message = result.Error });
        return Ok(result.Value);
    }

    [HttpPost("transfer-in")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> TransferIn([FromBody] TransferToReservoirRequestDto dto)
    {
        var userId = _currentUser.UserId;
        var result = await _reservoirService.TransferInFromStorageAsync(
            dto.EquipmentReservoirId,
            dto.Quantity,
            dto.SourceInventoryLotId,
            dto.Remarks,
            userId);

        if (result.IsFailure) return BadRequest(new { message = result.Error });
        return Ok(result.Value);
    }

    [HttpPost("discard-sludge")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> DiscardSludge([FromBody] ReservoirDiscardSludgeRequestDto dto)
    {
        var userId = _currentUser.UserId;
        var result = await _reservoirService.DiscardSludgeAsync(
            dto.EquipmentReservoirId,
            dto.QuantityDiscarded,
            dto.Remarks,
            userId);

        if (result.IsFailure) return BadRequest(new { message = result.Error });
        return Ok(result.Value);
    }

    [HttpPost("full-drain")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> FullDrain([FromBody] DrainReservoirRequestDto dto)
    {
        var userId = _currentUser.UserId;
        var result = await _reservoirService.FullDrainAsync(
            dto.EquipmentReservoirId,
            dto.Remarks,
            userId);

        if (result.IsFailure) return BadRequest(new { message = result.Error });
        return Ok(result.Value);
    }
}

public record CreateReservoirRequestDto(
    long BranchId,
    string EquipmentName,
    string? EquipmentCode,
    long IngredientId,
    decimal MaxCapacity
);
