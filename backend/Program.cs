using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PulseChat.Api.Data;
using PulseChat.Api.Hubs;
using PulseChat.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Database Configuration
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Data Source=pulsechat.db";
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

// 2. Application Services
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddSingleton<PresenceTracker>();

// 3. SignalR
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});

// 4. JWT Authentication
var jwtSecret = builder.Configuration["JwtSettings:Secret"] 
    ?? "PulseChatSuperSecretKeyForDevelopmentAndTestingEnvironment2026!#";
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "PulseChatApi";
var jwtAudience = builder.Configuration["JwtSettings:Audience"] ?? "PulseChatClient";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ClockSkew = TimeSpan.Zero
        };

        // Allow SignalR to extract JWT from query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/chat"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// 5. CORS Configuration - Dynamically allow any local origin (e.g. 5173, 5174, etc.)
const string corsPolicy = "PulseChatCors";
builder.Services.AddCors(options =>
{
    options.AddPolicy(corsPolicy, policy =>
    {
        policy.SetIsOriginAllowed(origin => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// 6. Ensure Database Created and Seeded
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // Ensure MessageReactions table exists if DB was already created previously
    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS ""MessageReactions"" (
            ""Id"" INTEGER NOT NULL CONSTRAINT ""PK_MessageReactions"" PRIMARY KEY AUTOINCREMENT,
            ""MessageId"" INTEGER NOT NULL,
            ""UserId"" INTEGER NOT NULL,
            ""Emoji"" TEXT NOT NULL,
            ""CreatedAt"" TEXT NOT NULL,
            CONSTRAINT ""FK_MessageReactions_Messages_MessageId"" FOREIGN KEY (""MessageId"") REFERENCES ""Messages"" (""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_MessageReactions_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ""IX_MessageReactions_MessageId"" ON ""MessageReactions"" (""MessageId"");
        CREATE INDEX IF NOT EXISTS ""IX_MessageReactions_UserId"" ON ""MessageReactions"" (""UserId"");
    ");

    EnsureColumnExists(db, "Channels", "OwnerId", "INTEGER NULL");
    EnsureColumnExists(db, "Channels", "IsPrivate", "INTEGER NOT NULL DEFAULT 0");
    EnsureColumnExists(db, "Channels", "IsProtected", "INTEGER NOT NULL DEFAULT 0");
    EnsureColumnExists(db, "ChannelMembers", "LastReadMessageId", "INTEGER NULL");
    EnsureColumnExists(db, "ChannelMembers", "LastReadAt", "TEXT NULL");

    try { db.Database.ExecuteSqlRaw(@"UPDATE ""Channels"" SET ""IsProtected"" = 1, ""OwnerId"" = NULL WHERE ""Id"" IN (1, 2, 3);"); } catch { }
    try { db.Database.ExecuteSqlRaw(@"UPDATE ""Channels"" SET ""Description"" = 'Company-wide announcements, introductions, and general team discussions' WHERE ""Id"" = 1;"); } catch { }
    try { db.Database.ExecuteSqlRaw(@"UPDATE ""Channels"" SET ""Description"" = 'Watercooler chat, casual conversations, fun links, and memes' WHERE ""Id"" = 2;"); } catch { }
    try { db.Database.ExecuteSqlRaw(@"UPDATE ""Channels"" SET ""Description"" = 'Engineering discussions, code reviews, technical architecture, and bug tracking' WHERE ""Id"" = 3;"); } catch { }
    try
    {
        db.Database.ExecuteSqlRaw(@"
            UPDATE ""ChannelMembers""
            SET ""LastReadMessageId"" = (
                SELECT MAX(""Id"") FROM ""Messages""
                WHERE ""Messages"".""ChannelId"" = ""ChannelMembers"".""ChannelId""
            )
            WHERE ""LastReadMessageId"" IS NULL;
        ");
    }
    catch { }

    // Backfill OwnerId for legacy channels created before ownership was added
    try
    {
        db.Database.ExecuteSqlRaw(@"
            UPDATE ""Channels""
            SET ""OwnerId"" = (
                SELECT ""UserId"" FROM ""ChannelMembers""
                WHERE ""ChannelMembers"".""ChannelId"" = ""Channels"".""Id""
                ORDER BY ""JoinedAt"" ASC
                LIMIT 1
            )
            WHERE ""OwnerId"" IS NULL AND ""IsProtected"" = 0 AND ""IsDirectMessage"" = 0;
        ");
    }
    catch { }

    // Backfill all users into all public channels (Discord model)
    try
    {
        db.Database.ExecuteSqlRaw(@"
            INSERT OR IGNORE INTO ""ChannelMembers"" (""ChannelId"", ""UserId"", ""JoinedAt"")
            SELECT c.""Id"", u.""Id"", datetime('now')
            FROM ""Channels"" c
            CROSS JOIN ""Users"" u
            WHERE c.""IsDirectMessage"" = 0 AND c.""IsPrivate"" = 0
            AND NOT EXISTS (
                SELECT 1 FROM ""ChannelMembers"" cm
                WHERE cm.""ChannelId"" = c.""Id"" AND cm.""UserId"" = u.""Id""
            );
        ");
    }
    catch { }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(corsPolicy);

app.UseAuthentication();
app.UseAuthorization();

// Root status endpoints for browser inspection
app.MapGet("/", () => Results.Ok(new
{
    status = "PulseChat API is running!",
    timestamp = DateTime.UtcNow,
    endpoints = new[] { "/api/auth", "/api/channels", "/hubs/chat" }
}));

app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

app.Run();

#pragma warning disable EF1002
static void EnsureColumnExists(AppDbContext context, string tableName, string columnName, string columnDefinition)
{
    var conn = context.Database.GetDbConnection();
    bool wasClosed = conn.State == System.Data.ConnectionState.Closed;
    if (wasClosed) conn.Open();
    try
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"PRAGMA table_info(\"{tableName}\");";
        using var reader = cmd.ExecuteReader();
        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        while (reader.Read())
        {
            columns.Add(reader.GetString(1));
        }
        if (!columns.Contains(columnName))
        {
            context.Database.ExecuteSqlRaw($"ALTER TABLE \"{tableName}\" ADD COLUMN \"{columnName}\" {columnDefinition};");
        }
    }
    catch { }
    finally
    {
        if (wasClosed) conn.Close();
    }
}
#pragma warning restore EF1002
