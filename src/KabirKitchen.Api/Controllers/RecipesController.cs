using KabirKitchen.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
public class RecipesController : ControllerBase
{
    private readonly RecipeCostingService _costingService;

    public RecipesController(RecipeCostingService costingService)
    {
        _costingService = costingService;
    }

    [HttpGet("costing/{menuItemId}")]
    public async Task<IActionResult> GetMenuItemCosting(long menuItemId, [FromQuery] long? variantId = null)
    {
        var costing = await _costingService.GetMenuItemCostingAsync(menuItemId, variantId);
        if (costing == null)
            return NotFound(new { message = "Recipe or Menu item not found." });

        return Ok(costing);
    }

    [HttpGet("alerts")]
    public async Task<IActionResult> GetFoodCostSpikeAlerts()
    {
        var alerts = await _costingService.GetFoodCostSpikeAlertsAsync();
        return Ok(alerts);
    }
}
