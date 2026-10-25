using KabirKitchen.Domain.Enums;

namespace KabirKitchen.Domain.Common;

public interface IAiAssistant
{
    Task<AiAnswer> AnswerAsync(string question, long branchId, long? orderId, CancellationToken cancellationToken = default);
}

public sealed record AiAnswer(
    string Text,
    IReadOnlyList<AiRecommendation> Recommendations,
    bool RequiresHumanSupport,
    bool IsSafeToAct);

public sealed record AiRecommendation(
    long ProductId,
    string Name,
    string? Variant,
    decimal Price,
    int PreparationTimeMinutes,
    bool IsAvailable,
    string ImageUrl);
