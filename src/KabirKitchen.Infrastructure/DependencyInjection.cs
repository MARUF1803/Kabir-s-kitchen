using System.Text;
using KabirKitchen.Application.Common.Interfaces;
using KabirKitchen.Domain.Common;
using KabirKitchen.Infrastructure.Persistence;
using KabirKitchen.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace KabirKitchen.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Database
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");
        }

        services.AddDbContext<KabirKitchenDbContext>(options =>
        {
            options.UseSqlServer(connectionString, b => b.MigrationsAssembly(typeof(KabirKitchenDbContext).Assembly.FullName));
            options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        });

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<KabirKitchenDbContext>());

        // Services & Integrations
        services.AddHttpClient();
        services.AddHttpContextAccessor();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddSingleton<INotificationService, ChannelNotificationService>();
        services.AddScoped<IPaymentGatewayService, PaymentGatewayService>();
        services.AddScoped<IAiAssistant, GroundedAiAssistant>();
        services.AddSingleton<IFileStorage, LocalFileStorage>();
        services.AddScoped<IInvoicePdfService, InvoicePdfService>();

        var secretKey = configuration["Jwt:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey))
        {
            throw new InvalidOperationException("Jwt:SecretKey is required.");
        }

        var key = Encoding.UTF8.GetBytes(secretKey);
        if (key.Length < 32)
        {
            throw new InvalidOperationException("Jwt:SecretKey must contain at least 32 UTF-8 bytes.");
        }

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.RequireHttpsMetadata = true;
            options.SaveToken = true;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = configuration["Jwt:Issuer"] ?? "KabirKitchen",
                ValidateAudience = true,
                ValidAudience = configuration["Jwt:Audience"] ?? "KabirKitchenApp",
                ClockSkew = TimeSpan.Zero
            };
        });

        services.AddAuthorization();

        return services;
    }
}
