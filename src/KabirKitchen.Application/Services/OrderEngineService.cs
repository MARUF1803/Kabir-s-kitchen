using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Application.DTOs;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Kitchen;
using KabirKitchen.Domain.Entities.Orders;
using KabirKitchen.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Application.Services;

public class OrderEngineService
{
    private readonly IApplicationDbContext _context;
    private readonly RecipeCostingService _costingService;
    private readonly InventoryEngineService _inventoryEngine;
    private readonly PromotionEngineService _promotionEngine;

    public OrderEngineService(
        IApplicationDbContext context,
        RecipeCostingService costingService,
        InventoryEngineService inventoryEngine,
        PromotionEngineService? promotionEngine = null)
    {
        _context = context;
        _costingService = costingService;
        _inventoryEngine = inventoryEngine;
        _promotionEngine = promotionEngine ?? new PromotionEngineService(context);
    }

    public async Task<Result<PromotionQuoteDto>> QuoteOrderAsync(PromotionQuoteRequest request)
    {
        if (request.BranchId <= 0 || !Enum.IsDefined(request.OrderType) ||
            request.Items is null || request.Items.Count == 0)
        {
            return Result<PromotionQuoteDto>.Failure("A branch, order type, and at least one item are required.");
        }

        var branchExists = await _context.Branches.AnyAsync(branch =>
            branch.Id == request.BranchId && branch.IsActive && !branch.IsDeleted);
        if (!branchExists)
        {
            return Result<PromotionQuoteDto>.Failure("Selected branch does not exist or is inactive.");
        }

        decimal subTotal = 0m;
        var promotionLines = new List<PromotionLine>();
        var quoteItems = new List<PromotionQuoteItemDto>();
        foreach (var item in request.Items)
        {
            if (item.MenuItemId <= 0 || item.Quantity <= 0)
            {
                return Result<PromotionQuoteDto>.Failure("Each item must have a valid menu item and positive quantity.");
            }

            var menuItem = await _context.MenuItems
                .Include(menu => menu.Variants)
                .FirstOrDefaultAsync(menu => menu.Id == item.MenuItemId && menu.IsActive);
            if (menuItem is null)
            {
                return Result<PromotionQuoteDto>.Failure($"Menu item ID {item.MenuItemId} not found or inactive.");
            }

            var branchOverride = await _context.BranchMenuItemOverrides
                .AsNoTracking()
                .FirstOrDefaultAsync(value => value.BranchId == request.BranchId && value.MenuItemId == item.MenuItemId);
            if (branchOverride is { IsAvailableInBranch: false } or { IsSoldOutToday: true })
            {
                return Result<PromotionQuoteDto>.Failure($"{menuItem.Name} is unavailable at the selected branch.");
            }

            var unitPrice = branchOverride?.CustomPrice ?? menuItem.BasePrice;
            string? variantName = null;
            if (item.MenuItemVariantId.HasValue)
            {
                var variant = menuItem.Variants.FirstOrDefault(value => value.Id == item.MenuItemVariantId.Value);
                if (variant is null)
                {
                    return Result<PromotionQuoteDto>.Failure($"Selected variant is not available for {menuItem.Name}.");
                }
                unitPrice += variant.AdditionalPrice;
                variantName = variant.VariantName;
            }

            var requestedAddOnIds = item.SelectedAddOnIds?.Distinct().ToArray() ?? [];
            List<AddOn> addOns = requestedAddOnIds.Length == 0
                ? []
                : await _context.MenuItemAddOns
                    .AsNoTracking()
                    .Where(link => link.MenuItemId == item.MenuItemId &&
                        requestedAddOnIds.Contains(link.AddOnId) &&
                        link.AddOn != null && link.AddOn.IsActive)
                    .Select(link => link.AddOn!)
                    .ToListAsync();
            if (addOns.Count != requestedAddOnIds.Length)
            {
                return Result<PromotionQuoteDto>.Failure($"One or more selected add-ons for {menuItem.Name} are unavailable.");
            }

            var addOnsUnitPrice = addOns.Sum(addOn => addOn.Price);
            var lineTotal = (unitPrice + addOnsUnitPrice) * item.Quantity;
            subTotal += lineTotal;
            promotionLines.Add(new PromotionLine(
                menuItem.Id,
                item.MenuItemVariantId,
                menuItem.CategoryId,
                item.Quantity,
                unitPrice,
                menuItem.IsCustomCake));
            quoteItems.Add(new PromotionQuoteItemDto(
                menuItem.Id,
                item.MenuItemVariantId,
                variantName is null ? menuItem.Name : $"{menuItem.Name} ({variantName})",
                item.Quantity,
                unitPrice,
                addOnsUnitPrice,
                lineTotal));
        }

        var promotion = await _promotionEngine.CalculateOrderDiscountAsync(
            request.BranchId,
            subTotal,
            promotionLines,
            request.CouponCode,
            reserveRedemption: false);
        if (promotion.Error is not null)
        {
            return Result<PromotionQuoteDto>.Failure(promotion.Error);
        }

        var taxableBase = Math.Max(0m, subTotal - promotion.Discount);
        var taxAmount = Math.Round(taxableBase * 0.05m, 2);
        var deliveryFee = request.OrderType == OrderType.Delivery ? 60m : 0m;
        var totalAmount = Math.Round(taxableBase + taxAmount + deliveryFee, 2);
        return Result<PromotionQuoteDto>.Success(new PromotionQuoteDto(
            request.BranchId,
            request.OrderType,
            promotion.Campaign?.Name,
            subTotal,
            promotion.Discount,
            taxAmount,
            deliveryFee,
            totalAmount,
            DateTime.UtcNow,
            promotion.Campaign?.EndDateUtc,
            quoteItems));
    }

