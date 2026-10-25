using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Bakery;
using KabirKitchen.Domain.Entities.Identity;
using KabirKitchen.Domain.Entities.Orders;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Entities.Support;

public class Conversation : BaseEntity
{
    public long CustomerId { get; set; }
    public User? Customer { get; set; }
    public long BranchId { get; set; }
    public Branch? Branch { get; set; }
    public long? OrderId { get; set; }
    public Order? Order { get; set; }
    public long? CakeOrderId { get; set; }
    public CakeCustomOrder? CakeOrder { get; set; }
    public ConversationType Type { get; set; }
    public ConversationStatus Status { get; set; } = ConversationStatus.Open;
    public ConversationPriority Priority { get; set; } = ConversationPriority.Normal;
    public long? AssignedAgentId { get; set; }
    public User? AssignedAgent { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string? CustomerNotes { get; set; }
    public DateTime? ClosedAtUtc { get; set; }
    public int UnreadCount { get; set; }
    public DateTime? LastReadAtUtc { get; set; }
    public ICollection<ConversationMessage> Messages { get; set; } = new List<ConversationMessage>();
}

public class ConversationMessage : BaseEntity
{
    public long ConversationId { get; set; }
    public Conversation? Conversation { get; set; }
    public MessageSenderType SenderType { get; set; }
    public long? SenderId { get; set; }
    public MessageType MessageType { get; set; } = MessageType.Text;
    public string Text { get; set; } = string.Empty;
    public string? AttachmentUrl { get; set; }
    public string? AttachmentFileName { get; set; }
    public long? AttachmentSizeBytes { get; set; }
    public DateTime? ReadAtUtc { get; set; }
}

public class ConversationAttachment : BaseEntity
{
    public long ConversationId { get; set; }
    public Conversation? Conversation { get; set; }
    public long? MessageId { get; set; }
    public ConversationMessage? Message { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public bool IsApproved { get; set; }
}
