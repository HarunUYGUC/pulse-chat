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
builder.Services.AddSingleton<VoiceTracker>();

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
    EnsureColumnExists(db, "Channels", "Type", "TEXT NOT NULL DEFAULT 'text'");
    EnsureColumnExists(db, "ChannelMembers", "LastReadMessageId", "INTEGER NULL");
    EnsureColumnExists(db, "ChannelMembers", "LastReadAt", "TEXT NULL");

    // Delete legacy #random and #dev channels and their associated records
    try
    {
        db.Database.ExecuteSqlRaw(@"
            DELETE FROM ""MessageReactions"" WHERE ""MessageId"" IN (SELECT ""Id"" FROM ""Messages"" WHERE ""ChannelId"" IN (SELECT ""Id"" FROM ""Channels"" WHERE ""Name"" IN ('random', 'dev')));
            DELETE FROM ""Messages"" WHERE ""ChannelId"" IN (SELECT ""Id"" FROM ""Channels"" WHERE ""Name"" IN ('random', 'dev'));
            DELETE FROM ""ChannelMembers"" WHERE ""ChannelId"" IN (SELECT ""Id"" FROM ""Channels"" WHERE ""Name"" IN ('random', 'dev'));
            DELETE FROM ""ChannelJoinRequests"" WHERE ""ChannelId"" IN (SELECT ""Id"" FROM ""Channels"" WHERE ""Name"" IN ('random', 'dev'));
            DELETE FROM ""ChannelKickRecords"" WHERE ""ChannelId"" IN (SELECT ""Id"" FROM ""Channels"" WHERE ""Name"" IN ('random', 'dev'));
            DELETE FROM ""Channels"" WHERE ""Name"" IN ('random', 'dev');
        ");
    }
    catch { }

    try { db.Database.ExecuteSqlRaw(@"UPDATE ""Channels"" SET ""IsProtected"" = 1, ""OwnerId"" = NULL WHERE ""Name"" = 'general' OR ""Id"" = 1;"); } catch { }
    try { db.Database.ExecuteSqlRaw(@"UPDATE ""Channels"" SET ""Description"" = 'General discussion for this workspace' WHERE ""Name"" = 'general' OR ""Id"" = 1;"); } catch { }
    try { db.Database.ExecuteSqlRaw(@"UPDATE ""Channels"" SET ""Name"" = 'general-voice', ""IsProtected"" = 1, ""OwnerId"" = NULL WHERE ""Name"" IN ('General Voice', 'Genel Ses', 'general-voice') OR ""Id"" = 2;"); } catch { }
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

    // Ensure ChannelKickRecords and ChannelJoinRequests tables exist
    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS ""ChannelKickRecords"" (
            ""Id"" INTEGER NOT NULL CONSTRAINT ""PK_ChannelKickRecords"" PRIMARY KEY AUTOINCREMENT,
            ""ChannelId"" INTEGER NOT NULL,
            ""UserId"" INTEGER NOT NULL,
            ""KickedById"" INTEGER NOT NULL,
            ""KickedAt"" TEXT NOT NULL,
            CONSTRAINT ""FK_ChannelKickRecords_Channels_ChannelId"" FOREIGN KEY (""ChannelId"") REFERENCES ""Channels"" (""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_ChannelKickRecords_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_ChannelKickRecords_Users_KickedById"" FOREIGN KEY (""KickedById"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ""IX_ChannelKickRecords_ChannelId"" ON ""ChannelKickRecords"" (""ChannelId"");
        CREATE INDEX IF NOT EXISTS ""IX_ChannelKickRecords_UserId"" ON ""ChannelKickRecords"" (""UserId"");

        CREATE TABLE IF NOT EXISTS ""ChannelJoinRequests"" (
            ""Id"" INTEGER NOT NULL CONSTRAINT ""PK_ChannelJoinRequests"" PRIMARY KEY AUTOINCREMENT,
            ""ChannelId"" INTEGER NOT NULL,
            ""UserId"" INTEGER NOT NULL,
            ""RequestedAt"" TEXT NOT NULL,
            ""Status"" TEXT NOT NULL,
            ""WasPreviouslyKicked"" INTEGER NOT NULL DEFAULT 0,
            ""DecidedAt"" TEXT NULL,
            ""DecidedById"" INTEGER NULL,
            CONSTRAINT ""FK_ChannelJoinRequests_Channels_ChannelId"" FOREIGN KEY (""ChannelId"") REFERENCES ""Channels"" (""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_ChannelJoinRequests_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_ChannelJoinRequests_Users_DecidedById"" FOREIGN KEY (""DecidedById"") REFERENCES ""Users"" (""Id"") ON DELETE RESTRICT
        );
        CREATE INDEX IF NOT EXISTS ""IX_ChannelJoinRequests_ChannelId"" ON ""ChannelJoinRequests"" (""ChannelId"");
        CREATE INDEX IF NOT EXISTS ""IX_ChannelJoinRequests_UserId"" ON ""ChannelJoinRequests"" (""UserId"");
    ");

    // Ensure Workspaces table exists
    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS ""Workspaces"" (
            ""Id"" INTEGER NOT NULL CONSTRAINT ""PK_Workspaces"" PRIMARY KEY AUTOINCREMENT,
            ""Name"" TEXT NOT NULL,
            ""Description"" TEXT NULL,
            ""InviteCode"" TEXT NOT NULL,
            ""OwnerId"" INTEGER NOT NULL,
            ""CreatedAt"" TEXT NOT NULL,
            CONSTRAINT ""FK_Workspaces_Users_OwnerId"" FOREIGN KEY (""OwnerId"") REFERENCES ""Users"" (""Id"") ON DELETE RESTRICT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Workspaces_InviteCode"" ON ""Workspaces"" (""InviteCode"");
    ");

    // Ensure WorkspaceMembers table exists
    db.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS ""WorkspaceMembers"" (
            ""WorkspaceId"" INTEGER NOT NULL,
            ""UserId"" INTEGER NOT NULL,
            ""Role"" TEXT NOT NULL,
            ""JoinedAt"" TEXT NOT NULL,
            CONSTRAINT ""PK_WorkspaceMembers"" PRIMARY KEY (""WorkspaceId"", ""UserId""),
            CONSTRAINT ""FK_WorkspaceMembers_Workspaces_WorkspaceId"" FOREIGN KEY (""WorkspaceId"") REFERENCES ""Workspaces"" (""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_WorkspaceMembers_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ""IX_WorkspaceMembers_UserId"" ON ""WorkspaceMembers"" (""UserId"");
    ");

    // Ensure WorkspaceId exists on Channels table
    EnsureColumnExists(db, "Channels", "WorkspaceId", "INTEGER NULL");

    // Ensure default workspace exists
    try
    {
        db.Database.ExecuteSqlRaw(@"
            INSERT OR IGNORE INTO ""Workspaces"" (""Id"", ""Name"", ""Description"", ""InviteCode"", ""OwnerId"", ""CreatedAt"")
            VALUES (1, 'PulseChat Community', 'Default public community workspace for team discussion and collaboration.', 'PULSE-DEMO', 1, datetime('now'));
        ");
    }
    catch { }

    // Backfill legacy channels to Workspace 1 if WorkspaceId is NULL
    try
    {
        db.Database.ExecuteSqlRaw(@"
            UPDATE ""Channels""
            SET ""WorkspaceId"" = 1
            WHERE ""WorkspaceId"" IS NULL AND ""IsDirectMessage"" = 0;
        ");
    }
    catch { }

    // Ensure workspace members are added to public channels within their own workspace
    try
    {
        db.Database.ExecuteSqlRaw(@"
            INSERT OR IGNORE INTO ""ChannelMembers"" (""ChannelId"", ""UserId"", ""JoinedAt"")
            SELECT c.""Id"", wm.""UserId"", datetime('now')
            FROM ""Channels"" c
            JOIN ""WorkspaceMembers"" wm ON c.""WorkspaceId"" = wm.""WorkspaceId""
            WHERE c.""IsDirectMessage"" = 0 AND c.""IsPrivate"" = 0
            AND NOT EXISTS (
                SELECT 1 FROM ""ChannelMembers"" cm
                WHERE cm.""ChannelId"" = c.""Id"" AND cm.""UserId"" = wm.""UserId""
            )
            AND NOT EXISTS (
                SELECT 1 FROM ""ChannelKickRecords"" ckr
                WHERE ckr.""ChannelId"" = c.""Id"" AND ckr.""UserId"" = wm.""UserId""
            );
        ");
    }
    catch { }

    // Clean up any cross-workspace channel memberships that were erroneously created
    try
    {
        db.Database.ExecuteSqlRaw(@"
            DELETE FROM ""ChannelMembers""
            WHERE ""ChannelId"" IN (SELECT ""Id"" FROM ""Channels"" WHERE ""WorkspaceId"" IS NOT NULL AND ""IsDirectMessage"" = 0)
            AND NOT EXISTS (
                SELECT 1 FROM ""WorkspaceMembers"" wm
                JOIN ""Channels"" c ON c.""Id"" = ""ChannelMembers"".""ChannelId""
                WHERE wm.""WorkspaceId"" = c.""WorkspaceId"" AND wm.""UserId"" = ""ChannelMembers"".""UserId""
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
