using KabirKitchen.Application.Common.Interfaces;
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
            .Where(b => b.IsActive)
            .Select(b => new
            {
                b.Id,
                b.BranchCode,
                b.Name,
                b.Address,
                b.ContactPhone,
                b.ContactEmail,
                CurrentCashDrawerBalance = showDrawer ? b.CurrentCashDrawerBalance : 0m
            })
            .ToListAsync();

        return Ok(branches);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetBranchById(long id)
    {
        var branch = await _context.Branches.FindAsync(id);
        if (branch == null) return NotFound(new { message = "Branch not found." });

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
            CurrentCashDrawerBalance = showDrawer ? branch.CurrentCashDrawerBalance : 0m
        });
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