    /// <summary>
    /// Creates a new order through the single unified order engine.
    /// Used by Web Storefront, Counter POS, and Table Dine-in QR.
    /// <summary>
    /// Creates a new order through the single unified order engine.
    /// Used by Web Storefront, Counter POS, and Table Dine-in QR.
    /// Strictly calculates and validates all pricing, tax, discounts, and payments on server.
    /// </summary>
    public async Task<Result<OrderResponseDto>> CreateOrderAsync(CreateOrderRequestDto request, long? customerUserId = null)
    {
        var branch = await _context.Branches.FindAsync(request.BranchId);
        if (branch == null || !branch.IsActive || branch.IsDeleted)
            return Result<OrderResponseDto>.Failure("Selected branch does not exist or is inactive.");

        // 1. Idempotency Check: prevent double orders
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existingOrder = await _context.Orders
                .Include(o => o.Branch)
                .Include(o => o.Items).ThenInclude(i => i.AddOns)
                .Include(o => o.Payments)
                .Include(o => o.DiningTable)
                .FirstOrDefaultAsync(o => o.IdempotencyKey == request.IdempotencyKey);

            if (existingOrder != null)
            {
                return Result<OrderResponseDto>.Success(MapToResponse(existingOrder, existingOrder.Branch?.Name ?? branch.Name));
            }
        }

        // 2. Generate Sequence Numbers: KK-{BRANCH_CODE}-{TIMESTAMP}-{COUNT} & INV-{...}
        string datePart = DateTime.UtcNow.ToString("yyyyMMdd");
        int countToday = await _context.Orders.CountAsync(o => o.BranchId == request.BranchId && o.CreatedAtUtc.Date == DateTime.UtcNow.Date);
        string sequenceFormatted = (countToday + 1).ToString("D4");
        string orderNumber = $"KK-{branch.BranchCode}-{datePart}-{sequenceFormatted}";
        string invoiceNumber = $"INV-{branch.BranchCode}-{datePart}-{sequenceFormatted}";

        // 3. Process Line Items and Calculate Strict Pricing
        if (request.Items == null || !request.Items.Any())
            return Result<OrderResponseDto>.Failure("Order must contain at least one item.");

        decimal subTotal = 0;
        decimal totalOrderBOMCost = 0;
        var orderItems = new List<OrderItem>();
        var promotionLines = new List<PromotionLine>();

