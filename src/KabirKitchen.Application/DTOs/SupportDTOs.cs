using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Application.DTOs;

public record ConversationSummaryDto(
    long Id,
    string Subject,
    long CustomerId,
    string CustomerName,
    long BranchId,
    string BranchName,
    long? OrderId,
    string? OrderNumber,
    ConversationType Type,
    ConversationStatus Status,
    ConversationPriority Priority,
    string? AssignedAgentName,
    string LastMessage,
    DateTime UpdatedAtUtc,
    int UnreadCount);

public record ConversationDetailDto(
    long Id,
    long CustomerId,
    string CustomerName,
    long BranchId,
    string BranchName,
    long? OrderId,
    string? OrderNumber,
    ConversationType Type,
    ConversationStatus Status,
    ConversationPriority Priority,
    string? AssignedAgentName,
    string Subject,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    DateTime? ClosedAtUtc,
    List<ConversationMessageDto> Messages,
    OrderContextDto? Order,
    CakeContextDto? CakeOrder);

public record ConversationMessageDto(
    long Id,
    MessageSenderType SenderType,
    long? SenderId,
    MessageType MessageType,
    string Text,
    string? AttachmentUrl,
    string? AttachmentFileName,
    DateTime CreatedAtUtc,
    DateTime? ReadAtUtc);

public record OrderContextDto(
    long Id,
    string OrderNumber,
    OrderType OrderType,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    string CustomerName,
    string CustomerPhone,
    string? DeliveryAddress,
    decimal TotalAmount,
    List<OrderItemContextDto> Items);

public record OrderItemContextDto(long Id, string Name, int Quantity, decimal UnitPrice, string? Instructions);

public record CakeContextDto(
    long Id,
    string CustomOrderNumber,
    string Flavor,
    string CreamType,
    decimal WeightKg,
    string? MessageOnCake,
    DateTime DeliveryDate,
    string? ReferenceImageUrl,
    CakeOrderStatus Status,
    bool IsAdvanceVerified,
    decimal AdvanceRequiredAmount,
    decimal AdvancePaidAmount);

public record CreateConversationRequestDto(
    long BranchId,
    ConversationType Type,
    string? Subject,
    long? OrderId,
    long? CakeOrderId,
    ConversationPriority Priority = ConversationPriority.Normal);

public record SendMessageRequestDto(
    long ConversationId,
    string Text,
    MessageType MessageType = MessageType.Text,
    string? AttachmentUrl = null,
    string? AttachmentFileName = null,
    long? AttachmentSizeBytes = null);

public record UpdateConversationRequestDto(
    ConversationStatus Status,
    ConversationPriority? Priority = null,
    long? AssignedAgentId = null);

public record AttachmentUploadDto(string FileName, string ContentType, long SizeBytes, string StorageKey);

public record SupportSearchRequestDto(
    string? Query,
    long? BranchId,
    ConversationType? Type,
    ConversationStatus? Status,
    ConversationPriority? Priority,
    bool? Unassigned,
    bool? MyConversations,
    int Page = 1,
    int PageSize = 25);
