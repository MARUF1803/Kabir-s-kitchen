namespace KabirKitchen.Domain.Enums;

public enum ConversationType
{
    General = 1,
    OrderSupport = 2,
    CustomCake = 3,
    Payment = 4,
    Delivery = 5,
    Complaint = 6,
    Refund = 7,
    ProductQuestion = 8
}

public enum ConversationStatus
{
    Open = 1,
    WaitingForCustomer = 2,
    WaitingForStaff = 3,
    InProgress = 4,
    Resolved = 5,
    Closed = 6
}

public enum ConversationPriority
{
    Low = 1,
    Normal = 2,
    High = 3
}

public enum MessageSenderType
{
    Customer = 1,
    AI = 2,
    Staff = 3,
    System = 4
}

public enum MessageType
{
    Text = 1,
    Image = 2,
    File = 3,
    SystemEvent = 4,
    OrderUpdate = 5,
    Quote = 6,
    PaymentRequest = 7
}

public enum NotificationType
{
    ConversationCreated = 1,
    CustomerMessage = 2,
    HighPriorityComplaint = 3,
    CustomCakeRequest = 4,
    QuoteReply = 5,
    HumanSupportRequested = 6,
    AgentJoined = 7,
    AgentReply = 8,
    QuoteReceived = 9,
    PaymentRequestCreated = 10,
    ConversationResolved = 11
}
