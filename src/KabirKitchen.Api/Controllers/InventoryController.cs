using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InventoryController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly InventoryEngineService _inventoryEngine;
    private readonly ICurrentUserService _currentUser;

    public InventoryController(
        IApplicationDbContext context,
        InventoryEngineService inventoryEngine,
        ICurrentUserService currentUser)
    {
        _context = context;
        _inventoryEngine = inventoryEngine;
        _currentUser = currentUser;
    }

    [HttpGet("stocks")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Cashier,Chef")]
    public async Task<IActionResult> GetBranchStocks([FromQuery] long branchId)
    {
        if (branchId <= 0)
        {
            return BadRequest(new { message = "A valid branch ID is required." });
        }

        if (!_currentUser.HasAccessToBranch(branchId))
        {
            return Forbid();
        }
        var stocks = await _context.BranchIngredientStocks
            .Include(s => s.Ingredient)
            .Include(s => s.Branch)
            .Where(s => s.BranchId == branchId)
            .Select(s => new BranchIngredientStockDto(
                s.Id,
                s.BranchId,
                s.Branch != null ? s.Branch.Name : "",
                s.IngredientId,
                s.Ingredient != null ? s.Ingredient.Name : "",
                s.Ingredient != null ? s.Ingredient.BaseUnit : Domain.Enums.UnitType.Kilogram,
                s.CurrentStockQuantity,
                s.ReservedQuantity,
                s.AvailableQuantity,
                s.Ingredient != null ? s.Ingredient.MinimumAlertStock : 0,
                s.Ingredient != null && s.AvailableQuantity <= s.Ingredient.MinimumAlertStock,
                s.LastPurchaseCostPerUnit,
                s.MovingAverageCostPerUnit
            ))
            .ToListAsync();

        return Ok(stocks);
    }

    [HttpGet("finished-products")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Cashier,Chef")]
    public async Task<IActionResult> GetFinishedProductStocks([FromQuery] long branchId)
    {
        if (branchId <= 0) return BadRequest(new { message = "A valid branch ID is required." });
        if (!_currentUser.HasAccessToBranch(branchId)) return Forbid();

        var stocks = await _context.BranchProductStocks
            .Include(s => s.Branch)
            .Include(s => s.MenuItem)
            .Where(s => s.BranchId == branchId && s.MenuItem != null && !s.MenuItem.IsDeleted)
            .Select(s => new BranchProductStockDto(
                s.Id,
                s.BranchId,
                s.Branch != null ? s.Branch.Name : "",
                s.MenuItemId,
                s.MenuItem != null ? s.MenuItem.Name : "",
                s.MenuItemVariantId,
                null,
                s.CurrentStockQuantity,
                s.ReservedQuantity,
                s.QuarantinedQuantity,
                s.AvailableQuantity,
                s.MinimumAlertStock,
                s.MovingAverageCostPerUnit
            ))
            .ToListAsync();

        return Ok(stocks);
    }

    [HttpGet("sub-recipes")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Cashier,Chef")]
    public async Task<IActionResult> GetSubRecipeStocks([FromQuery] long branchId)
    {
        if (branchId <= 0) return BadRequest(new { message = "A valid branch ID is required." });
        if (!_currentUser.HasAccessToBranch(branchId)) return Forbid();

        var stocks = await _context.BranchSubRecipeStocks
            .Include(s => s.Branch)
            .Include(s => s.SubRecipe)
            .Where(s => s.BranchId == branchId && s.SubRecipe != null && !s.SubRecipe.IsDeleted)
            .Select(s => new BranchSubRecipeStockDto(
                s.Id,
                s.BranchId,
                s.Branch != null ? s.Branch.Name : "",
                s.SubRecipeId,
                s.SubRecipe != null ? s.SubRecipe.Name : "",
                s.SubRecipe != null ? s.SubRecipe.Code : "",
                s.SubRecipe != null ? s.SubRecipe.BaseUnit : Domain.Enums.UnitType.Kilogram,
                s.CurrentStockQuantity,
                s.ReservedQuantity,
                s.QuarantinedQuantity,
                s.AvailableQuantity,
                s.MinimumAlertStock,
                s.MovingAverageCostPerUnit
            ))
            .ToListAsync();

        return Ok(stocks);
    }

    [HttpGet("low-stock")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Cashier,Chef")]
    public async Task<IActionResult> GetLowStock([FromQuery] long branchId)
    {
        if (branchId <= 0)
        {
            return BadRequest(new { message = "A valid branch ID is required." });
        }

        if (!_currentUser.HasAccessToBranch(branchId))
        {
            return Forbid();
        }

        var stocks = await _context.BranchIngredientStocks
            .Include(stock => stock.Ingredient)
            .Include(stock => stock.Branch)
            .Where(stock => stock.BranchId == branchId &&
                stock.Ingredient != null &&
                stock.CurrentStockQuantity - stock.ReservedQuantity <= stock.Ingredient.MinimumAlertStock)
            .Select(stock => new BranchIngredientStockDto(
                stock.Id,
                stock.BranchId,
                stock.Branch != null ? stock.Branch.Name : "",
                stock.IngredientId,
                stock.Ingredient != null ? stock.Ingredient.Name : "",
                stock.Ingredient != null ? stock.Ingredient.BaseUnit : Domain.Enums.UnitType.Kilogram,
                stock.CurrentStockQuantity,
                stock.ReservedQuantity,
                stock.AvailableQuantity,
                stock.Ingredient != null ? stock.Ingredient.MinimumAlertStock : 0,
                true,
                stock.LastPurchaseCostPerUnit,
                stock.MovingAverageCostPerUnit))
            .ToListAsync();

        return Ok(stocks);
    }

    [HttpPost("transaction")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> RecordStockTransaction([FromBody] StockTransactionRequestDto dto)
    {
        if (!_currentUser.HasAccessToBranch(dto.BranchId))
        {
            return Forbid();
        }

        var result = await _inventoryEngine.RecordStockTransactionAsync(
            dto.BranchId,
            dto.IngredientId,
            dto.TransactionType,
            dto.QuantityChange,
            dto.UnitUsed,
            dto.UnitCost,
            dto.ReferenceDocumentType,
            dto.ReferenceDocumentNumber,
            dto.Remarks,
            null
        );

        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(new
        {
            message = "Stock transaction recorded successfully.",
            transactionId = result.Value.Id,
            newQuantityChange = result.Value.QuantityChange,
            totalCost = result.Value.TotalCost
        });
    }

    [HttpGet("what-can-we-make")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> CheckWhatCanWeMake([FromQuery] long branchId)
    {
        if (!_currentUser.HasAccessToBranch(branchId))
        {
            return Forbid();
        }

        var result = await _inventoryEngine.CheckWhatCanWeMakeAsync(branchId);
        return Ok(result);
    }

    /// <summary>POST /api/inventory/adjust — Manual stock adjustment (add or remove)</summary>
    [HttpPost("adjust")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> AdjustStock([FromBody] StockAdjustmentDto dto)
    {
        if (!_currentUser.HasAccessToBranch(dto.BranchId))
        {
            return Forbid();
        }

        // Use AuditAdjustment for manual adjustments; positive = stock in, negative handled by sign of quantityChange
        var txnType = Domain.Enums.StockTransactionType.AuditAdjustment;

        var result = await _inventoryEngine.RecordStockTransactionAsync(
            dto.BranchId,
            dto.IngredientId,
            txnType,
            dto.QuantityChange, // positive = add, negative = remove — sign preserved intentionally
            dto.UnitType ?? Domain.Enums.UnitType.Kilogram,
            dto.UnitCost ?? 0m,
            "ManualAdjustment",
            dto.Reference ?? "MANUAL-ADJ",
            dto.Remarks ?? "Manual stock adjustment",
            null
        );

        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(new
        {
            message = "Stock adjusted successfully.",
            transactionId = result.Value.Id,
            quantityChange = dto.QuantityChange,
            totalCost = result.Value.TotalCost
        });
    }
}

public record StockAdjustmentDto(
    long BranchId,
    long IngredientId,
    decimal QuantityChange, // positive = add, negative = remove
    decimal? UnitCost,
    string? Reference,
    string? Remarks,
    Domain.Enums.UnitType? UnitType = null
);
