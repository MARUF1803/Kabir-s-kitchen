using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.Services;
using KabirKitchen.Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/hero-banners")]
public sealed class HeroBannerController : ControllerBase
{
    private readonly HeroBannerService _service;
    private readonly IFileStorage _storage;
    private readonly ICurrentUserService _currentUser;

    public HeroBannerController(HeroBannerService service, IFileStorage storage, ICurrentUserService currentUser)
    {
        _service = service;
        _storage = storage;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<IActionResult> GetVisible([FromQuery] long branchId)
    {
        if (branchId <= 0) return BadRequest(new { message = "A valid branch ID is required." });
        var result = await _service.GetVisibleAsync(branchId);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpGet("admin")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    public async Task<IActionResult> GetAll()
    {
        var scoped = IsBranchScoped;
        if (scoped && !_currentUser.BranchId.HasValue) return Forbid();
        var result = await _service.GetAllAsync(scoped ? _currentUser.BranchId : null, !scoped);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpPost]
    [Authorize(Roles = "Admin,BranchManager,SuperAdmin")]
    public async Task<IActionResult> Create([FromBody] CreateHeroBannerRequestDto request)
    {
        if (!CanManageBranch(request.BranchId)) return Forbid();
        var result = await _service.CreateAsync(request);
        return result.IsSuccess ? Created("/api/hero-banners/admin", result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpPut("{id:long}")]
    [Authorize(Roles = "Admin,BranchManager,SuperAdmin")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateHeroBannerRequestDto request)
    {
        var existing = await _service.GetByIdAsync(id);
        if (existing is null) return NotFound(new { message = "Hero banner not found." });
        if (!CanManageBranch(existing.BranchId) || !CanManageBranch(request.BranchId)) return Forbid();
        var result = await _service.UpdateAsync(id, request);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpDelete("{id:long}")]
    [Authorize(Roles = "Admin,BranchManager,SuperAdmin")]
    public async Task<IActionResult> Delete(long id)
    {
        var existing = await _service.GetByIdAsync(id);
        if (existing is null) return NotFound(new { message = "Hero banner not found." });
        if (!CanManageBranch(existing.BranchId)) return Forbid();
        var result = await _service.DeleteAsync(id);
        return result.IsSuccess ? NoContent() : BadRequest(new { message = result.Error });
    }

    [HttpPost("upload")]
    [Authorize(Roles = "Admin,SuperAdmin,BranchManager")]
    [Consumes("multipart/form-data")]
    [RequestFormLimits(MultipartBodyLengthLimit = 5 * 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile image)
    {
        if (image is null || image.Length == 0) return BadRequest(new { message = "A banner image is required." });
        var extension = Path.GetExtension(image.FileName).ToLowerInvariant();
        var expectedContentType = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => null
        };
        if (image.Length > 5 * 1024 * 1024 || expectedContentType is null ||
            !string.Equals(image.ContentType, expectedContentType, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Upload a JPG, PNG, or WebP image no larger than 5 MB." });
        }

        await using var stream = new MemoryStream();
        await image.CopyToAsync(stream);
        stream.Position = 0;
        var storageKey = await _storage.SaveAsync($"hero-banner-{Guid.NewGuid():N}{extension}", stream, expectedContentType);
        return Ok(new { storageKey, imageUrl = $"/api/hero-banners/images/{storageKey}" });
    }

    [HttpGet("images/{storageKey}")]
    public async Task<IActionResult> GetImage(string storageKey)
    {
        var stream = await _storage.OpenAsync(storageKey);
        if (stream is null) return NotFound();
        var contentType = Path.GetExtension(storageKey).ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
        return File(stream, contentType);
    }

    private bool IsBranchScoped =>
        (_currentUser.BranchId.HasValue && !_currentUser.IsGlobalSuperAdmin) ||
        string.Equals(_currentUser.RoleName, "BranchManager", StringComparison.OrdinalIgnoreCase);

    private bool CanManageBranch(long? branchId)
    {
        if (IsBranchScoped)
            return _currentUser.BranchId.HasValue && branchId == _currentUser.BranchId.Value;
        if (branchId is null)
            return _currentUser.IsGlobalSuperAdmin ||
                (!_currentUser.BranchId.HasValue &&
                 !string.Equals(_currentUser.RoleName, "BranchManager", StringComparison.OrdinalIgnoreCase));
        return _currentUser.HasAccessToBranch(branchId.Value);
    }
}
