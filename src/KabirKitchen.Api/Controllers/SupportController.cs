using System.Security.Claims;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace KabirKitchen.Api.Controllers;

[ApiController]
[Route("api/support")]
[Authorize]
public sealed class SupportController : ControllerBase
{
    private readonly SupportService _support;

    public SupportController(SupportService support)
    {
        _support = support;
    }

    [HttpPost("conversations")]
    public async Task<IActionResult> CreateConversation([FromBody] CreateConversationRequestDto request)
    {
        var customerId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!long.TryParse(customerId, out var id)) return Unauthorized();
        var result = await _support.CreateConversationAsync(request, id);
        return result.IsSuccess ? CreatedAtAction(nameof(GetConversation), new { id = result.Value.Id }, result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations([FromQuery] SupportSearchRequestDto request)
    {
        var result = await _support.GetConversationsAsync(request);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpGet("conversations/{id:long}")]
    public async Task<IActionResult> GetConversation(long id)
    {
        var result = await _support.GetConversationAsync(id);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { message = result.Error });
    }

    [HttpPost("conversations/{id:long}/messages")]
    public async Task<IActionResult> SendMessage(long id, [FromBody] SendMessageRequestDto request)
    {
        request = request with { ConversationId = id };
        var result = await _support.SendMessageAsync(request);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpPost("conversations/{id:long}/ai")]
    public async Task<IActionResult> AskAi(long id, [FromBody] AiRequestDto request)
    {
        var result = await _support.AskAiAsync(id, request.Question);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpPut("conversations/{id:long}")]
    [Authorize(Roles = "SupportAgent,Support,Admin,BranchManager")]
    public async Task<IActionResult> UpdateConversation(long id, [FromBody] UpdateConversationRequestDto request)
    {
        var result = await _support.UpdateConversationAsync(id, request);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpPost("conversations/{id:long}/messages/{messageId:long}/attachments")]
    [RequestFormLimits(MultipartBodyLengthLimit = 5 * 1024 * 1024)]
    public async Task<IActionResult> UploadAttachment(long id, long messageId, IFormFile file)
    {
        if (file is null || file.Length == 0) return BadRequest(new { message = "A file is required." });
        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream);
        var result = await _support.UploadAttachmentAsync(id, messageId, stream, file.FileName, file.ContentType, file.Length);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { message = result.Error });
    }

    [HttpGet("attachments/{storageKey}")]
    public async Task<IActionResult> DownloadAttachment(string storageKey)
    {
        var stream = await _support.GetAttachmentAsync(storageKey);
        return stream == null ? NotFound(new { message = "Attachment not found." }) : File(stream, "application/octet-stream");
    }
}

public record AiRequestDto(string Question);
