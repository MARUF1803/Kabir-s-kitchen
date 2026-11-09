using System.Linq.Expressions;
using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Domain.Common;
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

namespace KabirKitchen.Infrastructure.Persistence;

public class KabirKitchenDbContext : DbContext, IApplicationDbContext
{
    public KabirKitchenDbContext(DbContextOptions<KabirKitchenDbContext> options) : base(options)
    {
    }

    // Identity & Org
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<UserRoleAssignment> UserRoles => Set<UserRoleAssignment>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserBranchAssignment> UserBranchAssignments => Set<UserBranchAssignment>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<DiningTable> DiningTables => Set<DiningTable>();

    // Campaigns
    public DbSet<HeroBanner> HeroBanners => Set<HeroBanner>();
    public DbSet<PromotionCampaign> PromotionCampaigns => Set<PromotionCampaign>();
    public DbSet<PromotionEngagement> PromotionEngagements => Set<PromotionEngagement>();

    // Catalog
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<MenuItemVariant> MenuItemVariants => Set<MenuItemVariant>();
    public DbSet<AddOn> AddOns => Set<AddOn>();
    public DbSet<MenuItemAddOn> MenuItemAddOns => Set<MenuItemAddOn>();

    // Recipe & BOM
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<RecipeIngredient> RecipeIngredients => Set<RecipeIngredient>();

    // Inventory & Overrides
    public DbSet<BranchIngredientStock> BranchIngredientStocks => Set<BranchIngredientStock>();
    public DbSet<StockTransaction> StockTransactions => Set<StockTransaction>();
    public DbSet<BranchMenuItemOverride> BranchMenuItemOverrides => Set<BranchMenuItemOverride>();

    // Procurement
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<PurchasePayment> PurchasePayments => Set<PurchasePayment>();

    // Orders & Payments
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderItemAddOn> OrderItemAddOns => Set<OrderItemAddOn>();
    public DbSet<OrderPayment> OrderPayments => Set<OrderPayment>();

    // Bakery & Kitchen
    public DbSet<CakeCustomOrder> CakeCustomOrders => Set<CakeCustomOrder>();
    public DbSet<KitchenTicket> KitchenTickets => Set<KitchenTicket>();
    public DbSet<WastageRecord> WastageRecords => Set<WastageRecord>();

    // Customer support
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<ConversationMessage> ConversationMessages => Set<ConversationMessage>();
    public DbSet<ConversationAttachment> ConversationAttachments => Set<ConversationAttachment>();

    // ─── Inventory ERP — Sub-Recipe Layer ────────────────────────────────────
    public DbSet<SubRecipe> SubRecipes => Set<SubRecipe>();
    public DbSet<SubRecipeIngredient> SubRecipeIngredients => Set<SubRecipeIngredient>();
    public DbSet<BranchSubRecipeStock> BranchSubRecipeStocks => Set<BranchSubRecipeStock>();
    public DbSet<SubRecipeStockTransaction> SubRecipeStockTransactions => Set<SubRecipeStockTransaction>();

    // ─── Inventory ERP — Finished Product Layer ──────────────────────────────
    public DbSet<BranchProductStock> BranchProductStocks => Set<BranchProductStock>();
    public DbSet<ProductStockTransaction> ProductStockTransactions => Set<ProductStockTransaction>();

    // ─── Inventory ERP — Lot Tracking ────────────────────────────────────────
    public DbSet<InventoryLot> InventoryLots => Set<InventoryLot>();
    public DbSet<IngredientLotAllocation> IngredientLotAllocations => Set<IngredientLotAllocation>();
    public DbSet<SubRecipeLotAllocation> SubRecipeLotAllocations => Set<SubRecipeLotAllocation>();
    public DbSet<ProductLotAllocation> ProductLotAllocations => Set<ProductLotAllocation>();

    // ─── Inventory ERP — Production ──────────────────────────────────────────
    public DbSet<ProductionBatch> ProductionBatches => Set<ProductionBatch>();
    public DbSet<ProductionBatchIngredient> ProductionBatchIngredients => Set<ProductionBatchIngredient>();
    public DbSet<ProductionBatchSubRecipe> ProductionBatchSubRecipes => Set<ProductionBatchSubRecipe>();
    public DbSet<ProductionBatchCostSnapshot> ProductionBatchCostSnapshots => Set<ProductionBatchCostSnapshot>();

    // ─── Inventory ERP — Equipment Reservoirs ────────────────────────────────
    public DbSet<EquipmentReservoir> EquipmentReservoirs => Set<EquipmentReservoir>();
    public DbSet<EquipmentReservoirTransaction> EquipmentReservoirTransactions => Set<EquipmentReservoirTransaction>();

