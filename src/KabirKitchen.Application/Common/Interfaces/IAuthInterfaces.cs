using System.Security.Claims;
using KabirKitchen.Domain.Entities.Identity;

namespace KabirKitchen.Application.Common.Interfaces;

public interface ICurrentUserService
{
    long? UserId { get; }
    string? UserEmail { get; }
    string? RoleName { get; }
    long? BranchId { get; }
    bool IsGlobalSuperAdmin { get; }
    bool HasAccessToBranch(long branchId);
}

public interface IJwtTokenService
{
    string GenerateAccessToken(User user, string roleName, long? branchId = null);
    string GenerateRefreshToken();
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
}