        foreach (var itemDto in request.Items)
        {
            if (itemDto.Quantity <= 0)
                return Result<OrderResponseDto>.Failure("Item quantity must be greater than zero.");

            var menuItem = await _context.MenuItems
                .Include(m => m.Variants)
                .FirstOrDefaultAsync(m => m.Id == itemDto.MenuItemId);

            if (menuItem == null || !menuItem.IsActive)
                return Result<OrderResponseDto>.Failure($"Menu item ID {itemDto.MenuItemId} not found or inactive.");

            // Branch Override first, else Global BasePrice
            var branchOverride = await _context.BranchMenuItemOverrides
                .FirstOrDefaultAsync(b => b.BranchId == request.BranchId && b.MenuItemId == itemDto.MenuItemId);
            if (branchOverride is { IsAvailableInBranch: false } or { IsSoldOutToday: true })
                return Result<OrderResponseDto>.Failure($"{menuItem.Name} is unavailable at the selected branch.");

            decimal effectivePrice = branchOverride?.CustomPrice ?? menuItem.BasePrice;

            string? variantName = null;
            if (itemDto.MenuItemVariantId.HasValue)
            {
                var variant = menuItem.Variants.FirstOrDefault(v => v.Id == itemDto.MenuItemVariantId.Value);
                if (variant is null)
                    return Result<OrderResponseDto>.Failure($"Variant ID {itemDto.MenuItemVariantId.Value} is not available for {menuItem.Name}.");
                effectivePrice += variant.AdditionalPrice;
                variantName = variant.VariantName;
            }

            // Recipe BOM Cost Snapshot
            var recipe = await _context.Recipes
                .Include(r => r.Ingredients)
                    .ThenInclude(ri => ri.Ingredient)
                .FirstOrDefaultAsync(r => r.MenuItemId == itemDto.MenuItemId && r.MenuItemVariantId == itemDto.MenuItemVariantId);

            decimal unitBOMCost = recipe != null ? _costingService.CalculateRecipeCost(recipe) : 0;

            var orderItem = new OrderItem
            {
                MenuItemId = itemDto.MenuItemId,
                MenuItemVariantId = itemDto.MenuItemVariantId,
                ItemName = menuItem.Name,
                UnitPrice = effectivePrice,
                Quantity = itemDto.Quantity,
                UnitBOMCostAtSale = unitBOMCost,
                SpecialInstructions = itemDto.SpecialInstructions
            };

            // Add-ons calculation
            decimal addonsTotalPerUnit = 0;
            if (itemDto.SelectedAddOnIds != null && itemDto.SelectedAddOnIds.Any())
            {
                var requestedAddOnIds = itemDto.SelectedAddOnIds.Distinct().ToArray();
                var addOns = await _context.MenuItemAddOns
                    .Where(link => link.MenuItemId == itemDto.MenuItemId &&
                        requestedAddOnIds.Contains(link.AddOnId) &&
                        link.AddOn != null && link.AddOn.IsActive)
                    .Select(link => link.AddOn!)
                    .ToListAsync();
                if (addOns.Count != requestedAddOnIds.Length)
                    return Result<OrderResponseDto>.Failure($"One or more selected add-ons for {menuItem.Name} are unavailable.");

                foreach (var addon in addOns)
                {
                    orderItem.AddOns.Add(new OrderItemAddOn
                    {
                        AddOnId = addon.Id,
                        AddOnName = addon.Name,
                        UnitPrice = addon.Price,
                        Quantity = 1
                    });
                    addonsTotalPerUnit += addon.Price;
                }
            }

            decimal totalUnitItemPrice = effectivePrice + addonsTotalPerUnit;
            subTotal += (totalUnitItemPrice * itemDto.Quantity);
            promotionLines.Add(new PromotionLine(
                menuItem.Id,
                itemDto.MenuItemVariantId,
                menuItem.CategoryId,
                itemDto.Quantity,
                effectivePrice,
                menuItem.IsCustomCake));
            totalOrderBOMCost += (unitBOMCost * itemDto.Quantity);
            orderItems.Add(orderItem);
        }

        // 4. Financial Calculations: Discount, 5% Tax (VAT), Delivery Fee, Service Charge
        var promotion = await _promotionEngine.CalculateOrderDiscountAsync(
            request.BranchId, subTotal, promotionLines, request.CouponCode);
        if (promotion.Error is not null)
            return Result<OrderResponseDto>.Failure(promotion.Error);

        decimal discountAmount = promotion.Discount;

