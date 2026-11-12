using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Bakery;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public class CakeOrderService
{
    private readonly IApplicationDbContext _context;
    private readonly PromotionEngineService _promotionEngine;

    public CakeOrderService(IApplicationDbContext context, PromotionEngineService? promotionEngine = null)
    {
        _context = context;
        _promotionEngine = promotionEngine ?? new PromotionEngineService(context);
    }

    public async Task<Result<CustomCakePriceQuoteDto>> QuoteCustomCakeAsync(QuoteCustomCakeRequestDto request)
    {
        var pricing = await CalculateCakePriceAsync(
            request.BranchId,
            request.MenuItemId,
            request.WeightKg,
            request.CouponCode,
            reserveRedemption: false);
        return pricing.Error is null
            ? Result<CustomCakePriceQuoteDto>.Success(pricing.Quote!)
            : Result<CustomCakePriceQuoteDto>.Failure(pricing.Error);
    }

    public async Task<Result<CakeCustomOrderResponseDto>> CreateCakeRequestAsync(CreateCustomCakeRequestDto request)
    {
        var branch = await _context.Branches.FirstOrDefaultAsync(candidate =>
            candidate.Id == request.BranchId && candidate.IsActive && !candidate.IsDeleted);
        if (branch is null) return Result<CakeCustomOrderResponseDto>.Failure("Branch not found or inactive.");
        if (string.IsNullOrWhiteSpace(request.CustomerName) ||
            string.IsNullOrWhiteSpace(request.CustomerPhone) ||
            request.DeliveryDate.Date < DateTime.UtcNow.Date)
        {
            return Result<CakeCustomOrderResponseDto>.Failure("Customer details and a valid future delivery date are required.");
        }

        var pricing = await CalculateCakePriceAsync(
            request.BranchId,
            request.MenuItemId,
            request.WeightKg,
            request.CouponCode,
            reserveRedemption: true);
        if (pricing.Error is not null) return Result<CakeCustomOrderResponseDto>.Failure(pricing.Error);

        string datePart = DateTime.UtcNow.ToString("yyyyMMdd");
        int countToday = await _context.CakeCustomOrders.CountAsync(c => c.BranchId == request.BranchId && c.CreatedAtUtc.Date == DateTime.UtcNow.Date);
        string customNumber = $"CAKE-{branch.BranchCode}-{datePart}-{(countToday + 1):D3}";

        var cakeOrder = new CakeCustomOrder
        {
            BranchId = request.BranchId,
            CustomOrderNumber = customNumber,
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            DeliveryAddress = request.DeliveryAddress,
            WeightKg = request.WeightKg,
            Flavor = request.Flavor,
            CreamType = request.CreamType,
            TierCount = request.TierCount,
            ColorTheme = request.ColorTheme,
            MessageOnCake = request.MessageOnCake,
            ReferenceImageUrl = request.ReferenceImageUrl,
            DeliveryDate = request.DeliveryDate,
            DeliveryTimeSlot = request.DeliveryTimeSlot,
            MenuItemId = pricing.Quote!.MenuItemId,
            SubTotal = pricing.Quote.SubTotal,
            DiscountAmount = pricing.Quote.DiscountAmount,
            EstimatedPrice = pricing.Quote.EstimatedPrice,
            PromotionCampaignId = pricing.Campaign?.Id,
            PromotionCampaignName = pricing.Campaign?.Name,
            Status = CakeOrderStatus.QuoteApproved
        };

        _context.CakeCustomOrders.Add(cakeOrder);
        await _context.SaveChangesAsync();

        return Result<CakeCustomOrderResponseDto>.Success(MapToDto(cakeOrder, branch.Name));
    }

    private async Task<(CustomCakePriceQuoteDto? Quote, KabirKitchen.Domain.Entities.Promotions.PromotionCampaign? Campaign, string? Error)> CalculateCakePriceAsync(
        long branchId,
        long menuItemId,
        decimal weightKg,
        string? couponCode,
        bool reserveRedemption)
    {
        if (branchId <= 0 || menuItemId <= 0 || weightKg is <= 0 or > 100)
            return (null, null, "Select a valid branch and custom cake with a weight between 0.5 and 100 kg (up to ~220 lb).");

        var branch = await _context.Branches.FirstOrDefaultAsync(candidate =>
            candidate.Id == branchId && candidate.IsActive && !candidate.IsDeleted);
        if (branch is null) return (null, null, "Selected branch does not exist or is inactive.");

        var menuItem = await _context.MenuItems
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == menuItemId && item.IsActive && item.IsCustomCake);
        if (menuItem is null) return (null, null, "Selected product is not an available custom cake.");

        var branchOverride = await _context.BranchMenuItemOverrides
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.BranchId == branchId && item.MenuItemId == menuItemId);
        if (branchOverride is { IsAvailableInBranch: false } or { IsSoldOutToday: true })
            return (null, null, "Selected custom cake is unavailable at this branch.");

        var ratePerKg = branchOverride?.CustomPrice ?? menuItem.BasePrice;
        var subTotal = decimal.Round(ratePerKg * weightKg, 2, MidpointRounding.AwayFromZero);
        var promotion = await _promotionEngine.CalculateOrderDiscountAsync(
            branchId,
            subTotal,
            [new PromotionLine(menuItem.Id, null, menuItem.CategoryId, 1, subTotal, IsCustomCake: true)],
            couponCode,
            reserveRedemption: reserveRedemption);
        if (promotion.Error is not null) return (null, null, promotion.Error);

        var finalPrice = Math.Max(0m, subTotal - promotion.Discount);
        var quote = new CustomCakePriceQuoteDto(
            branchId,
            menuItem.Id,
            weightKg,
            subTotal,
            promotion.Discount,
            finalPrice,
            decimal.Round(finalPrice * 0.50m, 2, MidpointRounding.AwayFromZero),
            promotion.Campaign?.Name,
            promotion.Campaign?.EndDateUtc);
        return (quote, promotion.Campaign, null);
    }

    /// <summary>
    /// Strict Backend Rule: Advance payment verified না হলে production status InBaking করা যাবে না।
    /// </summary>
    public async Task<Result> VerifyAdvancePaymentAsync(VerifyCakeAdvancePaymentDto dto)
    {
        var cake = await _context.CakeCustomOrders.FindAsync(dto.CakeCustomOrderId);
        if (cake == null) return Result.Failure("Cake order not found.");
        if (dto.AdvanceAmountPaid <= 0 || string.IsNullOrWhiteSpace(dto.PaymentTransactionRef) ||
            string.IsNullOrWhiteSpace(dto.VerifiedByStaffName))
            return Result.Failure("A positive payment amount, transaction reference, and verifying staff name are required.");
        if (cake.IsAdvanceVerified)
            return Result.Failure("The required 50% advance has already been verified.");

        cake.AdvancePaidAmount += dto.AdvanceAmountPaid;
        cake.AdvancePaymentTransactionRef = dto.PaymentTransactionRef;

        if (cake.AdvancePaidAmount >= cake.AdvanceRequiredAmount)
        {
            cake.IsAdvanceVerified = true;
            cake.Status = CakeOrderStatus.AdvancePaid;
        }

        cake.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Result.Success();
    }

    public Task<long?> GetBranchIdAsync(long cakeOrderId) =>
        _context.CakeCustomOrders
            .Where(cake => cake.Id == cakeOrderId)
            .Select(cake => (long?)cake.BranchId)
            .FirstOrDefaultAsync();

    /// <summary>
    /// Moves status to InBaking with strict verification.
    /// </summary>
    public async Task<Result> StartBakingAsync(long cakeOrderId)
    {
        var cake = await _context.CakeCustomOrders.FindAsync(cakeOrderId);
        if (cake == null) return Result.Failure("Cake order not found.");

        // STRICT BUSINESS ENFORCEMENT: Backend rule!
        if (!cake.IsAdvanceVerified || cake.AdvancePaidAmount < cake.AdvanceRequiredAmount)
        {
            return Result.Failure("Cannot start baking: 50% advance payment is not verified!");
        }

        cake.Status = CakeOrderStatus.InBaking;
        cake.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Result.Success();
    }

    /// <summary>
    /// Returns the pre-order cake calendar for a specific date with slot occupancy.
    /// </summary>
    public async Task<List<CakeProductionCalendarSlotDto>> GetProductionCalendarAsync(long branchId, DateTime date)
    {
        var cakes = await _context.CakeCustomOrders
            .Where(c => c.BranchId == branchId && c.DeliveryDate.Date == date.Date && c.Status != CakeOrderStatus.Cancelled)
            .ToListAsync();

        var slots = new[]
        {
            "10:00 AM - 12:00 PM",
            "01:00 PM - 03:00 PM",
            "04:00 PM - 06:00 PM",
            "07:00 PM - 09:00 PM"
        };

        const int maxCapacityPerSlot = 5;

        return slots.Select(slot =>
        {
            var matching = cakes.Where(c => c.DeliveryTimeSlot == slot).ToList();
            return new CakeProductionCalendarSlotDto(
                date.Date,
                slot,
                matching.Count,
                maxCapacityPerSlot,
                matching.Count >= maxCapacityPerSlot,
                matching.Select(m => $"{m.WeightKg}kg {m.Flavor} for {m.CustomerName}").ToList()
            );
        }).ToList();
    }

    /// <summary>
    /// Aggregated BOM production planning for all cakes scheduled on a target date.
    /// </summary>
    public async Task<BakeryAggregatedBOMPlanDto> GetAggregatedBOMPlanAsync(long branchId, DateTime targetDate)
    {
        var cakes = await _context.CakeCustomOrders
            .Where(c => c.BranchId == branchId && c.DeliveryDate.Date == targetDate.Date && c.Status != CakeOrderStatus.Cancelled)
            .ToListAsync();

        // Standard benchmark per 1kg cake:
        // Flour: 300g, Sugar: 250g, Egg: 6 pcs, Butter: 200g, Cream: 200ml, Chocolate: 150g
        decimal totalWeightKg = cakes.Sum(c => c.WeightKg);

        var ingredientsNeeded = new List<AggregatedIngredientRequirementDto>
        {
            new("All-Purpose Flour", Math.Round(totalWeightKg * 0.300m, 2), UnitType.Kilogram, 0, false),
            new("Refined White Sugar", Math.Round(totalWeightKg * 0.250m, 2), UnitType.Kilogram, 0, false),
            new("Farm Fresh Eggs", Math.Round(totalWeightKg * 6.0m, 0), UnitType.Piece, 0, false),
            new("Unsalted Butter", Math.Round(totalWeightKg * 0.200m, 2), UnitType.Kilogram, 0, false),
            new("Heavy Whipping Cream", Math.Round(totalWeightKg * 0.200m, 2), UnitType.Liter, 0, false),
            new("Dark Chocolate Compound", Math.Round(totalWeightKg * 0.150m, 2), UnitType.Kilogram, 0, false)
        };

        var branchStocks = await _context.BranchIngredientStocks
            .Include(s => s.Ingredient)
            .Where(s => s.BranchId == branchId)
            .ToListAsync();

        var finalRequirements = ingredientsNeeded.Select(req =>
        {
            var stock = branchStocks.FirstOrDefault(s => s.Ingredient != null && s.Ingredient.Name.Contains(req.IngredientName, StringComparison.OrdinalIgnoreCase));
            decimal available = stock?.AvailableQuantity ?? 0;
            return req with
            {
                CurrentStockOnBranch = available,
                IsStockSufficient = available >= req.TotalQuantityNeeded
            };
        }).ToList();

        return new BakeryAggregatedBOMPlanDto(targetDate.Date, cakes.Count, finalRequirements);
    }

    public async Task<List<CakeCustomOrderResponseDto>> GetCakeOrdersAsync(long? branchId, string? search)
    {
        var query = _context.CakeCustomOrders
            .Include(c => c.Branch)
            .AsNoTracking()
            .Where(c => !c.IsDeleted);

        if (branchId.HasValue && branchId.Value > 0)
        {
            query = query.Where(c => c.BranchId == branchId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c =>
                c.CustomOrderNumber.ToLower().Contains(s) ||
                c.CustomerName.ToLower().Contains(s) ||
                c.CustomerPhone.Contains(s));
        }

        var list = await query
            .OrderByDescending(c => c.CreatedAtUtc)
            .Take(100)
            .ToListAsync();

        return list.Select(c => MapToDto(c, c.Branch?.Name ?? "Kabir's Kitchen")).ToList();
    }

    public async Task<Result<CakeCustomOrderResponseDto>> ApplySpecialDiscountAsync(long cakeOrderId, decimal discountAmount, string? reason, string adminName)
    {
        var cake = await _context.CakeCustomOrders.FindAsync(cakeOrderId);
        if (cake == null) return Result<CakeCustomOrderResponseDto>.Failure("Cake order not found.");
        if (discountAmount <= 0) return Result<CakeCustomOrderResponseDto>.Failure("Discount amount must be greater than zero.");
        if (discountAmount > cake.EstimatedPrice) return Result<CakeCustomOrderResponseDto>.Failure("Discount cannot exceed total cake price.");

        cake.DiscountAmount += discountAmount;
        cake.EstimatedPrice = Math.Max(0m, cake.SubTotal - cake.DiscountAmount);
        string admin = string.IsNullOrWhiteSpace(adminName) ? "Admin" : adminName.Trim();
        string note = string.IsNullOrWhiteSpace(reason) ? "VIP Special Courtesy" : reason.Trim();
        cake.BakerNotes = string.IsNullOrWhiteSpace(cake.BakerNotes)
            ? $"Admin Discount: -৳{discountAmount} by {admin} ({note})"
            : $"{cake.BakerNotes} | Admin Discount: -৳{discountAmount} by {admin} ({note})";

        cake.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var branch = await _context.Branches.FindAsync(cake.BranchId);
        return Result<CakeCustomOrderResponseDto>.Success(MapToDto(cake, branch?.Name ?? "Kabir's Kitchen"));
    }

    private CakeCustomOrderResponseDto MapToDto(CakeCustomOrder c, string branchName)
    {
        return new CakeCustomOrderResponseDto(
            c.Id,
            c.BranchId,
            branchName,
            c.CustomOrderNumber,
            c.CustomerName,
            c.CustomerPhone,
            c.WeightKg,
            c.Flavor,
            c.CreamType,
            c.MessageOnCake,
            c.ReferenceImageUrl,
            c.DeliveryDate,
            c.DeliveryTimeSlot,
            c.MenuItemId,
            c.SubTotal,
            c.DiscountAmount,
            c.EstimatedPrice,
            c.PromotionCampaignId,
            c.PromotionCampaignName,
            c.AdvanceRequiredAmount,
            c.AdvancePaidAmount,
            c.IsAdvanceVerified,
            c.Status
        );
    }
}
