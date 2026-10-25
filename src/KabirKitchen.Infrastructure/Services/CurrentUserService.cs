using System.Security.Claims;
using KabirKitchen.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace KabirKitchen.Infrastructure.Services;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public long? UserId
    {
        get
        {
            var claim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier);
            return claim != null && long.TryParse(claim.Value, out var id) ? id : null;
        }
    }

    public string? UserEmail => _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Email)?.Value;

    public string? RoleName => _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Role)?.Value;

    public long? BranchId
    {
        get
        {
            var claim = _httpContextAccessor.HttpContext?.User.FindFirst("BranchId");
            return claim != null && long.TryParse(claim.Value, out var id) ? id : null;
        }
    }

    public bool IsGlobalSuperAdmin
    {
        get
        {
            var claim = _httpContextAccessor.HttpContext?.User.FindFirst("IsGlobalSuperAdmin");
            return claim != null && bool.TryParse(claim.Value, out var isAdmin) && isAdmin;
        }
    }

    /// <summary>
    /// Strict Branch Guard: Validates whether current user has authorization to access the specified branch.
    /// Global SuperAdmin has access to ALL branches.
    /// Branch staff only has access to their assigned branch.
    /// </summary>
    public bool HasAccessToBranch(long branchId)
    {
        if (IsGlobalSuperAdmin) return true;
        return BranchId.HasValue && BranchId.Value == branchId;
    }
}