        decimal taxableBase = Math.Max(0, subTotal - discountAmount);
        decimal taxAmount = Math.Round(taxableBase * 0.05m, 2); // Standard Bangladesh 5% Restaurant VAT
        decimal deliveryFee = request.OrderType == OrderType.Delivery ? 60m : 0m;
        decimal serviceCharge = request.OrderType == OrderType.DineIn ? 0m : 0m; // Configurable if needed

        decimal grandTotal = Math.Round(taxableBase + taxAmount + serviceCharge + deliveryFee, 2);

        var order = new Order
        {
            BranchId = request.BranchId,
            OrderNumber = orderNumber,
            InvoiceNumber = invoiceNumber,
            IdempotencyKey = request.IdempotencyKey,
            OrderType = request.OrderType,
            Status = OrderStatus.Pending,
            PaymentStatus = PaymentStatus.Pending,
            CustomerUserId = customerUserId,
            CustomerName = string.IsNullOrWhiteSpace(request.CustomerName) ? "Walk-in Guest" : request.CustomerName.Trim(),
            CustomerPhone = string.IsNullOrWhiteSpace(request.CustomerPhone) ? "N/A" : request.CustomerPhone.Trim(),
            DeliveryAddress = request.DeliveryAddress,
            DiningTableId = request.DiningTableId,
            CashierUserId = request.CashierUserId,
            CashierStaffName = request.CashierStaffName,
            CustomerNotes = request.CustomerNotes,
            SubTotal = subTotal,
            DiscountAmount = discountAmount,
            PromotionCampaignId = promotion.Campaign?.Id,
            PromotionCampaignName = promotion.Campaign?.Name,
            TaxAmount = taxAmount,
            ServiceCharge = serviceCharge,
            DeliveryFee = deliveryFee,
            TotalAmount = grandTotal,
            PaidAmount = 0m,
            TotalIngredientBOMCost = totalOrderBOMCost,
            PackagingCost = request.OrderType == OrderType.Delivery ? 40m : 0m,
            DeliveryCost = request.OrderType == OrderType.Delivery ? 60m : 0m,
            ScheduledDeliveryTimeUtc = request.ScheduledDeliveryTimeUtc,
            Items = orderItems
        };

        // 5. Process Initial Payments (e.g. Counter Cash/Card/bKash/Split)
        if (request.InitialPayments != null && request.InitialPayments.Any())
        {
            decimal totalPaid = 0;
            foreach (var paymentDto in request.InitialPayments)
            {
                if (!Enum.IsDefined(paymentDto.Method))
                    return Result<OrderResponseDto>.Failure("Payment method is invalid.");
                if (paymentDto.Amount > 0)
                {
                    if (!string.IsNullOrWhiteSpace(paymentDto.TransactionReference) &&
                        order.Payments.Any(payment => payment.TransactionReference == paymentDto.TransactionReference))
                        return Result<OrderResponseDto>.Failure("A payment transaction reference is duplicated.");
                    totalPaid += paymentDto.Amount;
                    order.Payments.Add(new OrderPayment
                    {
                        BranchId = request.BranchId,
                        Amount = paymentDto.Amount,
                        Method = paymentDto.Method,
                        Status = PaymentStatus.Paid,
                        TransactionReference = paymentDto.TransactionReference,
                        ReceivedByStaffName = paymentDto.ReceivedByStaffName ?? request.CashierStaffName,
                        PaymentDateUtc = DateTime.UtcNow
                    });
                }
            }

            order.PaidAmount = totalPaid;
            if (order.PaidAmount >= order.TotalAmount)
            {
                order.PaymentStatus = PaymentStatus.Paid;
            }
            else if (order.PaidAmount > 0)
            {
                order.PaymentStatus = PaymentStatus.PartiallyPaid;
            }
        }

