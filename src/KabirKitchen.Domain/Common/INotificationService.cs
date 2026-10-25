namespace KabirKitchen.Domain.Common;

public interface INotificationService
{
    Task NotifyAsync(long recipientUserId, string title, string message, object? metadata = null, CancellationToken cancellationToken = default);
}
