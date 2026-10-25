using KabirKitchen.Api.Middleware;
using KabirKitchen.Api.Services;
using KabirKitchen.Application;
using KabirKitchen.Infrastructure;
using KabirKitchen.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using Microsoft.AspNetCore.RateLimiting;
using Serilog;
using System.Security.Cryptography;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment() && string.IsNullOrWhiteSpace(builder.Configuration["Jwt:SecretKey"]))
{
    builder.Configuration["Jwt:SecretKey"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
}

var isProduction = !builder.Environment.IsDevelopment();
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (isProduction)
{
    RequireConfiguration(builder.Configuration.GetConnectionString("DefaultConnection"), "ConnectionStrings:DefaultConnection");
    var jwtSecret = builder.Configuration["Jwt:SecretKey"];
    if (string.IsNullOrWhiteSpace(jwtSecret) || System.Text.Encoding.UTF8.GetByteCount(jwtSecret) < 32)
    {
        throw new InvalidOperationException("Production Jwt:SecretKey must contain at least 32 UTF-8 bytes.");
    }

    RequireConfiguration(builder.Configuration["Jwt:Issuer"], "Jwt:Issuer");
    RequireConfiguration(builder.Configuration["Jwt:Audience"], "Jwt:Audience");
    RequireConfiguration(builder.Configuration["FileStorage:RootPath"], "FileStorage:RootPath");

    var allowedHosts = (builder.Configuration["AllowedHosts"] ?? "")
        .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    if (allowedHosts.Length == 0 || allowedHosts.Any(host => host == "*" || host.Equals("localhost", StringComparison.OrdinalIgnoreCase)))
    {
        throw new InvalidOperationException("Production AllowedHosts must list the public API host names and must not contain '*'.");
    }

    if (allowedOrigins.Length == 0)
    {
        throw new InvalidOperationException("Production Cors:AllowedOrigins must contain the exact HTTPS frontend origins.");
    }

    foreach (var origin in allowedOrigins)
    {
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps ||
            !string.Equals(origin.TrimEnd('/'), uri.GetLeftPart(UriPartial.Authority), StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Production CORS origin '{origin}' must be an HTTPS origin without a path.");
        }
    }

    Directory.CreateDirectory(builder.Configuration["FileStorage:RootPath"]!);
}

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// Add Clean Architecture Layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSingleton<PromotionScheduleService>();
builder.Services.AddHostedService<PromotionScheduleWorker>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("promotion-engagement", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

// Add Controllers & JSON Options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// CORS Policy for Vite React Frontend (Supports ports 5173, 5174, 5175, etc.)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
              {
                  if (allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;
                  return builder.Environment.IsDevelopment() &&
                         Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
                         uri.IsLoopback;
              })
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Swagger / OpenAPI with JWT Bearer support
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Kabir's Kitchen - Multi-Branch Restaurant ERP & POS API",
        Version = "v1",
        Description = "Enterprise-Grade Restaurant ERP, Unified Order Engine, Recipe/BOM Management, Bakery Scheduling & Cost Intelligence"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    c.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
});

var app = builder.Build();

// Apply pending migrations and seed data on startup
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<KabirKitchenDbContext>();
        // This repository's migration history starts after the core schema existed.
        // Ensure an empty database gets the current model before applying incremental migrations.
        await context.Database.EnsureCreatedAsync();
        context.Database.Migrate();
        await DatabaseSeeder.SeedAsync(context, builder.Configuration);
        var seededMenuItems = await CatalogSeeder.SeedAsync(context);
        Log.Information("Database migrations and seed data completed successfully. Added {MenuItemCount} catalog products.", seededMenuItems);
    }
    catch (Exception ex)
    {
        Log.Fatal(ex, "Database migrations or initial data seeding failed. The API cannot start safely.");
        throw;
    }
}

// Middleware Pipeline
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseHttpsRedirection();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Kabir's Kitchen API v1");
        c.RoutePrefix = string.Empty; // Serve Swagger at root "/"
    });
}

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

app.MapGet("/health/live", () => Results.Ok(new { status = "healthy" }));
app.MapGet("/health/ready", async (KabirKitchenDbContext context, CancellationToken cancellationToken) =>
    await context.Database.CanConnectAsync(cancellationToken)
        ? Results.Ok(new { status = "ready" })
        : Results.StatusCode(StatusCodes.Status503ServiceUnavailable));

app.Run();

static void RequireConfiguration(string? value, string key)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        throw new InvalidOperationException($"Production configuration '{key}' is required.");
    }
}
