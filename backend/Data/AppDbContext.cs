using System;
using Microsoft.EntityFrameworkCore;
using PulseChat.Api.Models;

namespace PulseChat.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<WorkspaceMember> WorkspaceMembers => Set<WorkspaceMember>();
    public DbSet<Channel> Channels => Set<Channel>();
    public DbSet<ChannelMember> ChannelMembers => Set<ChannelMember>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageReaction> MessageReactions => Set<MessageReaction>();
    public DbSet<ChannelKickRecord> ChannelKickRecords => Set<ChannelKickRecord>();
    public DbSet<ChannelJoinRequest> ChannelJoinRequests => Set<ChannelJoinRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User indexes
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        // Channel Owner relationship
        modelBuilder.Entity<Channel>()
            .HasOne(c => c.Owner)
            .WithMany()
            .HasForeignKey(c => c.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        // ChannelMember composite primary key
        modelBuilder.Entity<ChannelMember>()
            .HasKey(cm => new { cm.ChannelId, cm.UserId });

        modelBuilder.Entity<ChannelMember>()
            .HasOne(cm => cm.Channel)
            .WithMany(c => c.Members)
            .HasForeignKey(cm => cm.ChannelId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ChannelMember>()
            .HasOne(cm => cm.User)
            .WithMany(u => u.ChannelMemberships)
            .HasForeignKey(cm => cm.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Message relationships
        modelBuilder.Entity<Message>()
            .HasOne(m => m.Sender)
            .WithMany(u => u.Messages)
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.Channel)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.ChannelId)
            .OnDelete(DeleteBehavior.Cascade);

        // MessageReaction relationships
        modelBuilder.Entity<MessageReaction>()
            .HasOne(r => r.Message)
            .WithMany(m => m.Reactions)
            .HasForeignKey(r => r.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MessageReaction>()
            .HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Workspace InviteCode unique index
        modelBuilder.Entity<Workspace>()
            .HasIndex(w => w.InviteCode)
            .IsUnique();

        // Workspace Owner relationship
        modelBuilder.Entity<Workspace>()
            .HasOne(w => w.Owner)
            .WithMany()
            .HasForeignKey(w => w.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        // WorkspaceMember composite primary key
        modelBuilder.Entity<WorkspaceMember>()
            .HasKey(wm => new { wm.WorkspaceId, wm.UserId });

        modelBuilder.Entity<WorkspaceMember>()
            .HasOne(wm => wm.Workspace)
            .WithMany(w => w.Members)
            .HasForeignKey(wm => wm.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<WorkspaceMember>()
            .HasOne(wm => wm.User)
            .WithMany(u => u.WorkspaceMemberships)
            .HasForeignKey(wm => wm.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Channel Workspace relationship
        modelBuilder.Entity<Channel>()
            .HasOne(c => c.Workspace)
            .WithMany(w => w.Channels)
            .HasForeignKey(c => c.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Seed default public community workspace
        modelBuilder.Entity<Workspace>().HasData(
            new Workspace
            {
                Id = 1,
                Name = "PulseChat Community",
                Description = "Default public community workspace for team discussion and collaboration.",
                InviteCode = "PULSE-DEMO",
                OwnerId = 1,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );

        // Seed default public channels
        modelBuilder.Entity<Channel>().HasData(
            new Channel
            {
                Id = 1,
                WorkspaceId = 1,
                Name = "general",
                Description = "General discussion for this workspace",
                Type = "text",
                IsDirectMessage = false,
                IsPrivate = false,
                IsProtected = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Channel
            {
                Id = 2,
                WorkspaceId = 1,
                Name = "general-voice",
                Description = "Default voice lounge for team discussions and hangouts.",
                Type = "voice",
                IsDirectMessage = false,
                IsPrivate = false,
                IsProtected = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
