using KabirKitchen.Infrastructure.Persistence;

namespace KabirKitchen.Api.Services;

public sealed class PromotionScheduleWorker : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(30);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PromotionScheduleWorker> _logger;
    private readonly PromotionScheduleService _scheduleService;

    public PromotionScheduleWorker(
        IServiceScopeFactory scopeFactory,
        PromotionScheduleService scheduleService,
        ILogger<PromotionScheduleWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _scheduleService = scheduleService;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await UpdateCampaignStatusesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException exception)
            {
                _logger.LogInformation(exception, "A campaign schedule changed on another API instance; it will be retried.");
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Campaign schedule update failed; the worker will retry.");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    private async Task UpdateCampaignStatusesAsync(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<KabirKitchenDbContext>();
        var now = DateTime.UtcNow;
        var updatedCount = await _scheduleService.UpdateCampaignStatusesAsync(db, now, cancellationToken);
        if (updatedCount > 0)
        {
            _logger.LogInformation("Updated {CampaignCount} scheduled campaign statuses.", updatedCount);
        }
    }
}
