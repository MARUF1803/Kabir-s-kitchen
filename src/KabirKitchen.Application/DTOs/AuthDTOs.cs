namespace KabirKitchen.Application.DTOs;

public record LoginRequestDto(string EmailOrPhone, string Password, long? SelectedBranchId = null);

public record LoginResponseDto(
    long UserId,
    string FullName,
    string Email,
    string Role,
    long? CurrentBranchId,
    string? CurrentBranchName,
    string AccessToken,
    string RefreshToken,
    List<long> AssignedBranchIds,
    string? PhoneNumber = null
);

public record RegisterUserDto(
    string FullName,
    string Email,
    string PhoneNumber,
    string Password,
    string RoleName,
    long? PrimaryBranchId = null
);