        _context.Orders.Add(order);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result<OrderResponseDto>.Failure("The promotion reached its usage limit while this order was being placed. Please retry.");
        }

        // Automatically create a KDS ticket
        var ticket = new KitchenTicket
        {
            OrderId = order.Id,
            BranchId = order.BranchId,
            TicketNumber = $"KDS-{(countToday + 1):D3}",
            Status = OrderStatus.Pending,
            PriorityLevel = request.OrderType == OrderType.DineIn ? 2 : 1
        };
        _context.KitchenTickets.Add(ticket);
        await _context.SaveChangesAsync();

        return Result<OrderResponseDto>.Success(MapToResponse(order, branch.Name));
    }

    /// <summary>
    /// Builds the complete professional Invoice representation for printing and PDF generation.
    /// </summary>
    public async Task<Result<InvoiceDto>> GetOrderInvoiceAsync(long orderId)
    {
        var order = await _context.Orders
            .Include(o => o.Branch)
            .Include(o => o.DiningTable)
            .Include(o => o.Payments)
            .Include(o => o.Items).ThenInclude(i => i.AddOns)
            .Include(o => o.Items).ThenInclude(i => i.MenuItemVariant)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) return Result<InvoiceDto>.Failure("Order not found.");

        var branch = order.Branch;
        var restaurantInfo = new InvoiceRestaurantInfo(
            BrandName: "Kabir's Kitchen",
            Slogan: "Artisanal Dining & Cake Boutique",
            BinNumber: "BIN-00348912-2026",
            TradeLicense: "TRAD/DNCC/2026/01492",
            Helpline: "+880 1791 665634",
            Email: "support@kabirskitchen.com",
            Website: "https://kabirskitchen.com",
            BranchName: branch?.Name ?? "Main Branch",
            BranchAddress: branch?.Address ?? "Dhaka Cantonment, Dhaka 1206",
            BranchPhone: branch?.ContactPhone ?? "+880 1791 665634"
        );

        var invoiceItems = order.Items.Select(i => new InvoiceItemDto(
            ItemName: i.ItemName,
            VariantName: i.MenuItemVariant?.VariantName,
            AddOns: i.AddOns.Select(a => a.AddOnName).ToList(),
            Quantity: i.Quantity,
            UnitPrice: i.UnitPrice + i.AddOns.Sum(a => a.UnitPrice),
            LineTotal: (i.UnitPrice + i.AddOns.Sum(a => a.UnitPrice)) * i.Quantity
        )).ToList();

        decimal changeDue = Math.Max(0, order.PaidAmount - order.TotalAmount);

        var paymentDtos = order.Payments.Select(p => new PaymentResponseDto(
            p.Id,
            p.Amount,
            p.Method,
            p.Status,
            p.TransactionReference,
            p.ReceivedByStaffName,
            p.PaymentDateUtc
        )).ToList();

        string qrUrl = $"https://kabirskitchen.com/verify-invoice?inv={Uri.EscapeDataString(order.InvoiceNumber)}";

        var invoiceDto = new InvoiceDto(
            InvoiceNumber: string.IsNullOrWhiteSpace(order.InvoiceNumber) ? $"INV-{order.OrderNumber}" : order.InvoiceNumber,
            OrderNumber: order.OrderNumber,
            OrderId: order.Id,
            OrderType: order.OrderType,
            OrderStatus: order.Status,
            PaymentStatus: order.PaymentStatus,
            InvoiceDateUtc: order.CreatedAtUtc,
            FormattedDate: order.CreatedAtUtc.ToString("dd MMM yyyy"),
            FormattedTime: order.CreatedAtUtc.ToString("hh:mm tt"),
            Restaurant: restaurantInfo,
            CustomerName: order.CustomerName,
            CustomerPhone: order.CustomerPhone,
            DeliveryAddress: order.DeliveryAddress,
            DiningTableNumber: order.DiningTable?.TableNumber,
            CashierStaffName: order.CashierStaffName ?? "Cashier Staff",
            Items: invoiceItems,
            SubTotal: order.SubTotal,
            DiscountAmount: order.DiscountAmount,
            TaxAmount: order.TaxAmount,
            ServiceCharge: order.ServiceCharge,
            DeliveryFee: order.DeliveryFee,
            GrandTotal: order.TotalAmount,
            PaidAmount: order.PaidAmount,
            OutstandingAmount: order.OutstandingAmount,
            ChangeDue: changeDue,
            Payments: paymentDtos,
            IsVoid: order.IsVoid,
            VoidReason: order.VoidReason,
            PrintCount: order.PrintCount,
            LastPrintedAtUtc: order.LastPrintedAtUtc,
            QrVerificationUrl: qrUrl,
            ThankYouMessage: "Thank you for dining with Kabir's Kitchen! 100% Halal & Freshly Prepared with Love."
        );

        return Result<InvoiceDto>.Success(invoiceDto);
    }

    /// <summary>
    /// Records print and reprint events for audit trail.
    /// </summary>
    public async Task<Result> RecordPrintAsync(long orderId, string? staffName, string? format)
    {
        var order = await _context.Orders.FindAsync(orderId);
        if (order == null) return Result.Failure("Order not found.");

        order.PrintCount++;
        order.LastPrintedAtUtc = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(staffName))
        {
            order.PrintedByStaffName = staffName;
        }

        await _context.SaveChangesAsync();
        return Result.Success();
    }

    /// <summary>
    /// Voids or cancels an order with audit trail.
    /// </summary>
    public async Task<Result> VoidOrderAsync(long orderId, string reason, string staffName)
    {
        var order = await _context.Orders.FindAsync(orderId);
        if (order == null) return Result.Failure("Order not found.");
        if (order.IsVoid || order.Status == OrderStatus.Cancelled)
            return Result.Failure("Order is already cancelled.");
        if (string.IsNullOrWhiteSpace(reason))
            return Result.Failure("A cancellation reason is required.");

        order.IsVoid = true;
        order.VoidReason = reason.Trim();
        order.VoidedAtUtc = DateTime.UtcNow;
        order.VoidedByStaffName = string.IsNullOrWhiteSpace(staffName) ? "Staff" : staffName.Trim();
        order.Status = OrderStatus.Cancelled;

        if (order.PromotionCampaignId.HasValue)
        {
            var campaign = await _context.PromotionCampaigns
                .FirstOrDefaultAsync(item => item.Id == order.PromotionCampaignId.Value);
            if (campaign is not null && campaign.RedemptionCount > 0)
            {
                campaign.RedemptionCount--;
                campaign.ConcurrencyToken = Guid.NewGuid();
                campaign.UpdatedAtUtc = DateTime.UtcNow;
                campaign.UpdatedBy = order.VoidedByStaffName;
            }
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Result.Failure("The order or campaign changed concurrently. Reload the order and retry cancellation.");
        }
        return Result.Success();
    }

    /// <summary>
    /// Adds a payment to an existing order (e.g. paying outstanding balance).
    /// </summary>
    public async Task<Result<OrderResponseDto>> AddPaymentAsync(long orderId, InitialPaymentDto paymentDto)
    {
        var order = await _context.Orders
            .Include(o => o.Branch)
            .Include(o => o.Payments)
            .Include(o => o.Items).ThenInclude(i => i.AddOns)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) return Result<OrderResponseDto>.Failure("Order not found.");
        if (order.IsVoid || order.Status == OrderStatus.Cancelled)
            return Result<OrderResponseDto>.Failure("Payments cannot be added to a cancelled order.");
        if (paymentDto.Amount <= 0) return Result<OrderResponseDto>.Failure("Payment amount must be greater than zero.");
        if (!Enum.IsDefined(paymentDto.Method))
            return Result<OrderResponseDto>.Failure("Payment method is invalid.");
        if (paymentDto.Amount > order.OutstandingAmount)
        {
            return Result<OrderResponseDto>.Failure("Payment amount cannot exceed the outstanding balance.");
        }
        if (!string.IsNullOrWhiteSpace(paymentDto.TransactionReference) &&
            order.Payments.Any(p => p.TransactionReference == paymentDto.TransactionReference))
        {
            return Result<OrderResponseDto>.Failure("This transaction has already been recorded.");
        }

        order.Payments.Add(new OrderPayment
        {
            BranchId = order.BranchId,
            Amount = paymentDto.Amount,
            Method = paymentDto.Method,
            Status = PaymentStatus.Paid,
            TransactionReference = paymentDto.TransactionReference,
            ReceivedByStaffName = paymentDto.ReceivedByStaffName ?? "Cashier",
            PaymentDateUtc = DateTime.UtcNow
        });

        order.PaidAmount += paymentDto.Amount;
        if (order.PaidAmount >= order.TotalAmount)
        {
            order.PaymentStatus = PaymentStatus.Paid;
        }
        else
        {
            order.PaymentStatus = PaymentStatus.PartiallyPaid;
        }

        await _context.SaveChangesAsync();
        return Result<OrderResponseDto>.Success(MapToResponse(order, order.Branch?.Name ?? ""));
    }

    /// <summary>
    /// Updates order status and automatically manages inventory deduction when preparation begins.
    /// </summary>
    public async Task<Result> UpdateOrderStatusAsync(long orderId, OrderStatus newStatus)
    {
        var order = await _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) return Result.Failure("Order not found.");
        if (!Enum.IsDefined(newStatus))
            return Result.Failure("Order status is invalid.");
        if (order.IsVoid || order.Status == OrderStatus.Cancelled)
            return Result.Failure("Cancelled orders cannot change status.");
        if (newStatus == OrderStatus.Cancelled)
            return Result.Failure("Use the cancellation action to cancel an order.");

        var oldStatus = order.Status;
        order.Status = newStatus;
        order.UpdatedAtUtc = DateTime.UtcNow;

        // When order moves to Confirmed or Preparing, deduct raw ingredients from branch inventory
        if ((newStatus == OrderStatus.Confirmed || newStatus == OrderStatus.Preparing) &&
            oldStatus == OrderStatus.Pending)
        {
            await _inventoryEngine.DeductIngredientsForOrderAsync(order);
        }

        // Update KDS ticket
        var ticket = await _context.KitchenTickets.FirstOrDefaultAsync(k => k.OrderId == orderId);
        if (ticket != null)
        {
            ticket.Status = newStatus;
            if (newStatus == OrderStatus.Preparing) ticket.StartedPreparingAtUtc = DateTime.UtcNow;
            if (newStatus == OrderStatus.Ready) ticket.ReadyAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return Result.Success();
    }

    /// <summary>
    /// Calculates the true gross profit breakdown for an order.
    /// </summary>
    public async Task<OrderGrossProfitDto?> GetOrderProfitBreakdownAsync(long orderId)
    {
        var order = await _context.Orders.FindAsync(orderId);
        if (order == null) return null;

        decimal netProfit = order.EstimatedGrossProfit;
        decimal marginPercent = order.TotalAmount > 0 ? Math.Round((netProfit / order.TotalAmount) * 100, 2) : 0;

        return new OrderGrossProfitDto(
            order.Id,
            order.OrderNumber,
            order.CreatedAtUtc,
            order.SubTotal,
            order.DiscountAmount,
            order.TotalIngredientBOMCost,
            order.PackagingCost,
            order.DeliveryCost,
            netProfit,
            marginPercent
        );
    }

    private OrderResponseDto MapToResponse(Order order, string branchName)
    {
        var payments = order.Payments?.Select(p => new PaymentResponseDto(
            p.Id,
            p.Amount,
            p.Method,
            p.Status,
            p.TransactionReference,
            p.ReceivedByStaffName,
            p.PaymentDateUtc
        )).ToList() ?? new List<PaymentResponseDto>();

        return new OrderResponseDto(
            order.Id,
            order.BranchId,
            branchName,
            order.OrderNumber,
            string.IsNullOrWhiteSpace(order.InvoiceNumber) ? $"INV-{order.OrderNumber}" : order.InvoiceNumber,
            order.OrderType,
            order.Status,
            order.PaymentStatus,
            order.CustomerName,
            order.CustomerPhone,
            order.DeliveryAddress,
            order.DiningTable?.TableNumber,
            order.CashierStaffName,
            order.SubTotal,
            order.DiscountAmount,
            order.TaxAmount,
            order.ServiceCharge,
            order.DeliveryFee,
            order.TotalAmount,
            order.PaidAmount,
            order.OutstandingAmount,
            order.IsVoid,
            order.PrintCount,
            order.TotalIngredientBOMCost,
            order.EstimatedGrossProfit,
            order.CreatedAtUtc,
            order.Items.Select(i => new OrderItemResponseDto(
                i.Id,
                i.MenuItemId,
                i.ItemName,
                i.MenuItemVariant?.VariantName,
                i.UnitPrice,
                i.Quantity,
                i.LineTotal,
                i.UnitBOMCostAtSale,
                i.AddOns.Select(a => a.AddOnName).ToList()
            )).ToList(),
            payments
        );
    }
}
