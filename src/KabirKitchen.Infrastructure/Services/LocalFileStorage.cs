using KabirKitchen.Domain.Common;
using Microsoft.Extensions.Configuration;

namespace KabirKitchen.Infrastructure.Services;

public sealed class LocalFileStorage : IFileStorage
{
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".txt"];
    private static readonly long MaximumSizeBytes = 5 * 1024 * 1024;
    private readonly string _root;

    public LocalFileStorage(IConfiguration? configuration = null)
    {
        var configuredPath = configuration?["FileStorage:RootPath"];
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            _root = configuredPath;
        }
        else
        {
            // Default persistent path in project/runtime root data directory, outside ephemeral bin/
            _root = Path.Combine(Directory.GetCurrentDirectory(), "data", "storage");
        }
    }

    public async Task<string> SaveAsync(string storageKey, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(storageKey).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(storageKey) || string.IsNullOrWhiteSpace(contentType) ||
            !AllowedExtensions.Contains(extension) || content.Length > MaximumSizeBytes)
            throw new InvalidOperationException("File type or size is not supported.");

        Directory.CreateDirectory(_root);
        var safeName = $"{Guid.NewGuid():N}{extension}";
        var path = GetPath(safeName);
        await using (var output = File.Create(path))
            await content.CopyToAsync(output, cancellationToken);
        return safeName;
    }

    public Task<Stream?> OpenAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(storageKey)) return Task.FromResult<Stream?>(null);
        var path = GetPath(storageKey);
        if (!File.Exists(path)) return Task.FromResult<Stream?>(null);
        return Task.FromResult<Stream?>(File.OpenRead(path));
    }

    public Task DeleteAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(storageKey)) return Task.CompletedTask;
        var path = GetPath(storageKey);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    private string GetPath(string storageKey)
    {
        var fileName = Path.GetFileName(storageKey);
        if (fileName != storageKey || string.IsNullOrWhiteSpace(fileName))
            throw new InvalidOperationException("Invalid attachment storage key.");
        return Path.Combine(_root, fileName);
    }
}
