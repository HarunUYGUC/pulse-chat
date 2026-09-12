using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PulseChat.Api.Data;
using PulseChat.Api.DTOs;
using PulseChat.Api.Hubs;
using PulseChat.Api.Models;
using PulseChat.Api.Services;

namespace PulseChat.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ChannelsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PresenceTracker _presenceTracker;
    private readonly IHubContext<ChatHub> _hubContext;

    public ChannelsController(AppDbContext db, PresenceTracker presenceTracker, IHubContext<ChatHub> hubContext)
    {
        _db = db;
        _presenceTracker = presenceTracker;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<ActionResult<List<ChannelDto>>> GetChannels()
    {
        var currentUserId = GetCurrentUserId();

        // Discord model: ensure user is a member of all public channels
        var missingPublicChannels = await _db.Channels
            .Where(c => !c.IsDirectMessage && !c.IsPrivate && !c.Members.Any(m => m.UserId == currentUserId))
            .ToListAsync();

        if (missingPublicChannels.Count > 0)
        {
            foreach (var ch in missingPublicChannels)
            {
                _db.ChannelMembers.Add(new ChannelMember
                {
                    ChannelId = ch.Id,
                    UserId = currentUserId,
                    JoinedAt = DateTime.UtcNow
                });
            }
            await _db.SaveChangesAsync();
        }

        // 1. Get all channels where current user is a member
        var userChannels = await _db.Channels
            .Where(c => c.Members.Any(m => m.UserId == currentUserId))
            .Include(c => c.Owner)
            .Include(c => c.Members)
                .ThenInclude(m => m.User)
            .OrderBy(c => c.IsDirectMessage ? 1 : 0)
            .ThenBy(c => c.Id)
            .ToListAsync();

        var allIds = userChannels.Select(c => c.Id).ToList();

        // SQLite-compatible retrieval of latest message per channel
        var latestMessagesList = await _db.Messages
            .Where(m => allIds.Contains(m.ChannelId))
            .Include(m => m.Sender)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();

        var lastMessageMap = latestMessagesList
            .GroupBy(m => m.ChannelId)
            .ToDictionary(g => g.Key, g => g.First());

        var dtoList = userChannels.Select(c =>
        {
            var member = c.Members.FirstOrDefault(m => m.UserId == currentUserId);
            var lastReadId = member?.LastReadMessageId;

            var unreadCount = latestMessagesList
                .Where(m => m.ChannelId == c.Id && m.Id > (lastReadId ?? 0) && m.SenderId != currentUserId)
                .Count();

            return MapToDto(c, currentUserId, lastMessageMap.GetValueOrDefault(c.Id), unreadCount, lastReadId);
        }).ToList();
        return Ok(dtoList);
    }

    [HttpGet("browse")]
    public async Task<ActionResult<List<BrowseChannelDto>>> BrowseChannels()
    {
        var currentUserId = GetCurrentUserId();

        // All non-DM channels that are public OR where the user is already a member
        var channels = await _db.Channels
            .Where(c => !c.IsDirectMessage && (!c.IsPrivate || c.Members.Any(m => m.UserId == currentUserId)))
            .Include(c => c.Owner)
            .Include(c => c.Members)
            .OrderBy(c => c.IsProtected ? 0 : 1)
            .ThenBy(c => c.Name)
            .ToListAsync();

        var browseList = channels.Select(c => new BrowseChannelDto
        {
            Id = c.Id,
            Name = c.Name,
            Description = c.Description,
            IsPrivate = c.IsPrivate,
            IsProtected = c.IsProtected,
            MemberCount = c.Members.Count,
            IsMember = c.Members.Any(m => m.UserId == currentUserId),
            OwnerId = c.OwnerId,
            OwnerUsername = c.Owner?.Username,
            CreatedAt = c.CreatedAt
        }).ToList();

        return Ok(browseList);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ChannelDto>> GetChannelById(int id)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Owner)
            .Include(c => c.Members)
                .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if ((channel.IsDirectMessage || channel.IsPrivate) && !channel.Members.Any(m => m.UserId == currentUserId))
            return Forbid();

        var lastMessage = await _db.Messages
            .Where(m => m.ChannelId == id)
            .Include(m => m.Sender)
            .OrderByDescending(m => m.CreatedAt)
            .FirstOrDefaultAsync();

        return Ok(MapToDto(channel, currentUserId, lastMessage));
    }

    [HttpPost]
    public async Task<ActionResult<ChannelDto>> CreateChannel([FromBody] CreateChannelDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = GetCurrentUserId();
        var normalizedName = dto.Name.Trim().ToLowerInvariant().Replace(" ", "-");

        if (await _db.Channels.AnyAsync(c => !c.IsDirectMessage && c.Name.ToLower() == normalizedName))
        {
            return BadRequest(new { message = $"Channel #{normalizedName} already exists." });
        }

        var channel = new Channel
        {
            Name = normalizedName,
            Description = dto.Description?.Trim(),
            IsDirectMessage = false,
            IsPrivate = dto.IsPrivate,
            IsProtected = false,
            OwnerId = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Channels.Add(channel);
        await _db.SaveChangesAsync();

        // Add creator as member
        _db.ChannelMembers.Add(new ChannelMember
        {
            ChannelId = channel.Id,
            UserId = currentUserId,
            JoinedAt = DateTime.UtcNow
        });

        if (!dto.IsPrivate)
        {
            // Discord model: all workspace users automatically join public channels
            var otherUsers = await _db.Users.Where(u => u.Id != currentUserId).ToListAsync();
            foreach (var u in otherUsers)
            {
                _db.ChannelMembers.Add(new ChannelMember
                {
                    ChannelId = channel.Id,
                    UserId = u.Id,
                    JoinedAt = DateTime.UtcNow
                });
            }
        }
        else if (dto.InitialMemberIds != null && dto.InitialMemberIds.Count > 0)
        {
            // If private channel and initial members were selected, add them
            foreach (var targetId in dto.InitialMemberIds.Distinct())
            {
                if (targetId != currentUserId && await _db.Users.AnyAsync(u => u.Id == targetId))
                {
                    _db.ChannelMembers.Add(new ChannelMember
                    {
                        ChannelId = channel.Id,
                        UserId = targetId,
                        JoinedAt = DateTime.UtcNow
                    });
                }
            }
        }

        await _db.SaveChangesAsync();

        // Reload with members and owner
        var created = await _db.Channels
            .Include(c => c.Owner)
            .Include(c => c.Members).ThenInclude(m => m.User)
            .FirstAsync(c => c.Id == channel.Id);

        var channelDto = MapToDto(created, currentUserId, null);

        // Real-time broadcast:
        if (!channel.IsPrivate)
        {
            // Public channel: broadcast to everyone in the workspace
            await _hubContext.Clients.All.SendAsync("ChannelCreated", channelDto);
        }
        else
        {
            // Private channel: notify only invited participants
            foreach (var member in created.Members)
            {
                await _hubContext.Clients.Group($"user-{member.UserId}").SendAsync("ChannelCreated", channelDto);
            }
        }

        return CreatedAtAction(nameof(GetChannelById), new { id = channel.Id }, channelDto);
    }

    [HttpPost("{id}/join")]
    public async Task<ActionResult<ChannelDto>> JoinChannel(int id)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Owner)
            .Include(c => c.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if (channel.IsDirectMessage)
            return BadRequest(new { message = "Cannot join a direct message." });

        if (channel.IsPrivate && !channel.Members.Any(m => m.UserId == currentUserId))
            return Forbid();

        var isAlreadyMember = channel.Members.Any(m => m.UserId == currentUserId);
        if (!isAlreadyMember)
        {
            _db.ChannelMembers.Add(new ChannelMember
            {
                ChannelId = channel.Id,
                UserId = currentUserId,
                JoinedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();

            // Reload members
            await _db.Entry(channel).Collection(c => c.Members).Query().Include(m => m.User).LoadAsync();

            var joiningMember = channel.Members.FirstOrDefault(m => m.UserId == currentUserId);
            if (joiningMember?.User != null)
            {
                var userDto = new UserDto
                {
                    Id = joiningMember.User.Id,
                    Username = joiningMember.User.Username,
                    Email = joiningMember.User.Email,
                    AvatarUrl = joiningMember.User.AvatarUrl,
                    CreatedAt = joiningMember.User.CreatedAt,
                    IsOnline = _presenceTracker.IsUserOnline(joiningMember.User.Username)
                };

                if (!channel.IsPrivate)
                {
                    await _hubContext.Clients.All.SendAsync("UserJoinedChannel", new { channelId = id, user = userDto });
                }
                else
                {
                    await _hubContext.Clients.Group($"channel-{id}").SendAsync("UserJoinedChannel", new { channelId = id, user = userDto });
                }
            }
        }

        var dto = MapToDto(channel, currentUserId, null);
        return Ok(dto);
    }

    [HttpPost("{id}/leave")]
    public async Task<IActionResult> LeaveChannel(int id)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if (channel.IsProtected)
            return BadRequest(new { message = "You cannot leave default protected channels (like #general)." });

        if (channel.IsDirectMessage)
            return BadRequest(new { message = "Cannot leave a direct message." });

        if (channel.OwnerId.HasValue && channel.OwnerId.Value == currentUserId)
            return BadRequest(new { message = "Channel owners cannot leave their own channel. Please delete the channel instead." });

        var membership = channel.Members.FirstOrDefault(m => m.UserId == currentUserId);
        if (membership != null)
        {
            _db.ChannelMembers.Remove(membership);
            await _db.SaveChangesAsync();

            if (!channel.IsPrivate)
            {
                await _hubContext.Clients.All.SendAsync("UserLeftChannel", new { channelId = id, userId = currentUserId });
            }
            else
            {
                await _hubContext.Clients.Group($"channel-{id}").SendAsync("UserLeftChannel", new { channelId = id, userId = currentUserId });
            }
        }

        return Ok(new { message = "Left channel successfully." });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteChannel(int id)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Members)
            .Include(c => c.Messages)
                .ThenInclude(m => m.Reactions)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if (channel.IsProtected)
            return BadRequest(new { message = "Default system channels (#general, #random, #dev) cannot be deleted." });

        // Allow deletion if current user is owner OR if legacy channel has no owner and user is a member
        bool canDelete = (channel.OwnerId.HasValue && channel.OwnerId.Value == currentUserId)
                      || (!channel.OwnerId.HasValue && channel.Members.Any(m => m.UserId == currentUserId));

        if (!canDelete)
            return StatusCode(403, new { message = "Only the channel creator can delete this channel." });

        // Cleanly remove child entities to ensure complete cascade deletion
        if (channel.Messages.Any())
        {
            foreach (var msg in channel.Messages)
            {
                if (msg.Reactions.Any())
                {
                    _db.MessageReactions.RemoveRange(msg.Reactions);
                }
            }
            _db.Messages.RemoveRange(channel.Messages);
        }

        if (channel.Members.Any())
        {
            _db.ChannelMembers.RemoveRange(channel.Members);
        }

        _db.Channels.Remove(channel);
        await _db.SaveChangesAsync();

        // Broadcast to all clients to evict viewers and remove from sidebars
        await _hubContext.Clients.All.SendAsync("ChannelDeleted", id);

        return NoContent();
    }

    [HttpPost("{id}/invite")]
    public async Task<ActionResult<ChannelDto>> InviteMembers(int id, [FromBody] InviteMembersDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Owner)
            .Include(c => c.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if (channel.IsDirectMessage)
            return BadRequest(new { message = "Cannot invite members to a direct message." });

        // Only existing members can invite others
        if (!channel.Members.Any(m => m.UserId == currentUserId))
            return StatusCode(403, new { message = "Only channel members can invite others." });

        var existingMemberIds = channel.Members.Select(m => m.UserId).ToHashSet();
        var newMemberIds = dto.UserIds.Distinct().Where(uid => !existingMemberIds.Contains(uid)).ToList();

        if (newMemberIds.Count == 0)
            return Ok(MapToDto(channel, currentUserId, null));

        var usersToAdd = await _db.Users.Where(u => newMemberIds.Contains(u.Id)).ToListAsync();
        foreach (var user in usersToAdd)
        {
            _db.ChannelMembers.Add(new ChannelMember
            {
                ChannelId = channel.Id,
                UserId = user.Id,
                JoinedAt = DateTime.UtcNow
            });
        }
        await _db.SaveChangesAsync();

        // Reload members
        await _db.Entry(channel).Collection(c => c.Members).Query().Include(m => m.User).LoadAsync();

        var updatedChannelDto = MapToDto(channel, currentUserId, null);

        // 1. Notify each newly invited user via their personal group so the channel appears in their sidebar immediately
        foreach (var user in usersToAdd)
        {
            var userSpecificDto = MapToDto(channel, user.Id, null);
            await _hubContext.Clients.Group($"user-{user.Id}").SendAsync("ChannelCreated", userSpecificDto);
        }

        // 2. Broadcast UserJoinedChannel to the channel group for each added user so active members see member count & sidebar update
        foreach (var user in usersToAdd)
        {
            var userDto = new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                AvatarUrl = user.AvatarUrl,
                CreatedAt = user.CreatedAt,
                IsOnline = _presenceTracker.IsUserOnline(user.Username)
            };
            await _hubContext.Clients.Group($"channel-{channel.Id}").SendAsync("UserJoinedChannel", new { channelId = channel.Id, user = userDto });
        }

        return Ok(updatedChannelDto);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ChannelDto>> UpdateChannel(int id, [FromBody] UpdateChannelDto dto)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Owner)
            .Include(c => c.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if (channel.IsDirectMessage)
            return BadRequest(new { message = "Cannot edit direct messages." });

        bool canEdit = (channel.OwnerId.HasValue && channel.OwnerId.Value == currentUserId)
                    || (!channel.OwnerId.HasValue && channel.Members.Any(m => m.UserId == currentUserId));

        if (!canEdit)
            return StatusCode(403, new { message = "Only channel creator can edit channel details." });

        channel.Description = dto.Description?.Trim();
        await _db.SaveChangesAsync();

        var updatedDto = MapToDto(channel, currentUserId, null);
        await _hubContext.Clients.All.SendAsync("ChannelUpdated", updatedDto);

        return Ok(updatedDto);
    }

    [HttpPost("dm")]
    public async Task<ActionResult<ChannelDto>> CreateOrGetDm([FromBody] CreateDmDto dto)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == dto.TargetUserId)
            return BadRequest(new { message = "Cannot create direct message with yourself." });

        var targetUser = await _db.Users.FindAsync(dto.TargetUserId);
        if (targetUser == null)
            return NotFound(new { message = "Target user not found." });

        // Check if DM channel already exists between these 2 users
        var existingDm = await _db.Channels
            .Where(c => c.IsDirectMessage
                && c.Members.Count == 2
                && c.Members.Any(m => m.UserId == currentUserId)
                && c.Members.Any(m => m.UserId == dto.TargetUserId))
            .Include(c => c.Owner)
            .Include(c => c.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync();

        if (existingDm != null)
        {
            var lastMsg = await _db.Messages
                .Where(m => m.ChannelId == existingDm.Id)
                .Include(m => m.Sender)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync();

            return Ok(MapToDto(existingDm, currentUserId, lastMsg));
        }

        // Create new DM channel
        var dmChannel = new Channel
        {
            Name = $"dm-{Math.Min(currentUserId, dto.TargetUserId)}-{Math.Max(currentUserId, dto.TargetUserId)}",
            IsDirectMessage = true,
            IsPrivate = true,
            IsProtected = false,
            OwnerId = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Channels.Add(dmChannel);
        await _db.SaveChangesAsync();

        _db.ChannelMembers.AddRange(
            new ChannelMember { ChannelId = dmChannel.Id, UserId = currentUserId, JoinedAt = DateTime.UtcNow },
            new ChannelMember { ChannelId = dmChannel.Id, UserId = dto.TargetUserId, JoinedAt = DateTime.UtcNow }
        );
        await _db.SaveChangesAsync();

        // Reload to include members
        var created = await _db.Channels
            .Include(c => c.Owner)
            .Include(c => c.Members).ThenInclude(m => m.User)
            .FirstAsync(c => c.Id == dmChannel.Id);

        var dtoForCreator = MapToDto(created, currentUserId, null);
        var dtoForTarget = MapToDto(created, dto.TargetUserId, null);

        // Notify both participants in real-time
        await _hubContext.Clients.Group($"user-{currentUserId}").SendAsync("ChannelCreated", dtoForCreator);
        await _hubContext.Clients.Group($"user-{dto.TargetUserId}").SendAsync("ChannelCreated", dtoForTarget);

        return Ok(dtoForCreator);
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    [HttpPost("{id}/read")]
    public async Task<ActionResult> MarkAsRead(int id, [FromBody] MarkReadDto? dto = null)
    {
        var currentUserId = GetCurrentUserId();
        var member = await _db.ChannelMembers
            .FirstOrDefaultAsync(cm => cm.ChannelId == id && cm.UserId == currentUserId);

        if (member == null)
            return NotFound(new { message = "Channel membership not found." });

        int targetMessageId;
        if (dto?.MessageId.HasValue == true && dto.MessageId.Value > 0)
        {
            targetMessageId = dto.MessageId.Value;
        }
        else
        {
            targetMessageId = await _db.Messages
                .Where(m => m.ChannelId == id)
                .OrderByDescending(m => m.Id)
                .Select(m => m.Id)
                .FirstOrDefaultAsync();
        }

        if (targetMessageId > (member.LastReadMessageId ?? 0))
        {
            member.LastReadMessageId = targetMessageId;
            member.LastReadAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return Ok(new { channelId = id, lastReadMessageId = member.LastReadMessageId, unreadCount = 0 });
    }

    private ChannelDto MapToDto(Channel channel, int currentUserId, Message? lastMessage, int unreadCount = 0, int? lastReadMessageId = null)
    {
        // For DMs, show other user's username as channel name
        string displayName = channel.Name;
        if (channel.IsDirectMessage)
        {
            var otherMember = channel.Members.FirstOrDefault(m => m.UserId != currentUserId)?.User;
            if (otherMember != null)
            {
                displayName = otherMember.Username;
            }
        }

        int? effectiveOwnerId = channel.OwnerId;
        string? effectiveOwnerUsername = channel.Owner?.Username;

        if (channel.IsProtected)
        {
            effectiveOwnerId = null;
            effectiveOwnerUsername = null;
        }
        else if (!channel.IsDirectMessage && !effectiveOwnerId.HasValue)
        {
            var firstMember = channel.Members.OrderBy(m => m.JoinedAt).FirstOrDefault();
            effectiveOwnerId = firstMember?.UserId;
            effectiveOwnerUsername = firstMember?.User?.Username;
        }

        lastReadMessageId ??= channel.Members.FirstOrDefault(m => m.UserId == currentUserId)?.LastReadMessageId;

        return new ChannelDto
        {
            Id = channel.Id,
            Name = displayName,
            Description = channel.Description,
            IsDirectMessage = channel.IsDirectMessage,
            IsPrivate = channel.IsPrivate,
            IsProtected = channel.IsProtected,
            OwnerId = effectiveOwnerId,
            OwnerUsername = effectiveOwnerUsername,
            IsMember = channel.Members.Any(m => m.UserId == currentUserId),
            CreatedAt = channel.CreatedAt,
            UnreadCount = unreadCount,
            LastReadMessageId = lastReadMessageId,
            Members = channel.Members.Select(m => new UserDto
            {
                Id = m.User.Id,
                Username = m.User.Username,
                Email = m.User.Email,
                AvatarUrl = m.User.AvatarUrl,
                CreatedAt = m.User.CreatedAt,
                IsOnline = _presenceTracker.IsUserOnline(m.User.Username)
            }).ToList(),
            LastMessage = lastMessage == null ? null : new MessageDto
            {
                Id = lastMessage.Id,
                ChannelId = lastMessage.ChannelId,
                SenderId = lastMessage.SenderId,
                SenderUsername = lastMessage.Sender?.Username ?? "",
                SenderAvatarUrl = lastMessage.Sender?.AvatarUrl,
                Content = lastMessage.Content,
                CreatedAt = lastMessage.CreatedAt
            }
        };
    }
}
