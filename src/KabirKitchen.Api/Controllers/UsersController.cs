using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Domain.Entities.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
public class UsersController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;

    public UsersController(IApplicationDbContext context, ICurrentUserService currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    /// <summary>GET /api/users — List all staff members (scoped to branch for BranchManager)</summary>
    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] long? branchId = null)
    {
        if (!_currentUser.IsGlobalSuperAdmin && _currentUser.BranchId.HasValue)
        {
            branchId = _currentUser.BranchId.Value;
        }

        var query = _context.Users
            .Include(u => u.Roles).ThenInclude(r => r.Role)
            .Include(u => u.BranchAssignments).ThenInclude(b => b.Branch)
            .Where(u => !u.IsGlobalSuperAdmin)
            .AsQueryable();

        if (branchId.HasValue && branchId.Value > 0)
        {
            query = query.Where(u =>
                u.BranchAssignments.Any(b => b.BranchId == branchId.Value));
        }

        var users = await query.OrderBy(u => u.FullName).ToListAsync();

        var result = users.Select(u => new
        {
            id = u.Id,
            fullName = u.FullName,
            email = u.Email,
            phoneNumber = u.PhoneNumber,
            role = u.Roles.FirstOrDefault()?.Role?.Name ?? "Cashier",
            branchId = u.BranchAssignments.FirstOrDefault(b => b.IsPrimary)?.BranchId
                       ?? u.BranchAssignments.FirstOrDefault()?.BranchId,
            branchName = u.BranchAssignments.FirstOrDefault(b => b.IsPrimary)?.Branch?.Name
                         ?? u.BranchAssignments.FirstOrDefault()?.Branch?.Name
                         ?? "All Branches",
            isActive = u.IsActive,
            createdAtUtc = u.CreatedAtUtc
        });

        return Ok(result);
    }

    /// <summary>POST /api/users — Create a new staff member</summary>
    [HttpPost]
    [Authorize(Roles = "Admin,SuperAdmin")]
    public async Task<IActionResult> CreateUser([FromBody] CreateStaffDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.FullName) || string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest(new { message = "Full name and email are required." });

        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

        if (await _context.Users.AnyAsync(u => u.Email == dto.Email.Trim()))
            return BadRequest(new { message = "A user with this email already exists." });

        var user = new User
        {
            FullName = dto.FullName.Trim(),
            Email = dto.Email.Trim().ToLower(),
            PhoneNumber = dto.PhoneNumber?.Trim() ?? "",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            IsGlobalSuperAdmin = false,
            IsActive = true
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var roleName = dto.Role ?? "Cashier";
        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == roleName)
                   ?? await _context.Roles.FirstOrDefaultAsync(r => r.Name == "Cashier");

        if (role != null)
        {
            _context.UserRoles.Add(new UserRoleAssignment { UserId = user.Id, RoleId = role.Id });
        }

        if (dto.BranchId.HasValue && dto.BranchId.Value > 0)
        {
            if (!_currentUser.IsGlobalSuperAdmin && _currentUser.BranchId.HasValue
                && _currentUser.BranchId.Value != dto.BranchId.Value)
            {
                return Forbid();
            }

            _context.UserBranchAssignments.Add(new UserBranchAssignment
            {
                UserId = user.Id,
                BranchId = dto.BranchId.Value,
                IsPrimary = true
            });
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            id = user.Id,
            fullName = user.FullName,
            email = user.Email,
            role = roleName,
            branchId = dto.BranchId,
            isActive = true,
            message = "Staff member created successfully."
        });
    }

    /// <summary>PATCH /api/users/:id — Update role or active status</summary>
    [HttpPatch("{id:long}")]
    public async Task<IActionResult> UpdateUser(long id, [FromBody] UpdateStaffDto dto)
    {
        var user = await _context.Users
            .Include(u => u.Roles)
            .Include(u => u.BranchAssignments)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null) return NotFound(new { message = "User not found." });

        if (!_currentUser.IsGlobalSuperAdmin && _currentUser.BranchId.HasValue)
        {
            var isSameBranch = user.BranchAssignments.Any(b => b.BranchId == _currentUser.BranchId.Value);
            if (!isSameBranch) return Forbid();
        }

        if (dto.IsActive.HasValue)
        {
            user.IsActive = dto.IsActive.Value;
        }

        if (!string.IsNullOrWhiteSpace(dto.Role))
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == dto.Role);
            if (role != null)
            {
                var existingRoles = user.Roles.ToList();
                foreach (var ur in existingRoles)
                    _context.UserRoles.Remove(ur);

                _context.UserRoles.Add(new UserRoleAssignment { UserId = user.Id, RoleId = role.Id });
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "Staff updated successfully.", userId = id, isActive = user.IsActive });
    }
}

public record CreateStaffDto(
    string FullName,
    string Email,
    string Password,
    string? PhoneNumber,
    string? Role,
    long? BranchId
);

public record UpdateStaffDto(
    bool? IsActive,
    string? Role,
    long? BranchId
);
