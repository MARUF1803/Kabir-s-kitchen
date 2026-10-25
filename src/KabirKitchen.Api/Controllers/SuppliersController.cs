using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
public class SuppliersController : ControllerBase
{
    private readonly ProcurementService _procurementService;

    public SuppliersController(ProcurementService procurementService)
    {
        _procurementService = procurementService;
    }

    [HttpGet]
    public async Task<IActionResult> GetSuppliers()
    {
        var suppliers = await _procurementService.GetSuppliersAsync();
        return Ok(suppliers);
    }

    [HttpPost]
    public async Task<IActionResult> CreateSupplier([FromBody] CreateSupplierDto dto)
    {
        var result = await _procurementService.CreateSupplierAsync(dto);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return CreatedAtAction(nameof(GetSuppliers), result.Value);
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> UpdateSupplier(long id, [FromBody] UpdateSupplierDto dto)
    {
        var result = await _procurementService.UpdateSupplierAsync(id, dto);
        if (result.IsFailure)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Value);
    }
}
