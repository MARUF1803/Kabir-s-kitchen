using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InventoryLotsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public InventoryLotsController(
        IApplicationDbContext context,
        ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef,KitchenStaff")]
    public async Task<IActionResult> GetLots(
        [FromQuery] long branchId,
        [FromQuery] InventoryLotType? lotType = null,
        [FromQuery] InventoryLotStatus? status = null,
        [FromQuery] bool onlyExpiringSoon = false)
    {
        if (branchId <= 0) return BadRequest(new { message = "Valid branch ID required." });
        if (!_currentUser.HasAccessToBranch(branchId)) return Forbid();

        var query = _context.InventoryLots
            .Include(l => l.Branch)
            .Include(l => l.Ingredient)
            .Include(l => l.SubRecipe)
            .Include(l => l.MenuItem)
            .Where(l => l.BranchId == branchId)
            .AsQueryable();

        if (lotType.HasValue)
            query = query.Where(l => l.LotType == lotType.Value);

        if (status.HasValue)
            query = query.Where(l => l.Status == status.Value);

        var now = DateTime.UtcNow;
        if (onlyExpiringSoon)
        {
            var warningThreshold = now.AddDays(3);
            query = query.Where(l => l.HasExpiry && l.ExpiryDateUtc.HasValue && l.ExpiryDateUtc <= warningThreshold && l.Status == InventoryLotStatus.Active);
        }

        var lots = await query
            .OrderBy(l => l.ExpiryDateUtc ?? DateTime.MaxValue)
            .Take(100)
            .ToListAsync();

        var dtos = lots.Select(l => new InventoryLotDto(
            l.Id,
            l.LotNumber,
            l.BranchId,
            l.Branch?.Name ?? "",
            l.LotType,
            l.IngredientId,
            l.Ingredient?.Name,
            l.SubRecipeId,
            l.SubRecipe?.Name,
            l.MenuItemId,
            l.MenuItem?.Name,
            l.InitialQuantity,
            l.RemainingQuantity,
            l.UnitCost,
            l.ManufacturedOrReceivedDateUtc,
            l.ExpiryDateUtc,
            l.HasExpiry,
            l.Status,
            l.StorageLocation,
            l.SourceReference,
            l.HasExpiry && l.ExpiryDateUtc.HasValue && l.ExpiryDateUtc.Value < now
        )).ToList();

        return Ok(dtos);
    }

    [HttpPost("quarantine")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> QuarantineLot([FromBody] QuarantineLotRequestDto dto)
    {
        var lot = await _context.InventoryLots.FindAsync(dto.LotId);
        if (lot == null) return NotFound(new { message = "Lot not found." });
        if (!_currentUser.HasAccessToBranch(lot.BranchId)) return Forbid();

        LotManagementService.QuarantineLot(lot);
        lot.UpdatedAtUtc = DateTime.UtcNow;

        // Update corresponding branch stock quarantined count if applicable
        if (lot.LotType == InventoryLotType.RawMaterial && lot.IngredientId.HasValue)
        {
            var stock = await _context.BranchIngredientStocks
                .FirstOrDefaultAsync(s => s.BranchId == lot.BranchId && s.IngredientId == lot.IngredientId.Value);
            if (stock != null)
            {
                stock.QuarantinedQuantity += lot.RemainingQuantity;
            }
        }
        else if (lot.LotType == InventoryLotType.SubRecipe && lot.SubRecipeId.HasValue)
        {
            var stock = await _context.BranchSubRecipeStocks
                .FirstOrDefaultAsync(s => s.BranchId == lot.BranchId && s.SubRecipeId == lot.SubRecipeId.Value);
            if (stock != null)
            {
                stock.QuarantinedQuantity += lot.RemainingQuantity;
            }
        }
        else if (lot.LotType == InventoryLotType.FinishedProduct && lot.MenuItemId.HasValue)
        {
            var stock = await _context.BranchProductStocks
                .FirstOrDefaultAsync(s => s.BranchId == lot.BranchId && s.MenuItemId == lot.MenuItemId.Value);
            if (stock != null)
            {
                stock.QuarantinedQuantity += lot.RemainingQuantity;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = $"Lot {lot.LotNumber} quarantined successfully." });
    }

    [HttpPost("release-quarantine")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> ReleaseQuarantine([FromBody] ReleaseQuarantineRequestDto dto)
    {
        var lot = await _context.InventoryLots.FindAsync(dto.LotId);
        if (lot == null) return NotFound(new { message = "Lot not found." });
        if (!_currentUser.HasAccessToBranch(lot.BranchId)) return Forbid();

        if (lot.Status == InventoryLotStatus.Quarantined)
        {
            lot.Status = InventoryLotStatus.Active;
            lot.UpdatedAtUtc = DateTime.UtcNow;

            if (lot.LotType == InventoryLotType.RawMaterial && lot.IngredientId.HasValue)
            {
                var stock = await _context.BranchIngredientStocks
                    .FirstOrDefaultAsync(s => s.BranchId == lot.BranchId && s.IngredientId == lot.IngredientId.Value);
                if (stock != null)
                {
                    stock.QuarantinedQuantity = Math.Max(0, stock.QuarantinedQuantity - lot.RemainingQuantity);
                }
            }
            else if (lot.LotType == InventoryLotType.SubRecipe && lot.SubRecipeId.HasValue)
            {
                var stock = await _context.BranchSubRecipeStocks
                    .FirstOrDefaultAsync(s => s.BranchId == lot.BranchId && s.SubRecipeId == lot.SubRecipeId.Value);
                if (stock != null)
                {
                    stock.QuarantinedQuantity = Math.Max(0, stock.QuarantinedQuantity - lot.RemainingQuantity);
                }
            }
            else if (lot.LotType == InventoryLotType.FinishedProduct && lot.MenuItemId.HasValue)
            {
                var stock = await _context.BranchProductStocks
                    .FirstOrDefaultAsync(s => s.BranchId == lot.BranchId && s.MenuItemId == lot.MenuItemId.Value);
                if (stock != null)
                {
                    stock.QuarantinedQuantity = Math.Max(0, stock.QuarantinedQuantity - lot.RemainingQuantity);
                }
            }

            await _context.SaveChangesAsync();
        }

        return Ok(new { message = $"Lot {lot.LotNumber} released from quarantine to active stock." });
    }
}

public record ReleaseQuarantineRequestDto(long LotId, string? Remarks = null);
