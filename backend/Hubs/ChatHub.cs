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
    private readonly VoiceTracker _voiceTracker;

    public ChatHub(AppDbContext db, PresenceTracker presenceTracker, VoiceTracker voiceTracker)
    {
        _db = db;
        _presenceTracker = presenceTracker;
        _voiceTracker = voiceTracker;
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

        // Send current voice room active participants to caller
        var allVoiceParticipants = _voiceTracker.GetAllParticipants();
        await Clients.Caller.SendAsync("AllVoiceParticipants", allVoiceParticipants);

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

        // Clean up voice participant if connection was in a voice channel
        var voiceRemoval = _voiceTracker.RemoveUser(Context.ConnectionId);
        if (voiceRemoval.HasValue)
        {
            var (channelId, removedParticipant) = voiceRemoval.Value;
            var payload = new
            {
                channelId = channelId,
                userId = removedParticipant.UserId,
                connectionId = Context.ConnectionId
            };

            await Clients.Group($"voice-channel-{channelId}").SendAsync("UserLeftVoice", payload);
            if (removedParticipant.WorkspaceId.HasValue)
            {
                await Clients.Group($"workspace-{removedParticipant.WorkspaceId.Value}").SendAsync("UserLeftVoice", payload);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    private async Task<bool> CanUserAccessChannelAsync(int userId, Channel channel)
    {
        if (channel.WorkspaceId.HasValue)
        {
            var isWsMember = await _db.WorkspaceMembers
                .AnyAsync(wm => wm.WorkspaceId == channel.WorkspaceId.Value && wm.UserId == userId);
            if (!isWsMember)
                return false;
        }

        var isKicked = await _db.ChannelKickRecords
            .AnyAsync(k => k.ChannelId == channel.Id && k.UserId == userId);
        if (isKicked)
            return false;

        if (channel.IsDirectMessage || channel.IsPrivate)
        {
            var isMember = await _db.ChannelMembers
                .AnyAsync(m => m.ChannelId == channel.Id && m.UserId == userId);
            if (!isMember)
                return false;
        }

        return true;
    }

    public async Task JoinChannel(int channelId)
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return;

        var channel = await _db.Channels.FindAsync(channelId);
        if (channel == null || !await CanUserAccessChannelAsync(userId, channel))
            return;

        await Groups.AddToGroupAsync(Context.ConnectionId, $"channel-{channelId}");
    }

    public async Task LeaveChannel(int channelId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"channel-{channelId}");
    }

    public async Task JoinWorkspace(int workspaceId)
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return;

        var isMember = await _db.WorkspaceMembers
            .AnyAsync(wm => wm.WorkspaceId == workspaceId && wm.UserId == userId);
        if (!isMember)
            return;

        await Groups.AddToGroupAsync(Context.ConnectionId, $"workspace-{workspaceId}");

        var kickedChannelIds = await _db.ChannelKickRecords
            .Where(k => k.UserId == userId)
            .Select(k => k.ChannelId)
            .ToListAsync();

        var publicChannels = await _db.Channels
            .Where(c => c.WorkspaceId == workspaceId && !c.IsDirectMessage && !c.IsPrivate && !kickedChannelIds.Contains(c.Id))
            .Select(c => c.Id)
            .ToListAsync();

        foreach (var chId in publicChannels)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"channel-{chId}");
        }
    }

    public async Task LeaveWorkspace(int workspaceId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"workspace-{workspaceId}");
    }

    public async Task SendMessage(SendMessageDto messageDto)
    {
        if (string.IsNullOrWhiteSpace(messageDto.Content) || messageDto.Content.Length > 4000)
            return;

        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var senderId))
            return;

        var sender = await _db.Users.FindAsync(senderId);
        if (sender == null)
            return;

        var channel = await _db.Channels.FindAsync(messageDto.ChannelId);
        if (channel == null || !await CanUserAccessChannelAsync(senderId, channel))
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

        if (channel.IsDirectMessage)
        {
            var dmMembers = await _db.ChannelMembers
                .Include(cm => cm.User)
                .Where(cm => cm.ChannelId == channel.Id)
                .ToListAsync();

            bool anyChanged = false;
            foreach (var m in dmMembers)
            {
                if (m.IsClosed)
                {
                    m.IsClosed = false;
                    anyChanged = true;
                }
            }
            if (anyChanged)
            {
                await _db.SaveChangesAsync();
            }

            foreach (var m in dmMembers)
            {
                var otherMember = dmMembers.FirstOrDefault(x => x.UserId != m.UserId)?.User;
                var dmDto = new ChannelDto
                {
                    Id = channel.Id,
                    Name = otherMember != null ? otherMember.Username : channel.Name,
                    Type = "text",
                    IsDirectMessage = true,
                    IsPrivate = true,
                    CreatedAt = channel.CreatedAt,
                    Members = dmMembers.Select(x => new UserDto
                    {
                        Id = x.User.Id,
                        Username = x.User.Username,
                        Email = x.User.Email,
                        AvatarUrl = x.User.AvatarUrl,
                        CreatedAt = x.User.CreatedAt,
                        IsOnline = _presenceTracker.IsUserOnline(x.User.Username),
                        Role = x.Role
                    }).ToList(),
                    LastMessage = resultDto
                };

                await Clients.Group($"user-{m.UserId}").SendAsync("ChannelCreated", dmDto);
                await Clients.Group($"user-{m.UserId}").SendAsync("ReceiveMessage", resultDto);
            }
        }

        // Broadcast to everyone in channel
        await Clients.Group($"channel-{messageDto.ChannelId}").SendAsync("ReceiveMessage", resultDto);
    }

    public async Task SendReaction(SendReactionDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Emoji) || dto.Emoji.Length > 32)
            return;

        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return;

        var username = Context.User?.Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return;

        var channel = await _db.Channels.FindAsync(dto.ChannelId);
        if (channel == null || !await CanUserAccessChannelAsync(userId, channel))
            return;

        var message = await _db.Messages.FindAsync(dto.MessageId);
        if (message == null || message.ChannelId != dto.ChannelId)
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
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return;

        var username = Context.User?.Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return;

        var channel = await _db.Channels.FindAsync(channelId);
        if (channel == null || !await CanUserAccessChannelAsync(userId, channel))
            return;

        var notification = new TypingNotificationDto
        {
            ChannelId = channelId,
            Username = username,
            IsTyping = isTyping
        };

        await Clients.OthersInGroup($"channel-{channelId}").SendAsync("UserTyping", notification);
    }

    #region Voice Signaling & Real-Time Methods

    public async Task JoinVoiceChannel(int channelId, bool isMuted = false, bool isDeafened = false)
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return;

        var username = Context.User?.Identity?.Name ?? "User";
        var user = await _db.Users.FindAsync(userId);
        var channel = await _db.Channels.FindAsync(channelId);
        if (channel == null || channel.Type != "voice" || !await CanUserAccessChannelAsync(userId, channel))
            return;

        var participant = new VoiceParticipantDto
        {
            UserId = userId,
            Username = username,
            AvatarUrl = user?.AvatarUrl,
            ConnectionId = Context.ConnectionId,
            ChannelId = channelId,
            WorkspaceId = channel.WorkspaceId,
            IsMuted = isMuted,
            IsDeafened = isDeafened,
            JoinedAt = DateTime.UtcNow
        };

        var (currentList, previousChannelId) = _voiceTracker.AddUser(channelId, participant);

        // If user was in a different channel before, notify left old room
        if (previousChannelId.HasValue && previousChannelId.Value != channelId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"voice-channel-{previousChannelId.Value}");
            var leftPayload = new
            {
                channelId = previousChannelId.Value,
                userId = userId,
                connectionId = Context.ConnectionId
            };
            await Clients.Group($"voice-channel-{previousChannelId.Value}").SendAsync("UserLeftVoice", leftPayload);
            if (channel.WorkspaceId.HasValue)
            {
                await Clients.Group($"workspace-{channel.WorkspaceId.Value}").SendAsync("UserLeftVoice", leftPayload);
            }
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"voice-channel-{channelId}");

        // 1. Send caller the full list of existing participants currently in this voice room
        await Clients.Caller.SendAsync("VoiceParticipantsList", channelId, currentList);

        // 2. Notify other participants in the voice room and workspace
        await Clients.OthersInGroup($"voice-channel-{channelId}").SendAsync("UserJoinedVoice", participant);
        if (channel.WorkspaceId.HasValue)
        {
            await Clients.OthersInGroup($"workspace-{channel.WorkspaceId.Value}").SendAsync("UserJoinedVoice", participant);
        }
    }

    public async Task LeaveVoiceChannel(int channelId)
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int.TryParse(userIdClaim, out var userId);

        _voiceTracker.RemoveUser(Context.ConnectionId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"voice-channel-{channelId}");

        var channel = await _db.Channels.FindAsync(channelId);
        var payload = new
        {
            channelId = channelId,
            userId = userId,
            connectionId = Context.ConnectionId
        };

        await Clients.Group($"voice-channel-{channelId}").SendAsync("UserLeftVoice", payload);
        if (channel?.WorkspaceId.HasValue == true)
        {
            await Clients.Group($"workspace-{channel.WorkspaceId.Value}").SendAsync("UserLeftVoice", payload);
        }
    }

    public async Task SendVoiceOffer(string targetConnectionId, string sdp)
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int.TryParse(userIdClaim, out var userId);
        var username = Context.User?.Identity?.Name ?? "";

        await Clients.Client(targetConnectionId).SendAsync("ReceiveVoiceOffer", new
        {
            senderConnectionId = Context.ConnectionId,
            senderUserId = userId,
            senderUsername = username,
            sdp = sdp
        });
    }

    public async Task SendVoiceAnswer(string targetConnectionId, string sdp)
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int.TryParse(userIdClaim, out var userId);
        var username = Context.User?.Identity?.Name ?? "";

        await Clients.Client(targetConnectionId).SendAsync("ReceiveVoiceAnswer", new
        {
            senderConnectionId = Context.ConnectionId,
            senderUserId = userId,
            senderUsername = username,
            sdp = sdp
        });
    }

    public async Task SendIceCandidate(string targetConnectionId, object candidate)
    {
        await Clients.Client(targetConnectionId).SendAsync("ReceiveIceCandidate", new
        {
            senderConnectionId = Context.ConnectionId,
            candidate = candidate
        });
    }

    public async Task ToggleVoiceState(int channelId, bool isMuted, bool isDeafened)
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int.TryParse(userIdClaim, out var userId);

        _voiceTracker.UpdateState(Context.ConnectionId, isMuted, isDeafened);

        var channel = await _db.Channels.FindAsync(channelId);
        var payload = new
        {
            channelId = channelId,
            userId = userId,
            connectionId = Context.ConnectionId,
            isMuted = isMuted,
            isDeafened = isDeafened
        };

        await Clients.Group($"voice-channel-{channelId}").SendAsync("UserVoiceStateChanged", payload);
        if (channel?.WorkspaceId.HasValue == true)
        {
            await Clients.Group($"workspace-{channel.WorkspaceId.Value}").SendAsync("UserVoiceStateChanged", payload);
        }
    }

    #endregion
}
