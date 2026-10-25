using FluentValidation;
using KabirKitchen.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace KabirKitchen.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddScoped<RecipeCostingService>();
        services.AddScoped<InventoryEngineService>();
        services.AddScoped<OrderEngineService>();
        services.AddScoped<CakeOrderService>();
        services.AddScoped<CatalogService>();
        services.AddScoped<SupportService>();
        services.AddScoped<HeroBannerService>();
        services.AddScoped<PromotionEngineService>();
        services.AddScoped<SalesReportService>();
        services.AddScoped<ProcurementService>();

        return services;
    }
}
