using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using PulseChat.Api.Data;

namespace PulseChat.Api.Helpers;

public static class DatabaseHelper
{
    /// <summary>
    /// Configures the DbContext for either PostgreSQL (production/cloud) or SQLite (local development).
    /// </summary>
    public static void ConfigureDatabase(IServiceCollection services, IConfiguration configuration)
    {
        // 1. Check for PostgreSQL connection string or URL (Render, Railway, Neon, Supabase, Docker)
        var postgresConnection = configuration["DATABASE_URL"]
            ?? configuration.GetConnectionString("PostgreSql")
            ?? configuration["POSTGRESQL_CONNECTION_STRING"]
            ?? configuration["ConnectionStrings:PostgreSql"];

        if (!string.IsNullOrWhiteSpace(postgresConnection))
        {
            var formattedConnectionString = NormalizePostgresConnectionString(postgresConnection);
            services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(formattedConnectionString));
            return;
        }

        // 2. Fallback to SQLite for local development
        var sqliteConnection = configuration.GetConnectionString("DefaultConnection") 
            ?? "Data Source=pulsechat.db";

        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlite(sqliteConnection));
    }

    /// <summary>
    /// Parses postgres:// URI strings (standard on Neon, Supabase, Render, Railway) 
    /// and converts them into standard ADO.NET Npgsql connection strings.
    /// </summary>
    public static string NormalizePostgresConnectionString(string connectionStringOrUri)
    {
        if (string.IsNullOrWhiteSpace(connectionStringOrUri))
            return string.Empty;

        var trimmed = connectionStringOrUri.Trim();

        // Check if string is in URI format (e.g., postgres://user:password@host:port/database)
        if (trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var uri = new Uri(trimmed);
                var userInfo = uri.UserInfo.Split(':', 2);
                var username = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
                var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
                var host = uri.Host;
                var port = uri.Port > 0 ? uri.Port : 5432;
                var database = uri.AbsolutePath.TrimStart('/');

                var builder = new NpgsqlConnectionStringBuilder
                {
                    Host = host,
                    Port = port,
                    Database = database,
                    Username = username,
                    Password = password,
                    SslMode = SslMode.Prefer
                };

                return builder.ConnectionString;
            }
            catch
            {
                // If URI parsing fails, return as-is
                return trimmed;
            }
        }

        return trimmed;
    }
}
