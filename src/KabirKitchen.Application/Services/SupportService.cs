using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Bakery;
using KabirKitchen.Domain.Entities.Orders;
using KabirKitchen.Domain.Entities.Support;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public sealed class SupportService
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUser;
    private readonly INotificationService _notifications;
    private readonly IAiAssistant _aiAssistant;
    private readonly IFileStorage _storage;

    public SupportService(
        IApplicationDbContext context,
        ICurrentUserService currentUser,
        INotificationService notifications,
        IAiAssistant aiAssistant,
        IFileStorage storage)
    {
        _context = context;
        _currentUser = currentUser;
        _notifications = notifications;
        _aiAssistant = aiAssistant;
        _storage = storage;
    }

    public async Task<Result<ConversationDetailDto>> CreateConversationAsync(CreateConversationRequestDto request, long customerId)
    {
        if (!_currentUser.HasAccessToBranch(request.BranchId))
            return Result<ConversationDetailDto>.Failure("You do not have access to this branch.");

        if (request.OrderId.HasValue)
        {
            var order = await _context.Orders.AnyAsync(o => o.Id == request.OrderId.Value && o.BranchId == request.BranchId && o.CustomerUserId == customerId);
            if (!order)
                return Result<ConversationDetailDto>.Failure("Order not found for this customer and branch.");
        }

        if (request.CakeOrderId.HasValue)
        {
            var cake = await _context.CakeCustomOrders.AnyAsync(c => c.Id == request.CakeOrderId.Value && c.BranchId == request.BranchId && c.CustomerPhone == _currentUser.UserEmail);
            if (!cake)
                return Result<ConversationDetailDto>.Failure("Custom cake request not found.");
        }

        var conversation = new Conversation
        {
            CustomerId = customerId,
            BranchId = request.BranchId,
            OrderId = request.OrderId,
            CakeOrderId = request.CakeOrderId,
            Type = request.Type,
            Status = ConversationStatus.Open,
            Priority = request.Priority,
            Subject = string.IsNullOrWhiteSpace(request.Subject) ? GetSubject(request.Type) : request.Subject.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.Conversations.Add(conversation);
        await _context.SaveChangesAsync();
        await NotifyStaffAsync(conversation, NotificationType.ConversationCreated, "New conversation created.");
        return Result<ConversationDetailDto>.Success(ToDetail(conversation));
    }

    public async Task<Result<ConversationDetailDto>> SendMessageAsync(SendMessageRequestDto request)
    {
        var conversation = await _context.Conversations
            .Include(c => c.Messages)
            .FirstOrDefaultAsync(c => c.Id == request.ConversationId);

        if (conversation == null)
            return Result<ConversationDetailDto>.Failure("Conversation not found.");

        bool isOwner = _currentUser.UserId.HasValue && conversation.CustomerId == _currentUser.UserId.Value;
        bool hasStaffAccess = _currentUser.IsGlobalSuperAdmin || (IsSupportAgent() && _currentUser.HasAccessToBranch(conversation.BranchId));

        if (!isOwner && !hasStaffAccess)
            return Result<ConversationDetailDto>.Failure("You do not have permission to message this conversation.");

        if (conversation.Status == ConversationStatus.Resolved || conversation.Status == ConversationStatus.Closed)
            return Result<ConversationDetailDto>.Failure("This conversation is closed.");

        var senderType = IsSupportAgent() ? MessageSenderType.Staff : MessageSenderType.Customer;
        var message = new ConversationMessage
        {
            ConversationId = conversation.Id,
            SenderType = senderType,
            SenderId = _currentUser.UserId,
            MessageType = request.MessageType,
            Text = request.Text.Trim(),
            AttachmentUrl = request.AttachmentUrl,
            AttachmentFileName = request.AttachmentFileName,
            AttachmentSizeBytes = request.AttachmentSizeBytes,
            CreatedAtUtc = DateTime.UtcNow
        };

        conversation.Messages.Add(message);
        // Customer message → staff needs to attend (WaitingForStaff); Staff reply → InProgress
        conversation.Status = senderType == MessageSenderType.Customer
            ? ConversationStatus.WaitingForStaff
            : ConversationStatus.InProgress;
        conversation.UpdatedAtUtc = DateTime.UtcNow;
        // UnreadCount = messages the STAFF hasn't read yet; increment on customer messages, reset on staff replies
        conversation.UnreadCount = senderType == MessageSenderType.Customer
            ? conversation.UnreadCount + 1
            : 0;
        await _context.SaveChangesAsync();

        if (senderType == MessageSenderType.Customer)
            await NotifyStaffAsync(conversation, NotificationType.CustomerMessage, "A customer sent a new message.");

        return Result<ConversationDetailDto>.Success(ToDetail(conversation));
    }

    public async Task<Result<ConversationDetailDto>> AskAiAsync(long conversationId, string question)
    {
        var conversation = await _context.Conversations.FirstOrDefaultAsync(c => c.Id == conversationId);
        if (conversation == null)
            return Result<ConversationDetailDto>.Failure("Conversation not found.");

        bool isOwner = _currentUser.UserId.HasValue && conversation.CustomerId == _currentUser.UserId.Value;
        bool hasStaffAccess = _currentUser.IsGlobalSuperAdmin || (IsSupportAgent() && _currentUser.HasAccessToBranch(conversation.BranchId));

        if (!isOwner && !hasStaffAccess)
            return Result<ConversationDetailDto>.Failure("You do not have access to this conversation.");

        var answer = await _aiAssistant.AnswerAsync(question, conversation.BranchId, conversation.OrderId);
        var message = new ConversationMessage
        {
            ConversationId = conversation.Id,
            SenderType = MessageSenderType.AI,
            MessageType = MessageType.Text,
            Text = answer.Text,
            CreatedAtUtc = DateTime.UtcNow
        };
        conversation.Messages.Add(message);
        conversation.Status = ConversationStatus.InProgress;
        conversation.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        if (answer.RequiresHumanSupport)
        {
            conversation.Status = ConversationStatus.WaitingForStaff;
            await _context.SaveChangesAsync();
            await NotifyStaffAsync(conversation, NotificationType.HumanSupportRequested, "Customer requested human support.");
        }

        return Result<ConversationDetailDto>.Success(ToDetail(conversation));
    }

    public async Task<Result<ConversationDetailDto>> UpdateConversationAsync(long conversationId, UpdateConversationRequestDto request)
    {
        var conversation = await _context.Conversations.FirstOrDefaultAsync(c => c.Id == conversationId);
        if (conversation == null || !_currentUser.HasAccessToBranch(conversation.BranchId) || !IsSupportAgent())
            return Result<ConversationDetailDto>.Failure("Conversation not found or access denied.");

        conversation.Status = request.Status;
        conversation.Priority = request.Priority ?? conversation.Priority;
        conversation.AssignedAgentId = request.AssignedAgentId ?? conversation.AssignedAgentId;
        conversation.UpdatedAtUtc = DateTime.UtcNow;
        conversation.ClosedAtUtc = request.Status is ConversationStatus.Resolved or ConversationStatus.Closed
            ? DateTime.UtcNow
            : null;
        await _context.SaveChangesAsync();
        return Result<ConversationDetailDto>.Success(ToDetail(conversation));
    }

    public async Task<Result<ConversationDetailDto>> UploadAttachmentAsync(long conversationId, long messageId, Stream content, string fileName, string contentType, long sizeBytes)
    {
        var conversation = await _context.Conversations.FirstOrDefaultAsync(c => c.Id == conversationId);
        if (conversation == null)
            return Result<ConversationDetailDto>.Failure("Conversation not found or access denied.");

        bool isOwner = _currentUser.UserId.HasValue && conversation.CustomerId == _currentUser.UserId.Value;
        bool hasStaffAccess = _currentUser.IsGlobalSuperAdmin || (IsSupportAgent() && _currentUser.HasAccessToBranch(conversation.BranchId));

        if (!isOwner && !hasStaffAccess)
            return Result<ConversationDetailDto>.Failure("You do not have access to this conversation.");

        var message = await _context.ConversationMessages.FirstOrDefaultAsync(m => m.Id == messageId && m.ConversationId == conversationId);
        if (message == null || (message.SenderId != _currentUser.UserId && !IsSupportAgent() && !_currentUser.IsGlobalSuperAdmin))
            return Result<ConversationDetailDto>.Failure("Message not found or access denied.");

        content.Position = 0;
        var storageKey = await _storage.SaveAsync(fileName, content, contentType);
        var attachment = new ConversationAttachment
        {
            ConversationId = conversation.Id,
            MessageId = message.Id,
            FileName = fileName,
            StorageKey = storageKey,
            ContentType = contentType,
            SizeBytes = sizeBytes,
            IsApproved = false
        };
        _context.ConversationAttachments.Add(attachment);
        await _context.SaveChangesAsync();
        return Result<ConversationDetailDto>.Success(ToDetail(conversation));
    }

    public async Task<Stream?> GetAttachmentAsync(string storageKey)
    {
        var attachment = await _context.ConversationAttachments
            .FirstOrDefaultAsync(a => a.StorageKey == storageKey);
        if (attachment == null)
            return null;

        var conversation = await _context.Conversations.FirstOrDefaultAsync(c => c.Id == attachment.ConversationId);
        if (conversation == null)
            return null;

        bool isOwner = _currentUser.UserId.HasValue && conversation.CustomerId == _currentUser.UserId.Value;
        bool hasStaffAccess = _currentUser.IsGlobalSuperAdmin || (IsSupportAgent() && _currentUser.HasAccessToBranch(conversation.BranchId));

        if (!isOwner && !hasStaffAccess)
            return null;

        return await _storage.OpenAsync(storageKey);
    }

    public async Task<Result<IReadOnlyList<ConversationSummaryDto>>> GetConversationsAsync(SupportSearchRequestDto request)
    {
        var query = _context.Conversations
            .AsNoTracking()
            .Include(c => c.Customer)
            .Include(c => c.Branch)
            .Include(c => c.AssignedAgent)
            .Include(c => c.Messages)
            .AsQueryable();

        if (!_currentUser.IsGlobalSuperAdmin)
        {
            if (_currentUser.RoleName is "Customer")
            {
                query = query.Where(c => c.CustomerId == _currentUser.UserId);
            }
            else
            {
                var authorizedBranchIds = await _context.UserBranchAssignments
                    .Where(a => a.UserId == _currentUser.UserId && a.Branch!.IsActive)
                    .Select(a => a.BranchId)
                    .ToListAsync();

                // Fallback: also include the branch from their JWT claim
                if (_currentUser.BranchId.HasValue && !authorizedBranchIds.Contains(_currentUser.BranchId.Value))
                    authorizedBranchIds.Add(_currentUser.BranchId.Value);

                if (authorizedBranchIds.Count > 0)
                    query = query.Where(c => authorizedBranchIds.Contains(c.BranchId));
            }
        }

        if (request.BranchId.HasValue && _currentUser.HasAccessToBranch(request.BranchId.Value))
            query = query.Where(c => c.BranchId == request.BranchId.Value);
        else if (request.BranchId.HasValue)
            query = query.Where(c => false);

        if (request.Type.HasValue) query = query.Where(c => c.Type == request.Type.Value);
        if (request.Status.HasValue) query = query.Where(c => c.Status == request.Status.Value);
        if (request.Priority.HasValue) query = query.Where(c => c.Priority == request.Priority.Value);
        if (request.Unassigned == true) query = query.Where(c => c.AssignedAgentId == null);
        if (request.MyConversations == true)
        {
            if (_currentUser.RoleName is "SupportAgent" or "Support" or "Admin" or "BranchManager")
                query = query.Where(c => c.AssignedAgentId == _currentUser.UserId);
            else
                query = query.Where(c => c.CustomerId == _currentUser.UserId);
        }
        if (request.Query != null) query = query.Where(c => c.Subject.Contains(request.Query) || (c.Customer != null && c.Customer.FullName.Contains(request.Query)));

        var conversations = await query
            .OrderByDescending(c => c.UpdatedAtUtc)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();

        return Result<IReadOnlyList<ConversationSummaryDto>>.Success(conversations.Select(ToSummary).ToList());
    }

    public async Task<Result<ConversationDetailDto>> GetConversationAsync(long conversationId)
    {
        var conversation = await _context.Conversations
            .Include(c => c.Customer)
            .Include(c => c.Branch)
            .Include(c => c.AssignedAgent)
            .Include(c => c.Messages)
            .Include(c => c.Order).ThenInclude(o => o!.Items)
            .Include(c => c.CakeOrder)
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conversation == null)
            return Result<ConversationDetailDto>.Failure("Conversation not found.");

        bool isOwner = _currentUser.UserId.HasValue && conversation.CustomerId == _currentUser.UserId.Value;
        bool hasStaffAccess = _currentUser.IsGlobalSuperAdmin || (IsSupportAgent() && _currentUser.HasAccessToBranch(conversation.BranchId));

        if (!isOwner && !hasStaffAccess)
            return Result<ConversationDetailDto>.Failure("You do not have access to this conversation.");

        if (isOwner || IsSupportAgent() || _currentUser.IsGlobalSuperAdmin)
        {
            conversation.UnreadCount = 0;
            conversation.LastReadAtUtc = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return Result<ConversationDetailDto>.Success(ToDetail(conversation));
    }

    private bool IsSupportAgent() => _currentUser.RoleName is "SupportAgent" or "Support" or "Admin" or "BranchManager";

    private async Task NotifyStaffAsync(Conversation conversation, NotificationType type, string message)
    {
        var recipientIds = await _context.UserBranchAssignments
            .Where(a => a.BranchId == conversation.BranchId && a.User!.IsActive)
            .Select(a => a.UserId)
            .Distinct()
            .ToListAsync();
        foreach (var recipientId in recipientIds)
            await _notifications.NotifyAsync(recipientId, $"Conversation #{conversation.Id}", message, new { conversationId = conversation.Id, type, priority = conversation.Priority });
    }

    private static ConversationDetailDto ToDetail(Conversation conversation) => new(
        conversation.Id,
        conversation.CustomerId,
        conversation.Customer?.FullName ?? "Customer",
        conversation.BranchId,
        conversation.Branch?.Name ?? "Unknown branch",
        conversation.OrderId,
        conversation.Order?.OrderNumber,
        conversation.Type,
        conversation.Status,
        conversation.Priority,
        conversation.AssignedAgent?.FullName,
        conversation.Subject,
        conversation.CreatedAtUtc,
        conversation.UpdatedAtUtc ?? conversation.CreatedAtUtc,
        conversation.ClosedAtUtc,
        conversation.Messages.OrderBy(m => m.CreatedAtUtc).Select(m => new ConversationMessageDto(
            m.Id, m.SenderType, m.SenderId, m.MessageType, m.Text, m.AttachmentUrl, m.AttachmentFileName, m.CreatedAtUtc, m.ReadAtUtc)).ToList(),
        ToOrderContext(conversation.Order),
        ToCakeContext(conversation.CakeOrder));

    private static ConversationSummaryDto ToSummary(Conversation conversation) => new(
        conversation.Id,
        conversation.Subject,
        conversation.CustomerId,
        conversation.Customer?.FullName ?? "Customer",
        conversation.BranchId,
        conversation.Branch?.Name ?? "Unknown branch",
        conversation.OrderId,
        conversation.Order?.OrderNumber,
        conversation.Type,
        conversation.Status,
        conversation.Priority,
        conversation.AssignedAgent?.FullName,
        conversation.Messages.OrderByDescending(m => m.CreatedAtUtc).Select(m => m.Text).FirstOrDefault() ?? string.Empty,
        conversation.UpdatedAtUtc ?? conversation.CreatedAtUtc,
        conversation.UnreadCount);

    private static OrderContextDto? ToOrderContext(Order? order) => order == null ? null : new(
        order.Id, order.OrderNumber, order.OrderType, order.Status, order.PaymentStatus,
        order.CustomerName, order.CustomerPhone, order.DeliveryAddress, order.TotalAmount,
        order.Items.Select(i => new OrderItemContextDto(i.Id, i.ItemName, i.Quantity, i.UnitPrice, i.SpecialInstructions)).ToList());

    private static CakeContextDto? ToCakeContext(CakeCustomOrder? cake) => cake == null ? null : new(
        cake.Id, cake.CustomOrderNumber, cake.Flavor, cake.CreamType, cake.WeightKg,
        cake.MessageOnCake, cake.DeliveryDate, cake.ReferenceImageUrl, cake.Status,
        cake.IsAdvanceVerified, cake.AdvanceRequiredAmount, cake.AdvancePaidAmount);

    private static string GetSubject(ConversationType type) => type switch
    {
        ConversationType.OrderSupport => "Order support",
        ConversationType.CustomCake => "Custom cake request",
        ConversationType.Payment => "Payment help",
        ConversationType.Delivery => "Delivery help",
        ConversationType.Complaint => "Customer complaint",
        ConversationType.Refund => "Refund request",
        ConversationType.ProductQuestion => "Product question",
        _ => "Customer support request"
    };
}
