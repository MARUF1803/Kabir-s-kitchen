using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Entities.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtTokenService _jwtService;
    private readonly ICurrentUserService _currentUser;

    public AuthController(IApplicationDbContext context, IJwtTokenService jwtService, ICurrentUserService currentUser)
    {
        _context = context;
        _jwtService = jwtService;
        _currentUser = currentUser;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
    {
        var user = await _context.Users
            .Include(u => u.Roles).ThenInclude(r => r.Role)
            .Include(u => u.BranchAssignments).ThenInclude(b => b.Branch)
            .FirstOrDefaultAsync(u => u.Email == request.EmailOrPhone || u.PhoneNumber == request.EmailOrPhone);

        if (user == null || !user.IsActive || user.IsDeleted || string.IsNullOrWhiteSpace(request.Password) ||
            !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid email/phone or password." });
        }

        var primaryRole = user.Roles.FirstOrDefault()?.Role?.Name ?? "Customer";
        var assignedBranchIds = user.BranchAssignments.Select(b => b.BranchId).ToList();

        // Determine branch context
        long? branchId = request.SelectedBranchId ?? user.BranchAssignments.FirstOrDefault(b => b.IsPrimary)?.BranchId ?? user.BranchAssignments.FirstOrDefault()?.BranchId;
        string? branchName = user.BranchAssignments.FirstOrDefault(b => b.BranchId == branchId)?.Branch?.Name;

        var token = _jwtService.GenerateAccessToken(user, primaryRole, branchId);
        var refreshToken = _jwtService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _context.SaveChangesAsync();

        return Ok(new LoginResponseDto(
            user.Id,
            user.FullName,
            user.Email,
            primaryRole,
            branchId,
            branchName,
            token,
            refreshToken,
            assignedBranchIds,
            user.PhoneNumber
        ));
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterUserDto dto)
    {
        var email = dto.Email?.Trim();
        var phoneNumber = dto.PhoneNumber?.Trim();
        var fullName = dto.FullName?.Trim();
        if (string.IsNullOrWhiteSpace(fullName) ||
            string.IsNullOrWhiteSpace(email) ||
            string.IsNullOrWhiteSpace(phoneNumber) ||
            string.IsNullOrWhiteSpace(dto.Password) ||
            dto.Password.Length < 12)
        {
            return BadRequest(new { message = "Name, email, phone number, and a password of at least 12 characters are required." });
        }

        if (await _context.Users.AnyAsync(u => u.Email == email || u.PhoneNumber == phoneNumber))
        {
            return BadRequest(new { message = "Email or phone number is already registered." });
        }

        var user = new User
        {
            FullName = fullName,
            Email = email,
            PhoneNumber = phoneNumber,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            IsGlobalSuperAdmin = false
        };

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "Customer");
        if (role == null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Customer registration is temporarily unavailable." });
        }

        if (dto.PrimaryBranchId.HasValue &&
            !await _context.Branches.AnyAsync(b =>
                b.Id == dto.PrimaryBranchId.Value && b.IsActive && !b.IsDeleted))
        {
            return BadRequest(new { message = "Selected branch is unavailable." });
        }

        _context.Users.Add(user);
        _context.UserRoles.Add(new UserRoleAssignment { User = user, RoleId = role.Id });

        if (dto.PrimaryBranchId.HasValue)
        {
            _context.UserBranchAssignments.Add(new UserBranchAssignment
            {
                User = user,
                BranchId = dto.PrimaryBranchId.Value,
                IsPrimary = true
            });
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "User registered successfully.", userId = user.Id });
    }

    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        if (!_currentUser.UserId.HasValue) return Unauthorized();
        var user = await _context.Users
            .Include(item => item.Roles).ThenInclude(item => item.Role)
            .Include(item => item.BranchAssignments).ThenInclude(item => item.Branch)
            .FirstOrDefaultAsync(item => item.Id == _currentUser.UserId.Value && item.IsActive && !item.IsDeleted);
        if (user is null) return Unauthorized();

        var primaryBranch = user.BranchAssignments.FirstOrDefault(item => item.IsPrimary)
            ?? user.BranchAssignments.FirstOrDefault();
        return Ok(new
        {
            id = user.Id,
            fullName = user.FullName,
            email = user.Email,
            phoneNumber = user.PhoneNumber,
            role = user.Roles.FirstOrDefault()?.Role?.Name ?? "Customer",
            branchId = primaryBranch?.BranchId,
            branchName = primaryBranch?.Branch?.Name,
            assignedBranchIds = user.BranchAssignments.Select(item => item.BranchId).ToList()
        });
    }

    [HttpPost("logout")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> Logout()
    {
        if (_currentUser.UserId.HasValue)
        {
            var user = await _context.Users.FirstOrDefaultAsync(item => item.Id == _currentUser.UserId.Value);
            if (user is not null)
            {
                user.RefreshToken = null;
                user.RefreshTokenExpiryTime = null;
                await _context.SaveChangesAsync();
            }
        }

        return NoContent();
    }
}
