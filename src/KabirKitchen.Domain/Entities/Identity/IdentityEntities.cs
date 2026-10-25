using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Organization;

namespace KabirKitchen.Domain.Entities.Identity;

public class User : BaseEntity, ISoftDelete
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool IsGlobalSuperAdmin { get; set; } = false;

    // Refresh Token
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }

    // Soft Delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public string? DeletedBy { get; set; }

    // Navigation
    public ICollection<UserRoleAssignment> Roles { get; set; } = new List<UserRoleAssignment>();
    public ICollection<UserBranchAssignment> BranchAssignments { get; set; } = new List<UserBranchAssignment>();
}

public class Role : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    public ICollection<UserRoleAssignment> Users { get; set; } = new List<UserRoleAssignment>();
    public ICollection<RolePermission> Permissions { get; set; } = new List<RolePermission>();
}

public class UserRoleAssignment
{
    public long UserId { get; set; }
    public User? User { get; set; }

    public long RoleId { get; set; }
    public Role? Role { get; set; }
}

public class RolePermission
{
    public long RoleId { get; set; }
    public Role? Role { get; set; }

    public string PermissionKey { get; set; } = string.Empty;
}

public class UserBranchAssignment : BaseEntity
{
    public long UserId { get; set; }
    public User? User { get; set; }

    public long BranchId { get; set; }
    public Branch? Branch { get; set; }

    public bool IsPrimary { get; set; } = false;
}