    // ─── Inventory ERP — UOM Conversions ─────────────────────────────────────
    public DbSet<IngredientUomConversion> IngredientUomConversions => Set<IngredientUomConversion>();

    // ─── Table Reservations ───────────────────────────────────────────────────
    public DbSet<TableReservation> TableReservations => Set<TableReservation>();

    // ─── Cash Shifts (Z-Report) ───────────────────────────────────────────────
    public DbSet<CashShift> CashShifts => Set<CashShift>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Many-to-Many Keys
        modelBuilder.Entity<UserRoleAssignment>()
            .HasKey(ur => new { ur.UserId, ur.RoleId });

        modelBuilder.Entity<RolePermission>()
            .HasKey(rp => new { rp.RoleId, rp.PermissionKey });

        modelBuilder.Entity<MenuItemAddOn>()
            .HasKey(ma => new { ma.MenuItemId, ma.AddOnId });

        modelBuilder.Entity<Category>()
            .HasOne(category => category.ParentCategory)
            .WithMany(category => category.Children)
            .HasForeignKey(category => category.ParentCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Category>()
            .Property(category => category.Slug)
            .HasMaxLength(180);
        modelBuilder.Entity<Category>()
            .HasIndex(category => new { category.ParentCategoryId, category.Slug })
            .IsUnique()
            .HasFilter(null);

        modelBuilder.Entity<MenuItem>()
            .Property(item => item.Slug)
            .HasMaxLength(180);
        modelBuilder.Entity<MenuItem>()
            .HasIndex(item => item.Slug)
            .IsUnique();
        modelBuilder.Entity<MenuItem>()
            .HasIndex(item => new { item.CategoryId, item.IsActive, item.Id });

        // Branch Isolation Indexes
        modelBuilder.Entity<BranchIngredientStock>()
            .HasIndex(s => new { s.BranchId, s.IngredientId })
            .IsUnique();

        modelBuilder.Entity<BranchMenuItemOverride>()
            .HasIndex(b => new { b.BranchId, b.MenuItemId })
            .IsUnique();

        modelBuilder.Entity<Conversation>()
            .HasIndex(c => new { c.BranchId, c.Status });
        modelBuilder.Entity<Conversation>()
            .HasIndex(c => new { c.CustomerId, c.UpdatedAtUtc });
        modelBuilder.Entity<Conversation>()
            .HasIndex(c => new { c.AssignedAgentId, c.Status });

        modelBuilder.Entity<ConversationMessage>()
            .HasIndex(m => new { m.ConversationId, m.CreatedAtUtc });

        modelBuilder.Entity<ConversationAttachment>()
            .HasIndex(a => new { a.ConversationId, a.MessageId });

        modelBuilder.Entity<HeroBanner>()
            .HasIndex(b => new { b.IsActive, b.StartDate, b.EndDate });
        modelBuilder.Entity<HeroBanner>()
            .HasIndex(b => new { b.BranchId, b.DisplayOrder });
        modelBuilder.Entity<HeroBanner>()
            .HasIndex(b => new { b.DisplayOrder, b.Id });

        modelBuilder.Entity<PromotionCampaign>()
            .Property(c => c.Name)
            .HasMaxLength(160);
        modelBuilder.Entity<PromotionCampaign>()
            .Property(c => c.CouponCode)
            .HasMaxLength(100);
        modelBuilder.Entity<PromotionCampaign>()
            .Property(c => c.DiscountValue)
            .HasPrecision(18, 4);
        modelBuilder.Entity<PromotionCampaign>()
            .Property(c => c.MaximumDiscountAmount)
            .HasPrecision(18, 2);
        modelBuilder.Entity<PromotionCampaign>()
            .Property(c => c.MinimumOrderAmount)
            .HasPrecision(18, 2);
        modelBuilder.Entity<PromotionCampaign>()
            .HasIndex(c => new { c.Status, c.StartDateUtc, c.EndDateUtc, c.BranchId, c.Priority });
        modelBuilder.Entity<PromotionCampaign>()
            .HasIndex(c => c.CouponCode)
            .IsUnique()
            .HasFilter("[CouponCode] IS NOT NULL");
        modelBuilder.Entity<PromotionCampaign>()
            .Property(c => c.ConcurrencyToken)
            .IsConcurrencyToken();
        modelBuilder.Entity<PromotionEngagement>()
            .HasIndex(engagement => new { engagement.PromotionCampaignId, engagement.Type, engagement.OccurredAtUtc });
        modelBuilder.Entity<PromotionEngagement>()
            .HasOne(engagement => engagement.PromotionCampaign)
            .WithMany()
            .HasForeignKey(engagement => engagement.PromotionCampaignId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<CakeCustomOrder>()
            .Property(cake => cake.SubTotal)
            .HasPrecision(18, 2);
        modelBuilder.Entity<CakeCustomOrder>()
            .Property(cake => cake.DiscountAmount)
            .HasPrecision(18, 2);
        modelBuilder.Entity<CakeCustomOrder>()
            .Property(cake => cake.EstimatedPrice)
            .HasPrecision(18, 2);
        modelBuilder.Entity<CakeCustomOrder>()
            .Property(cake => cake.AdvancePaidAmount)
            .HasPrecision(18, 2);

        modelBuilder.Entity<HeroBanner>()
            .HasOne(b => b.Branch)
            .WithMany()
            .HasForeignKey(b => b.BranchId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<HeroBanner>()
            .HasOne(banner => banner.PromotionCampaign)
            .WithMany()
            .HasForeignKey(banner => banner.PromotionCampaignId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PurchasePayment>()
            .HasOne(p => p.PurchaseOrder)
            .WithMany(o => o.Payments)
            .HasForeignKey(p => p.PurchaseOrderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OrderPayment>()
            .HasOne(p => p.Order)
            .WithMany(o => o.Payments)
            .HasForeignKey(p => p.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Order>()
            .HasIndex(o => new { o.BranchId, o.OrderNumber })
            .IsUnique();

        modelBuilder.Entity<OrderPayment>()
            .Property(p => p.TransactionReference)
            .HasMaxLength(450);

        modelBuilder.Entity<OrderPayment>()
            .HasIndex(p => p.TransactionReference)
            .IsUnique()
            .HasFilter("[TransactionReference] IS NOT NULL");

        // Global Soft Delete Query Filter
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(ISoftDelete).IsAssignableFrom(entityType.ClrType))
            {
                var parameter = Expression.Parameter(entityType.ClrType, "p");
                var property = Expression.Property(parameter, nameof(ISoftDelete.IsDeleted));
                var falseConstant = Expression.Constant(false);
                var filter = Expression.Lambda(Expression.Equal(property, falseConstant), parameter);
                modelBuilder.Entity(entityType.ClrType).HasQueryFilter(filter);
            }
        }

        // ─── Inventory ERP — EF Core Configurations ──────────────────────────────

        // BranchIngredientStock — add concurrency token (additive, existing column stays)
        modelBuilder.Entity<BranchIngredientStock>()
            .Property(e => e.RowVersion)
            .IsRowVersion()
            .IsRequired(false);

        // SubRecipe
        modelBuilder.Entity<SubRecipe>()
            .HasIndex(e => e.Code)
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");

        modelBuilder.Entity<SubRecipeIngredient>()
            .HasOne(e => e.SubRecipe)
            .WithMany(e => e.Ingredients)
            .HasForeignKey(e => e.SubRecipeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SubRecipeIngredient>()
            .HasOne(e => e.Ingredient)
            .WithMany()
            .HasForeignKey(e => e.IngredientId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SubRecipeIngredient>()
            .HasOne(e => e.ChildSubRecipe)
            .WithMany()
            .HasForeignKey(e => e.ChildSubRecipeId)
            .OnDelete(DeleteBehavior.Restrict);

        // BranchSubRecipeStock
        modelBuilder.Entity<BranchSubRecipeStock>()
            .HasIndex(e => new { e.BranchId, e.SubRecipeId })
            .IsUnique();
        modelBuilder.Entity<BranchSubRecipeStock>()
            .Property(e => e.RowVersion)
            .IsRowVersion()
            .IsRequired(false);

        // BranchProductStock
        modelBuilder.Entity<BranchProductStock>()
            .HasIndex(e => new { e.BranchId, e.MenuItemId, e.MenuItemVariantId })
            .IsUnique();
        modelBuilder.Entity<BranchProductStock>()
            .Property(e => e.RowVersion)
            .IsRowVersion()
            .IsRequired(false);

        // InventoryLot — strict type integrity check
        modelBuilder.Entity<InventoryLot>()
            .HasOne(e => e.Ingredient)
            .WithMany()
            .HasForeignKey(e => e.IngredientId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<InventoryLot>()
            .HasOne(e => e.SubRecipe)
            .WithMany()
            .HasForeignKey(e => e.SubRecipeId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<InventoryLot>()
            .HasOne(e => e.MenuItem)
            .WithMany()
            .HasForeignKey(e => e.MenuItemId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<InventoryLot>()
            .ToTable(t => t.HasCheckConstraint("CK_InventoryLot_TypeIntegrity",
                "([LotType] = 1 AND [IngredientId] IS NOT NULL AND [SubRecipeId] IS NULL AND [MenuItemId] IS NULL) OR " +
                "([LotType] = 2 AND [IngredientId] IS NULL AND [SubRecipeId] IS NOT NULL AND [MenuItemId] IS NULL) OR " +
                "([LotType] = 3 AND [IngredientId] IS NULL AND [SubRecipeId] IS NULL AND [MenuItemId] IS NOT NULL)"));
        modelBuilder.Entity<InventoryLot>()
            .ToTable(t => t.HasCheckConstraint("CK_InventoryLot_Balances",
                "[RemainingQuantity] >= 0"));

        // Lot Allocations — self-referencing FK for reversals & restrict cascade paths
        modelBuilder.Entity<IngredientLotAllocation>()
            .HasOne(e => e.InventoryLot)
            .WithMany(l => l.IngredientAllocations)
            .HasForeignKey(e => e.InventoryLotId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<IngredientLotAllocation>()
            .HasOne(e => e.StockTransaction)
            .WithMany()
            .HasForeignKey(e => e.StockTransactionId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<IngredientLotAllocation>()
            .HasOne(e => e.OriginalAllocation)
            .WithMany()
            .HasForeignKey(e => e.OriginalAllocationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SubRecipeLotAllocation>()
            .HasOne(e => e.InventoryLot)
            .WithMany(l => l.SubRecipeAllocations)
            .HasForeignKey(e => e.InventoryLotId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SubRecipeLotAllocation>()
            .HasOne(e => e.SubRecipeStockTransaction)
            .WithMany()
            .HasForeignKey(e => e.SubRecipeStockTransactionId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SubRecipeLotAllocation>()
            .HasOne(e => e.OriginalAllocation)
            .WithMany()
            .HasForeignKey(e => e.OriginalAllocationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ProductLotAllocation>()
            .HasOne(e => e.InventoryLot)
            .WithMany(l => l.ProductAllocations)
            .HasForeignKey(e => e.InventoryLotId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ProductLotAllocation>()
            .HasOne(e => e.ProductStockTransaction)
            .WithMany()
            .HasForeignKey(e => e.ProductStockTransactionId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ProductLotAllocation>()
            .HasOne(e => e.OriginalAllocation)
            .WithMany()
            .HasForeignKey(e => e.OriginalAllocationId)
            .OnDelete(DeleteBehavior.Restrict);

        // Production Batch relationships
        modelBuilder.Entity<ProductionBatchIngredient>()
            .HasOne(e => e.ProductionBatch)
            .WithMany(b => b.ConsumedIngredients)
            .HasForeignKey(e => e.ProductionBatchId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProductionBatchIngredient>()
            .HasOne(e => e.Ingredient)
            .WithMany()
            .HasForeignKey(e => e.IngredientId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ProductionBatchSubRecipe>()
            .HasOne(e => e.ProductionBatch)
            .WithMany(b => b.ConsumedSubRecipes)
            .HasForeignKey(e => e.ProductionBatchId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProductionBatchSubRecipe>()
            .HasOne(e => e.SubRecipe)
            .WithMany()
            .HasForeignKey(e => e.SubRecipeId)
            .OnDelete(DeleteBehavior.Restrict);

        // Equipment Reservoir Transactions
        modelBuilder.Entity<EquipmentReservoirTransaction>()
            .HasOne(e => e.EquipmentReservoir)
            .WithMany(r => r.Transactions)
            .HasForeignKey(e => e.EquipmentReservoirId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EquipmentReservoirTransaction>()
            .HasOne(e => e.SourceInventoryLot)
            .WithMany()
            .HasForeignKey(e => e.SourceInventoryLotId)
            .OnDelete(DeleteBehavior.Restrict);

        // ProductionBatch
        modelBuilder.Entity<ProductionBatch>()
            .HasIndex(e => e.BatchNumber)
            .IsUnique();
        modelBuilder.Entity<ProductionBatch>()
            .HasIndex(e => e.IdempotencyKey)
            .IsUnique()
            .HasFilter("[IdempotencyKey] IS NOT NULL");
        modelBuilder.Entity<ProductionBatch>()
            .Property(e => e.RowVersion)
            .IsRowVersion()
            .IsRequired(false);
        modelBuilder.Entity<ProductionBatch>()
            .HasOne(e => e.SubRecipe)
            .WithMany()
            .HasForeignKey(e => e.SubRecipeId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ProductionBatch>()
            .HasOne(e => e.MenuItem)
            .WithMany()
            .HasForeignKey(e => e.MenuItemId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ProductionBatch>()
            .ToTable(t => t.HasCheckConstraint("CK_ProductionBatch_Target",
                "([TargetType] = 1 AND [SubRecipeId] IS NOT NULL AND [MenuItemId] IS NULL) OR " +
                "([TargetType] = 2 AND [SubRecipeId] IS NULL AND [MenuItemId] IS NOT NULL)"));

        // ProductionBatchCostSnapshot — self-referencing for correction chain
        modelBuilder.Entity<ProductionBatchCostSnapshot>()
            .HasOne(e => e.CorrectionOfSnapshot)
            .WithMany()
            .HasForeignKey(e => e.CorrectionOfSnapshotId)
            .OnDelete(DeleteBehavior.Restrict);

        // EquipmentReservoir
        modelBuilder.Entity<EquipmentReservoir>()
            .Property(e => e.RowVersion)
            .IsRowVersion()
            .IsRequired(false);
        modelBuilder.Entity<EquipmentReservoir>()
            .ToTable(t => t.HasCheckConstraint("CK_EquipmentReservoir_Capacity",
                "[CurrentFluidQuantity] >= 0 AND [CurrentFluidQuantity] <= [MaxCapacity]"));

        // IngredientUomConversion — unique per ingredient/from-unit/to-unit combination
        modelBuilder.Entity<IngredientUomConversion>()
            .HasIndex(e => new { e.IngredientId, e.FromUnit, e.ToBaseUnit })
            .IsUnique();
        modelBuilder.Entity<IngredientUomConversion>()
            .ToTable(t => t.HasCheckConstraint("CK_UomConversion_PositiveMultiplier",
                "[Multiplier] > 0"));

        // ─── Table Reservations ───────────────────────────────────────────────
        modelBuilder.Entity<TableReservation>()
            .HasIndex(r => r.ReferenceCode)
            .IsUnique();
        modelBuilder.Entity<TableReservation>()
            .HasIndex(r => new { r.BranchId, r.ReservationDateUtc, r.Status });
        modelBuilder.Entity<TableReservation>()
            .HasOne(r => r.Branch)
            .WithMany()
            .HasForeignKey(r => r.BranchId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<TableReservation>()
            .HasOne(r => r.CustomerUser)
            .WithMany()
            .HasForeignKey(r => r.CustomerUserId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<TableReservation>()
            .Property(r => r.ReferenceCode)
            .HasMaxLength(40);
        modelBuilder.Entity<TableReservation>()
            .Property(r => r.CustomerName)
            .HasMaxLength(120);
        modelBuilder.Entity<TableReservation>()
            .Property(r => r.CustomerPhone)
            .HasMaxLength(30);

        // ─── Cash Shifts ──────────────────────────────────────────────────────
        modelBuilder.Entity<CashShift>()
            .HasIndex(s => s.ShiftReferenceNumber)
            .IsUnique();
        modelBuilder.Entity<CashShift>()
            .HasIndex(s => new { s.BranchId, s.Status, s.OpenedAtUtc });
        modelBuilder.Entity<CashShift>()
            .HasOne(s => s.Branch)
            .WithMany()
            .HasForeignKey(s => s.BranchId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<CashShift>()
            .HasOne(s => s.CashierUser)
            .WithMany()
            .HasForeignKey(s => s.CashierUserId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<CashShift>()
            .Property(s => s.OpeningFloat).HasPrecision(18, 2);
        modelBuilder.Entity<CashShift>()
            .Property(s => s.TotalCashSales).HasPrecision(18, 2);
        modelBuilder.Entity<CashShift>()
            .Property(s => s.TotalCardSales).HasPrecision(18, 2);
        modelBuilder.Entity<CashShift>()
            .Property(s => s.TotalMfsSales).HasPrecision(18, 2);
        modelBuilder.Entity<CashShift>()
            .Property(s => s.CashDropAmount).HasPrecision(18, 2);
        modelBuilder.Entity<CashShift>()
            .Property(s => s.ExpectedCashInDrawer).HasPrecision(18, 2);
        modelBuilder.Entity<CashShift>()
            .Property(s => s.ActualCashCounted).HasPrecision(18, 2);
        modelBuilder.Entity<CashShift>()
            .Property(s => s.VarianceOverShort).HasPrecision(18, 2);
    }
}
