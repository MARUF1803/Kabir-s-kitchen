using KabirKitchen.Domain.Entities.Bakery;
using KabirKitchen.Domain.Entities.Banners;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Identity;
using KabirKitchen.Domain.Entities.Inventory;
using KabirKitchen.Domain.Entities.Kitchen;
using KabirKitchen.Domain.Entities.Orders;
using KabirKitchen.Domain.Entities.Organization;
using KabirKitchen.Domain.Entities.Procurement;
using KabirKitchen.Domain.Entities.Production;
using KabirKitchen.Domain.Entities.Promotions;
using KabirKitchen.Domain.Entities.Recipe;
using KabirKitchen.Domain.Entities.Support;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    // Identity & Org
    DbSet<User> Users { get; }
    DbSet<Role> Roles { get; }
    DbSet<UserRoleAssignment> UserRoles { get; }
    DbSet<RolePermission> RolePermissions { get; }
    DbSet<UserBranchAssignment> UserBranchAssignments { get; }
    DbSet<Branch> Branches { get; }
    DbSet<DiningTable> DiningTables { get; }

    // Campaigns
    DbSet<HeroBanner> HeroBanners { get; }
    DbSet<PromotionCampaign> PromotionCampaigns { get; }
    DbSet<PromotionEngagement> PromotionEngagements { get; }

    // Catalog
    DbSet<Category> Categories { get; }
    DbSet<MenuItem> MenuItems { get; }
    DbSet<MenuItemVariant> MenuItemVariants { get; }
    DbSet<AddOn> AddOns { get; }
    DbSet<MenuItemAddOn> MenuItemAddOns { get; }

    // Recipe & BOM
    DbSet<Ingredient> Ingredients { get; }
    DbSet<Recipe> Recipes { get; }
    DbSet<RecipeIngredient> RecipeIngredients { get; }

    // Inventory & Overrides
    DbSet<BranchIngredientStock> BranchIngredientStocks { get; }
    DbSet<StockTransaction> StockTransactions { get; }
    DbSet<BranchMenuItemOverride> BranchMenuItemOverrides { get; }

    // Procurement
    DbSet<Supplier> Suppliers { get; }
    DbSet<PurchaseOrder> PurchaseOrders { get; }
    DbSet<PurchaseOrderItem> PurchaseOrderItems { get; }
    DbSet<PurchasePayment> PurchasePayments { get; }

    // Orders & Payments
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<OrderItemAddOn> OrderItemAddOns { get; }
    DbSet<OrderPayment> OrderPayments { get; }

    // Bakery & Kitchen
    DbSet<CakeCustomOrder> CakeCustomOrders { get; }
    DbSet<KitchenTicket> KitchenTickets { get; }
    DbSet<WastageRecord> WastageRecords { get; }

    // Customer support
    DbSet<Conversation> Conversations { get; }
    DbSet<ConversationMessage> ConversationMessages { get; }
    DbSet<ConversationAttachment> ConversationAttachments { get; }

    // ─── Inventory ERP — Sub-Recipe Layer ────────────────────────────────────
    DbSet<SubRecipe> SubRecipes { get; }
    DbSet<SubRecipeIngredient> SubRecipeIngredients { get; }
    DbSet<BranchSubRecipeStock> BranchSubRecipeStocks { get; }
    DbSet<SubRecipeStockTransaction> SubRecipeStockTransactions { get; }

    // ─── Inventory ERP — Finished Product Layer ──────────────────────────────
    DbSet<BranchProductStock> BranchProductStocks { get; }
    DbSet<ProductStockTransaction> ProductStockTransactions { get; }

    // ─── Inventory ERP — Lot Tracking ────────────────────────────────────────
    DbSet<InventoryLot> InventoryLots { get; }
    DbSet<IngredientLotAllocation> IngredientLotAllocations { get; }
    DbSet<SubRecipeLotAllocation> SubRecipeLotAllocations { get; }
    DbSet<ProductLotAllocation> ProductLotAllocations { get; }

    // ─── Inventory ERP — Production ──────────────────────────────────────────
    DbSet<ProductionBatch> ProductionBatches { get; }
    DbSet<ProductionBatchIngredient> ProductionBatchIngredients { get; }
    DbSet<ProductionBatchSubRecipe> ProductionBatchSubRecipes { get; }
    DbSet<ProductionBatchCostSnapshot> ProductionBatchCostSnapshots { get; }

    // ─── Inventory ERP — Equipment Reservoirs ────────────────────────────────
    DbSet<EquipmentReservoir> EquipmentReservoirs { get; }
    DbSet<EquipmentReservoirTransaction> EquipmentReservoirTransactions { get; }

    // ─── Inventory ERP — UOM Conversions ─────────────────────────────────────
    DbSet<IngredientUomConversion> IngredientUomConversions { get; }

    // ─── Table Reservations ───────────────────────────────────────────────────
    DbSet<TableReservation> TableReservations { get; }

    // ─── Cash Shifts (Z-Report) ───────────────────────────────────────────────
    DbSet<CashShift> CashShifts { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
