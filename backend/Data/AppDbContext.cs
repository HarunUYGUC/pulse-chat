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
    public DbSet<Channel> Channels => Set<Channel>();
    public DbSet<ChannelMember> ChannelMembers => Set<ChannelMember>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageReaction> MessageReactions => Set<MessageReaction>();

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

        // Seed default public channels
        modelBuilder.Entity<Channel>().HasData(
            new Channel
            {
                Id = 1,
                Name = "general",
                Description = "Public announcements, introductions, and team chats",
                IsDirectMessage = false,
                IsPrivate = false,
                IsProtected = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Channel
            {
                Id = 2,
                Name = "random",
                Description = "Watercooler conversations, fun links, and memes",
                IsDirectMessage = false,
                IsPrivate = false,
                IsProtected = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            },
            new Channel
            {
                Id = 3,
                Name = "dev",
                Description = "Engineering discussions, code reviews, and architecture debates",
                IsDirectMessage = false,
                IsPrivate = false,
                IsProtected = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
