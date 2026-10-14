# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project file and restore dependencies (optimizes Docker layer caching)
COPY PulseChat.Api.csproj ./
RUN dotnet restore

# Copy all source code and publish release binaries
COPY . ./
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Configure default production environment and port
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

# Copy published application from build stage
COPY --from=build /app/publish .

# Expose API and SignalR WebSockets port
EXPOSE 5000

ENTRYPOINT ["dotnet", "PulseChat.Api.dll"]
