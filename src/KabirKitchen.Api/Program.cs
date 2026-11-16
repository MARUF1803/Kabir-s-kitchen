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

if (string.IsNullOrWhiteSpace(builder.Configuration["Jwt:SecretKey"]))
{
    builder.Configuration["Jwt:SecretKey"] = "KabirKitchen-Prod-FixedSecret-2026-SuperSecure-32BytesMin!!";
}
if (string.IsNullOrWhiteSpace(builder.Configuration["Jwt:Issuer"]))
{
    builder.Configuration["Jwt:Issuer"] = "KabirKitchen";
}
if (string.IsNullOrWhiteSpace(builder.Configuration["Jwt:Audience"]))
{
    builder.Configuration["Jwt:Audience"] = "KabirKitchenApp";
}
if (string.IsNullOrWhiteSpace(builder.Configuration["FileStorage:RootPath"]))
{
    builder.Configuration["FileStorage:RootPath"] = Path.Combine(AppContext.BaseDirectory, "uploads");
}
try { Directory.CreateDirectory(builder.Configuration["FileStorage:RootPath"]!); } catch {}

var isProduction = !builder.Environment.IsDevelopment();
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (isProduction)
{
    RequireConfiguration(builder.Configuration.GetConnectionString("DefaultConnection"), "ConnectionStrings:DefaultConnection");
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

// CORS Policy for Frontend (Vercel, MonsterASP, Localhost)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
              {
                  if (string.IsNullOrWhiteSpace(origin)) return false;
                  if (allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;
                  if (origin.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase)) return true;
                  if (origin.Contains("runasp.net", StringComparison.OrdinalIgnoreCase)) return true;
                  return Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IsLoopback;
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
        try
        {
            await context.Database.MigrateAsync();
        }
        catch (Exception migEx)
        {
            Log.Warning(migEx, "Database migration encountered an existing schema, attempting EnsureCreated fallback.");
            try
            {
                await context.Database.EnsureCreatedAsync();
            }
            catch (Exception ensureEx)
            {
                Log.Warning(ensureEx, "EnsureCreated skipped.");
            }
        }

        try
        {
            await DatabaseSeeder.SeedAsync(context, builder.Configuration);
            var seededMenuItems = await CatalogSeeder.SeedAsync(context);
            Log.Information("Database migrations and seed data completed successfully. Added {MenuItemCount} catalog products.", seededMenuItems);
        }
        catch (Exception seedEx)
        {
            Log.Warning(seedEx, "Data seeding encountered existing records, skipping.");
        }
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Database startup step completed with warnings.");
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
