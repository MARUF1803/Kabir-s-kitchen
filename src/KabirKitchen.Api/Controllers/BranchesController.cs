using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Domain.Entities.Organization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BranchesController : ControllerBase
{
    private readonly IApplicationDbContext _context;

    public BranchesController(IApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllBranches()
    {
        bool showDrawer = CanViewCashDrawer();
        var branches = await _context.Branches
            .Where(b => !b.IsDeleted)
            .Select(b => new
            {
                b.Id,
                b.BranchCode,
                b.Name,
                b.Address,
                b.ContactPhone,
                b.ContactEmail,
                b.IsActive,
                OpeningTime = b.OpeningTime.ToString(@"hh\:mm"),
                ClosingTime = b.ClosingTime.ToString(@"hh\:mm"),
                CurrentCashDrawerBalance = showDrawer ? b.CurrentCashDrawerBalance : 0m
            })
            .ToListAsync();

        return Ok(branches);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetBranchById(long id)
    {
        var branch = await _context.Branches.FindAsync(id);
        if (branch == null || branch.IsDeleted) return NotFound(new { message = "Branch not found." });

        bool showDrawer = CanViewCashDrawer();
        return Ok(new
        {
            branch.Id,
            branch.BranchCode,
            branch.Name,
            branch.Address,
            branch.ContactPhone,
            branch.ContactEmail,
            branch.IsActive,
            OpeningTime = branch.OpeningTime.ToString(@"hh\:mm"),
            ClosingTime = branch.ClosingTime.ToString(@"hh\:mm"),
            CurrentCashDrawerBalance = showDrawer ? branch.CurrentCashDrawerBalance : 0m
        });
    }

    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> CreateBranch([FromBody] CreateBranchDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "Branch name is required." });
        if (string.IsNullOrWhiteSpace(dto.BranchCode))
            return BadRequest(new { message = "Branch code is required (e.g., UTT-03)." });

        var codeExists = await _context.Branches.AnyAsync(b => b.BranchCode == dto.BranchCode.Trim() && !b.IsDeleted);
        if (codeExists)
            return BadRequest(new { message = $"Branch with code '{dto.BranchCode}' already exists." });

        var openingTime = TimeSpan.TryParse(dto.OpeningTime, out var ot) ? ot : new TimeSpan(10, 0, 0);
        var closingTime = TimeSpan.TryParse(dto.ClosingTime, out var ct) ? ct : new TimeSpan(23, 0, 0);

        var branch = new Branch
        {
            Name = dto.Name.Trim(),
            BranchCode = dto.BranchCode.Trim().ToUpperInvariant(),
            Address = dto.Address?.Trim() ?? string.Empty,
            ContactPhone = dto.ContactPhone?.Trim() ?? string.Empty,
            ContactEmail = dto.ContactEmail?.Trim() ?? string.Empty,
            IsActive = dto.IsActive ?? true,
            OpeningTime = openingTime,
            ClosingTime = closingTime,
            CashDrawerOpeningBalance = dto.InitialCashDrawerBalance ?? 0m,
            CurrentCashDrawerBalance = dto.InitialCashDrawerBalance ?? 0m,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.Branches.Add(branch);
        await _context.SaveChangesAsync();

        // Seed 6 default dining tables for the new outlet
        for (int i = 1; i <= 6; i++)
        {
            _context.DiningTables.Add(new DiningTable
            {
                BranchId = branch.Id,
                TableNumber = $"T-{i:D2}",
                SeatingCapacity = 4,
                IsOccupied = false,
                CreatedAtUtc = DateTime.UtcNow
            });
        }
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBranchById), new { id = branch.Id }, branch);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> UpdateBranch(long id, [FromBody] UpdateBranchDto dto)
    {
        var branch = await _context.Branches.FindAsync(id);
        if (branch == null || branch.IsDeleted)
            return NotFound(new { message = "Branch not found." });

        if (!string.IsNullOrWhiteSpace(dto.Name)) branch.Name = dto.Name.Trim();
        if (!string.IsNullOrWhiteSpace(dto.BranchCode)) branch.BranchCode = dto.BranchCode.Trim().ToUpperInvariant();
        if (dto.Address != null) branch.Address = dto.Address.Trim();
        if (dto.ContactPhone != null) branch.ContactPhone = dto.ContactPhone.Trim();
        if (dto.ContactEmail != null) branch.ContactEmail = dto.ContactEmail.Trim();
        if (dto.IsActive.HasValue) branch.IsActive = dto.IsActive.Value;
        if (!string.IsNullOrWhiteSpace(dto.OpeningTime) && TimeSpan.TryParse(dto.OpeningTime, out var ot)) branch.OpeningTime = ot;
        if (!string.IsNullOrWhiteSpace(dto.ClosingTime) && TimeSpan.TryParse(dto.ClosingTime, out var ct)) branch.ClosingTime = ct;
        if (dto.CurrentCashDrawerBalance.HasValue) branch.CurrentCashDrawerBalance = dto.CurrentCashDrawerBalance.Value;
        branch.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(branch);
    }

    [HttpPatch("{id}/toggle-active")]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> ToggleActive(long id)
    {
        var branch = await _context.Branches.FindAsync(id);
        if (branch == null || branch.IsDeleted)
            return NotFound(new { message = "Branch not found." });

        branch.IsActive = !branch.IsActive;
        branch.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(new { branch.Id, branch.Name, branch.IsActive });
    }

    private bool CanViewCashDrawer()
    {
        return User.IsInRole("Admin") ||
               User.IsInRole("SuperAdmin") ||
               User.IsInRole("BranchManager") ||
               User.IsInRole("Cashier");
    }

    [HttpGet("{id}/tables")]
    public async Task<IActionResult> GetBranchTables(long id)
    {
        var tables = await _context.DiningTables
            .Where(t => t.BranchId == id)
            .Select(t => new
            {
                t.Id,
                t.TableNumber,
                t.SeatingCapacity,
                t.IsOccupied,
                t.ActiveOrderNumber,
                t.QrCodeKey
            })
            .ToListAsync();

        return Ok(tables);
    }
}

public record CreateBranchDto(
    string Name,
    string BranchCode,
    string? Address,
    string? ContactPhone,
    string? ContactEmail,
    string? OpeningTime,
    string? ClosingTime,
    decimal? InitialCashDrawerBalance,
    bool? IsActive
);

public record UpdateBranchDto(
    string? Name,
    string? BranchCode,
    string? Address,
    string? ContactPhone,
    string? ContactEmail,
    string? OpeningTime,
    string? ClosingTime,
    decimal? CurrentCashDrawerBalance,
    bool? IsActive
);
