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
    }
}
