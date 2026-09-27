using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PulseChat.Api.Data;
using PulseChat.Api.DTOs;
using PulseChat.Api.Models;
using PulseChat.Api.Services;

namespace PulseChat.Api.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly AppDbContext _db;
    private readonly PresenceTracker _presenceTracker;

    public ChatHub(AppDbContext db, PresenceTracker presenceTracker)
    {
        _db = db;
        _presenceTracker = presenceTracker;
    }

    public override async Task OnConnectedAsync()
    {
        var username = Context.User?.Identity?.Name;
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!string.IsNullOrEmpty(username))
        {
            var isFirstConnection = await _presenceTracker.UserConnected(username, Context.ConnectionId);
            if (isFirstConnection)
            {
                await Clients.Others.SendAsync("UserWentOnline", username);
            }

            var currentOnline = await _presenceTracker.GetOnlineUsers();
            await Clients.Caller.SendAsync("GetOnlineUsers", currentOnline);
        }

        // Automatically subscribe user's connection to their workspaces, public channels, and personal DMs
        // This ensures unread badges and workspace events light up in real time!
        if (int.TryParse(userIdClaim, out var userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");

            var userWorkspaces = await _db.WorkspaceMembers
                .Where(wm => wm.UserId == userId)
                .Select(wm => wm.WorkspaceId)
                .ToListAsync();

            foreach (var wsId in userWorkspaces)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"workspace-{wsId}");
            }

            var kickedChannelIds = await _db.ChannelKickRecords
                .Where(k => k.UserId == userId)
                .Select(k => k.ChannelId)
                .ToListAsync();

            var userChannels = await _db.Channels
                .Where(c => (c.Members.Any(m => m.UserId == userId) ||
                           (!c.IsDirectMessage && !c.IsPrivate && c.WorkspaceId.HasValue && userWorkspaces.Contains(c.WorkspaceId.Value)))
                           && !kickedChannelIds.Contains(c.Id))
                .Select(c => c.Id)
                .ToListAsync();

            foreach (var chId in userChannels)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"channel-{chId}");
            }
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var username = Context.User?.Identity?.Name;
        if (!string.IsNullOrEmpty(username))
        {
            var isCompletelyOffline = await _presenceTracker.UserDisconnected(username, Context.ConnectionId);
            if (isCompletelyOffline)
            {
                await Clients.Others.SendAsync("UserWentOffline", username);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinChannel(int channelId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"channel-{channelId}");
    }

    public async Task LeaveChannel(int channelId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"channel-{channelId}");
    }

    public async Task JoinWorkspace(int workspaceId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"workspace-{workspaceId}");
    }

    public async Task LeaveWorkspace(int workspaceId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"workspace-{workspaceId}");
    }

    public async Task SendMessage(SendMessageDto messageDto)
    {
        if (string.IsNullOrWhiteSpace(messageDto.Content))
            return;

        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var senderId))
            return;

        var sender = await _db.Users.FindAsync(senderId);
        if (sender == null)
            return;

        var channel = await _db.Channels.FindAsync(messageDto.ChannelId);
        if (channel == null)
            return;

        var message = new Message
        {
            ChannelId = messageDto.ChannelId,
            SenderId = senderId,
            Content = messageDto.Content.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.Messages.Add(message);
        await _db.SaveChangesAsync();

        // Automatically mark message as read for the sender
        var senderMember = await _db.ChannelMembers
            .FirstOrDefaultAsync(cm => cm.ChannelId == messageDto.ChannelId && cm.UserId == senderId);
        if (senderMember != null)
        {
            senderMember.LastReadMessageId = message.Id;
            senderMember.LastReadAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        var resultDto = new MessageDto
        {
            Id = message.Id,
            ChannelId = message.ChannelId,
            WorkspaceId = channel.WorkspaceId,
            SenderId = sender.Id,
            SenderUsername = sender.Username,
            SenderAvatarUrl = sender.AvatarUrl,
            Content = message.Content,
            CreatedAt = message.CreatedAt,
            Reactions = new()
        };

        // Broadcast to everyone in channel
        await Clients.Group($"channel-{messageDto.ChannelId}").SendAsync("ReceiveMessage", resultDto);
    }

    public async Task SendReaction(SendReactionDto dto)
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return;

        var username = Context.User?.Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return;

        var message = await _db.Messages.FindAsync(dto.MessageId);
        if (message == null)
            return;

        var existing = await _db.MessageReactions
            .FirstOrDefaultAsync(r => r.MessageId == dto.MessageId && r.UserId == userId && r.Emoji == dto.Emoji);

        bool isAdded = false;
        if (existing != null)
        {
            // Toggle off reaction
            _db.MessageReactions.Remove(existing);
        }
        else
        {
            // Add reaction
            var reaction = new MessageReaction
            {
                MessageId = dto.MessageId,
                UserId = userId,
                Emoji = dto.Emoji,
                CreatedAt = DateTime.UtcNow
            };
            _db.MessageReactions.Add(reaction);
            isAdded = true;
        }

        await _db.SaveChangesAsync();

        var notification = new ReactionNotificationDto
        {
            ChannelId = dto.ChannelId,
            MessageId = dto.MessageId,
            Emoji = dto.Emoji,
            Username = username,
            IsAdded = isAdded
        };

        // Real-time broadcast to all clients in the channel
        await Clients.Group($"channel-{dto.ChannelId}").SendAsync("ReceiveReaction", notification);
    }

    public async Task SendTyping(int channelId, bool isTyping)
    {
        var username = Context.User?.Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return;

        var notification = new TypingNotificationDto
        {
            ChannelId = channelId,
            Username = username,
            IsTyping = isTyping
        };

        await Clients.OthersInGroup($"channel-{channelId}").SendAsync("UserTyping", notification);
    }
}
