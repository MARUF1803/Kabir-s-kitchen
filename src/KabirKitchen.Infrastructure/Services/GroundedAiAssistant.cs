using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Domain.Common;
using KabirKitchen.Domain.Entities.Catalog;
using KabirKitchen.Domain.Entities.Orders;
using Microsoft.EntityFrameworkCore;

namespace KabirKitchen.Infrastructure.Services;

public sealed class GroundedAiAssistant : IAiAssistant
{
    private readonly IApplicationDbContext _context;

    public GroundedAiAssistant(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AiAnswer> AnswerAsync(string question, long branchId, long? orderId, CancellationToken cancellationToken = default)
    {
        var normalized = question.Trim().ToLowerInvariant();
        var products = await _context.MenuItems
            .AsNoTracking()
            .Where(m => m.IsActive && !m.IsDeleted)
            .Include(m => m.Variants)
            .ToListAsync(cancellationToken);

        if (Contains(normalized, "recommend", "suggest", "spicy", "under", "budget", "people", "chicken", "birthday"))
        {
            var candidates = products
                .Where(m => normalized.Contains(m.Name.ToLowerInvariant().Split(' ')[0]) ||
                            (normalized.Contains("chicken") && m.Name.Contains("Chicken", StringComparison.OrdinalIgnoreCase)) ||
                            (normalized.Contains("spicy") && m.IsSpicy) ||
                            (normalized.Contains("birthday") && m.IsBakeryItem))
                .Take(3)
                .ToList();

            if (candidates.Count > 0)
            {
                var recommendations = candidates.Select(m => new AiRecommendation(
                    m.Id,
                    m.Name,
                    m.Variants.FirstOrDefault(v => v.IsDefault)?.VariantName,
                    GetPrice(m, branchId),
                    m.PreparationTimeMinutes,
                    true,
                    m.ImageUrl ?? string.Empty)).ToList();
                return new AiAnswer(BuildRecommendationText(recommendations, normalized), recommendations, false, true);
            }
        }

        if (Contains(normalized, "price", "cost", "how much"))
        {
            var product = products.FirstOrDefault(m => normalized.Contains(m.Name.ToLowerInvariant().Split(' ')[0]));
            if (product != null)
                return new AiAnswer($"The current {product.Name} price at this branch is ৳{GetPrice(product, branchId):0.00}.", Array.Empty<AiRecommendation>(), false, true);
        }

        if (Contains(normalized, "order", "status", "received", "delivery"))
        {
            if (orderId.HasValue)
            {
                var order = await _context.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId.Value, cancellationToken);
                if (order != null)
                    return new AiAnswer($"Order #{order.OrderNumber} is currently {order.Status}.", Array.Empty<AiRecommendation>(), false, true);
            }
            return new AiAnswer("I can help with an order status, but I need the order number to check it. Please share the order number or use ‘Chat about this order’.", Array.Empty<AiRecommendation>(), true, false);
        }

        if (Contains(normalized, "open", "hour", "closing", "available"))
        {
            var branch = await _context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == branchId && b.IsActive, cancellationToken);
            if (branch != null)
                return new AiAnswer($"{branch.Name} is open from {branch.OpeningTime:hh\\:mm} to {branch.ClosingTime:hh\\:mm}.", Array.Empty<AiRecommendation>(), false, true);
            return new AiAnswer("I could not confirm the branch opening hours. Please contact human support.", Array.Empty<AiRecommendation>(), true, false);
        }

        return new AiAnswer("I can help with menu discovery, recommendations, prices, preparation time, availability, offers, delivery, order status, payments, and custom cakes. I do not have the requested information yet, so please contact human support for confirmation.", Array.Empty<AiRecommendation>(), true, false);
    }

    private static bool Contains(string text, params string[] terms) => terms.Any(term => text.Contains(term, StringComparison.OrdinalIgnoreCase));

    private static decimal GetPrice(MenuItem item, long branchId)
    {
        var branchPrice = item.Variants.FirstOrDefault(v => v.IsDefault)?.AdditionalPrice;
        return branchPrice ?? item.BasePrice;
    }

    private static string BuildRecommendationText(IReadOnlyList<AiRecommendation> recommendations, string normalized)
    {
        var lines = recommendations.Select(r => $"- {r.Name}: ৳{r.Price:0.00}, {r.PreparationTimeMinutes} min, {r.Variant ?? "standard"}");
        var budget = normalized.Contains("under") ? " under the requested budget" : string.Empty;
        return $"Here are matching options{budget}: {string.Join("\n", lines)}. Availability and final pricing should be confirmed at checkout.";
    }
}
