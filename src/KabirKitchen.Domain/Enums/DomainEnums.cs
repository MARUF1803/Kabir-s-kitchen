namespace KabirKitchen.Domain.Enums;

public enum UserRole
{
    SuperAdmin = 1,
    Admin = 2,
    BranchManager = 3,
    Cashier = 4,
    Chef = 5,
    KitchenStaff = 6,
    Waiter = 7,
    Rider = 8,
    Customer = 9
}

public enum UnitType
{
    Gram = 1,
    Kilogram = 2,
    Milliliter = 3,
    Liter = 4,
    Piece = 5
}

public enum OrderType
{
    DineIn = 1,
    Takeaway = 2,
    Delivery = 3,
    POS = 4
}

public enum OrderStatus
{
    Pending = 1,
    Confirmed = 2,
    Preparing = 3,
    Ready = 4,
    OutForDelivery = 5,
    Delivered = 6,
    Cancelled = 7
}

public enum PaymentStatus
{
    Pending = 1,
    PartiallyPaid = 2,
    Paid = 3,
    Refunded = 4,
    Failed = 5
}

public enum PaymentMethod
{
    Cash = 1,
    bKash = 2,
    Nagad = 3,
    Rocket = 4,
    Card = 5,
    CreditDue = 6,
    Split = 7
}

public enum StockTransactionType
{
    PurchaseGRN = 1,
    RecipeConsumption = 2,
    Wastage = 3,
    TransferIn = 4,
    TransferOut = 5,
    AuditAdjustment = 6,
    OpeningStock = 7,
    ReturnToSupplier = 8
}

public enum PurchaseOrderStatus
{
    Draft = 1,
    Submitted = 2,
    Received = 3,
    PartiallyReceived = 4,
    Cancelled = 5
}

public enum CakeOrderStatus
{
    Draft = 1,
    QuoteRequested = 2,
    QuoteApproved = 3,
    AdvancePaid = 4,
    InBaking = 5,
    InDecoration = 6,
    ReadyForDelivery = 7,
    Delivered = 8,
    Cancelled = 9
}

public enum BannerMediaType
{
    Image = 1,
    Video = 2,
    ProductPromotion = 3,
    CategoryPromotion = 4,
    Campaign = 5
}

public enum PromotionDiscountType
{
    Percentage = 1,
    FixedAmount = 2
}

public enum PromotionTargetType
{
    AllItems = 1,
    Product = 2,
    Variant = 3,
    Category = 4
}

public enum PromotionStatus
{
    Draft = 1,
    Scheduled = 2,
    Active = 3,
    Paused = 4,
    Expired = 5,
    Archived = 6
}

public enum PromotionEngagementType
{
    Impression = 1,
    Click = 2
}
