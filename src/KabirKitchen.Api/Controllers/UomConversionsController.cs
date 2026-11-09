using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Entities.Recipe;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UomConversionsController : ControllerBase
{
    private readonly IApplicationDbContext _context;

    public UomConversionsController(IApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager,Chef")]
    public async Task<IActionResult> GetByIngredient([FromQuery] long? ingredientId)
    {
        var query = _context.IngredientUomConversions
            .Include(c => c.Ingredient)
            .Where(c => c.IsActive)
            .AsQueryable();

        if (ingredientId.HasValue && ingredientId.Value > 0)
            query = query.Where(c => c.IngredientId == ingredientId.Value);

        var list = await query.ToListAsync();

        return Ok(list.Select(c => new IngredientUomConversionDto(
            c.Id,
            c.IngredientId,
            c.Ingredient?.Name ?? "",
            c.FromUnit,
            c.ToBaseUnit,
            c.Multiplier,
            c.IsDefaultPurchaseUnit,
            c.PackageDescription,
            c.IsActive
        )));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> Create([FromBody] CreateIngredientUomConversionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.FromUnit))
            return BadRequest(new { message = "FromUnit package name is required." });
        if (dto.Multiplier <= 0)
            return BadRequest(new { message = "Multiplier must be positive." });

        var ingredient = await _context.Ingredients.FindAsync(dto.IngredientId);
        if (ingredient == null) return NotFound(new { message = "Ingredient not found." });

        var exists = await _context.IngredientUomConversions
            .AnyAsync(c => c.IngredientId == dto.IngredientId &&
                           c.FromUnit == dto.FromUnit.Trim() &&
                           c.ToBaseUnit == dto.ToBaseUnit);
        if (exists)
            return BadRequest(new { message = "A conversion for this ingredient, package unit, and target unit already exists." });

        var conv = new IngredientUomConversion
        {
            IngredientId = dto.IngredientId,
            FromUnit = dto.FromUnit.Trim(),
            ToBaseUnit = dto.ToBaseUnit,
            Multiplier = dto.Multiplier,
            IsDefaultPurchaseUnit = dto.IsDefaultPurchaseUnit,
            PackageDescription = dto.PackageDescription?.Trim(),
            IsActive = true
        };

        _context.IngredientUomConversions.Add(conv);
        await _context.SaveChangesAsync();

        return Ok(new IngredientUomConversionDto(
            conv.Id,
            conv.IngredientId,
            ingredient.Name,
            conv.FromUnit,
            conv.ToBaseUnit,
            conv.Multiplier,
            conv.IsDefaultPurchaseUnit,
            conv.PackageDescription,
            conv.IsActive
        ));
    }
}
