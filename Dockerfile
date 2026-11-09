# ── Build Stage ──
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files for caching restore layer
COPY ["src/KabirKitchen.Domain/KabirKitchen.Domain.csproj", "src/KabirKitchen.Domain/"]
COPY ["src/KabirKitchen.Application/KabirKitchen.Application.csproj", "src/KabirKitchen.Application/"]
COPY ["src/KabirKitchen.Infrastructure/KabirKitchen.Infrastructure.csproj", "src/KabirKitchen.Infrastructure/"]
COPY ["src/KabirKitchen.Api/KabirKitchen.Api.csproj", "src/KabirKitchen.Api/"]

RUN dotnet restore "src/KabirKitchen.Api/KabirKitchen.Api.csproj"

# Copy source code and build Release
COPY . .
WORKDIR "/src/src/KabirKitchen.Api"
RUN dotnet publish "KabirKitchen.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# ── Runtime Stage ──
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "KabirKitchen.Api.dll"]

