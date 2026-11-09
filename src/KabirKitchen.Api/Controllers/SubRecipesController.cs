using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SubRecipesController : ControllerBase
{
    private readonly SubRecipeService _subRecipeService;
    private readonly ICurrentUserService _currentUser;

    public SubRecipesController(
        SubRecipeService subRecipeService,
        ICurrentUserService currentUser)
    {
        _subRecipeService = subRecipeService;
        _currentUser = currentUser;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef,KitchenStaff")]
    public async Task<IActionResult> GetAll()
    {
        var items = await _subRecipeService.GetAllSubRecipesAsync();
        return Ok(items);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef,KitchenStaff")]
    public async Task<IActionResult> GetById(long id)
    {
        var item = await _subRecipeService.GetSubRecipeByIdAsync(id);
        if (item == null) return NotFound(new { message = "SubRecipe not found." });
        return Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> Create([FromBody] CreateSubRecipeDto dto)
    {
        var result = await _subRecipeService.CreateSubRecipeAsync(dto);
        if (result.IsFailure) return BadRequest(new { message = result.Error });
        return CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value);
    }

    [HttpGet("stocks")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef,KitchenStaff")]
    public async Task<IActionResult> GetBranchStocks([FromQuery] long branchId)
    {
        if (branchId <= 0) return BadRequest(new { message = "Valid branch ID required." });
        if (!_currentUser.HasAccessToBranch(branchId)) return Forbid();

        var stocks = await _subRecipeService.GetBranchSubRecipeStocksAsync(branchId);
        return Ok(stocks);
    }
}
