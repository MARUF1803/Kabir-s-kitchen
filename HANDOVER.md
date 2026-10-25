# Kabir's Kitchen — Handover

## Current status

The codebase contains a .NET 10 ASP.NET Core API, EF Core/SQL Server persistence, and a React 19/Vite frontend. The promotion engine, campaign/banner administration, branch-scoped pricing and order flows, and persistent campaign scheduler are implemented in the repository. The latest handover cleanup removes fabricated Admin dashboard figures and seeded operational orders, cake requests, stock movements, wallet, and loyalty balances.

This is **not a production launch sign-off**. No production database, public domains, hosting environment, or provider accounts were available to validate a deployment. Configure and verify these in staging before launch.

## Run and verify locally

From the repository root:

```powershell
dotnet test tests\KabirKitchen.Tests\KabirKitchen.Tests.csproj
dotnet run --project src\KabirKitchen.Api\KabirKitchen.Api.csproj
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The API defaults to `http://localhost:5143/api` in Development. For a production frontend build, set the real API base URL (including `/api`) to an HTTPS URL:

```powershell
$env:VITE_API_BASE_URL = "https://<api-host>/api"
npm run build
```

Do not deploy a build made with a placeholder API URL. The frontend verification build in this handover used a reserved `.invalid` URL only to verify bundling.

## Production configuration checklist

Set values through the hosting platform's secret/configuration store; do not commit credentials:

`src\KabirKitchen.Api\appsettings.example.json` is a credential-free configuration template. Local `appsettings*.json` files and environment files are excluded by the root `.gitignore`; configure database/JWT/payment/provider secrets using environment variables or the deployment secret store.
For a new database in any environment, set `BootstrapAdmin__Email`, `BootstrapAdmin__FullName`, `BootstrapAdmin__PhoneNumber`, and a private `BootstrapAdmin__Password` (minimum 12 characters) before first startup. Staff demo-login buttons and embedded development passwords have been removed; use individually provisioned staff credentials.

| Setting | Requirement |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__DefaultConnection` | Production SQL Server connection string |
| `Jwt__SecretKey` | Secret with at least 32 UTF-8 bytes |
| `Jwt__Issuer`, `Jwt__Audience` | Production token issuer and audience |
| `Cors__AllowedOrigins__0` (and additional numbered entries) | Exact HTTPS frontend origins, without paths |
| `FileStorage__RootPath` | Persistent, writable storage mounted for uploaded banner files |
| `AllowedHosts` | Explicit public API host names; not `*` or `localhost` |
| `VITE_API_BASE_URL` | Public HTTPS API origin and `/api` path, set at frontend build time |
| `BootstrapAdmin__Email`, `BootstrapAdmin__FullName`, `BootstrapAdmin__PhoneNumber`, `BootstrapAdmin__Password` | Required to seed a new database; password must contain at least 12 characters |

The API validates these production settings at startup and applies EF migrations/seeding during startup. The repository also uses `EnsureCreated` because its migration history starts after the core schema existed. Test upgrades and first-time creation against a **backup or staging database** before production; do not assume the startup migration path is operationally validated for a live multi-instance deployment.

Relevant promotion migrations already present in the project:

- `20261024093226_AddPromotionEngagementTracking`
- `20261024105308_AddWeeklyPromotionRecurrence`

These were applied to the configured local development database during earlier work. No database migration was added for this handover cleanup; production migration application has not been verified.

## Payments and external providers

- Cash is the only currently enabled checkout method. The order remains unpaid until an authorized staff member records payment.
- bKash, Nagad, Rocket, SSLCommerz/card, and the additional gateway choice remain visible as disabled options until configured.
- The backend does not simulate payment success. Real bKash and SSLCommerz flows require merchant credentials and valid HTTPS callback/IPN URLs.
- SMS and courier provider integrations are not configured; provider accounts/contracts are still required.
- Table reservation has no backend persistence/API yet. The storefront offers direct branch call/message links, and explicitly does not claim that a reservation was created.
- Storefront offer cards now use active server campaigns; static discount claims, arbitrary offer/combo product shelves, unsupported review/delivery/trust metrics, hardcoded branch contacts, and assumed opening/table availability were removed.
- Guest order tracking stores the order ID and customer phone only in the current browser session, revalidates access through the phone-protected order endpoint, and refreshes status periodically. Tracking no longer invents an ETA or kitchen progress. Guest invoice downloads pass the phone required by the API.
- Checkout no longer pre-fills another customer's address or table number. Reservation, checkout, tracking, and branch contact UI still require end-to-end browser verification before launch.
- Never mark an order paid based on a browser response; use the verified provider callback/IPN flow and confirm the provider account setup before enabling a method.

## Promotion, banner, and scheduling surfaces

Primary API routes:

- `GET/POST /api/promotions`, `PUT /api/promotions/{id}`, `PATCH /api/promotions/{id}/status`
- `GET /api/promotions/active`, `POST /api/promotions/quote`
- `GET /api/promotions/calendar`, `GET /api/promotions/reports`, `POST /api/promotions/engagement`
- `GET/POST /api/hero-banners`, `GET /api/hero-banners/admin`, `PUT/DELETE /api/hero-banners/{id}`, `POST /api/hero-banners/upload`
- Orders are priced and validated by the server; the Admin order list uses `GET /api/orders` with server-side branch authorization.
- Staff listing/update uses `GET /api/users` and `PATCH /api/users/{id}`. Manual inventory adjustment uses `POST /api/inventory/adjust`.

Campaign status changes are processed by a hosted worker polling the database every 30 seconds. Campaigns survive API restarts because their schedule is persisted. Weekly recurrence currently advances the stored UTC window in 7-day intervals; it is not a weekday/timezone recurrence editor. Concurrency conflicts are logged and retried on the next poll. Multi-instance load/recovery behavior has not been stress-tested against production SQL Server.

Promotion selection is deterministic and non-stacking by default. Custom cakes are only eligible when explicitly enabled, and their required advance is 50% of the final discounted quote. Validate the final cake payment flow in staging before taking custom cake orders.

## Verification performed

- Backend automated tests: 57 passed in the latest available suite run.
- Frontend tests: 6 passed, 0 failed.
- Frontend lint: 0 errors; warnings remain and should be reviewed separately.
- Frontend production bundling: passed with a build-only placeholder API URL; build again with the real API URL before deploy.
- Previous local checks included API readiness, promotion endpoint and engagement-rate-limit smoke checks, and responsive checks at 1440, 1280, 768, 390, and 360 px.
- Screenshots were viewed during those checks but were not saved as handover files.
- Production SQL Server, real merchant callbacks, SMS/courier providers, and hosted deployment were not available for end-to-end verification.

## Before launch

1. Provision production SQL Server and persistent banner upload storage; rehearse migration and restore procedures in staging.
2. Set production API secrets, CORS origins, host allowlist, frontend API URL, HTTPS certificates, and monitoring/log retention.
3. Create authorized staff/branch accounts and verify branch-scoped order, inventory, promotion, and POS access using real roles.
4. Test cash orders, refunds/cancellations, cake advance collection, promotion boundaries, receipts, and restart recovery in staging.
5. Obtain merchant/provider accounts before enabling online payment, SMS, or courier integrations; test callbacks with the provider's approved test environment.
6. Deploy one API instance for the initial migration/startup rehearsal. If scaling API instances, validate startup migrations and scheduler concurrency with the production database before increasing replicas.
7. Implement and test a reservation API before advertising online table booking.
