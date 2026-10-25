using KabirKitchen.Domain.Common;

namespace KabirKitchen.Infrastructure.Services;

public sealed class InMemoryNotificationService : INotificationService
{
    public Task NotifyAsync(long recipientUserId, string title, string message, object? metadata = null, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }
}
