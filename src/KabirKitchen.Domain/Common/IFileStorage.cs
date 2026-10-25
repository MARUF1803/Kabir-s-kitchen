namespace KabirKitchen.Domain.Common;

public interface IFileStorage
{
    Task<string> SaveAsync(string storageKey, Stream content, string contentType, CancellationToken cancellationToken = default);
    Task<Stream?> OpenAsync(string storageKey, CancellationToken cancellationToken = default);
    Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default);
}
