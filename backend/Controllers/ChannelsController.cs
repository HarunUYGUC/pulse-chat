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
    public async Task<ActionResult<List<ChannelDto>>> GetChannels([FromQuery] int? workspaceId = null)
    {
        var currentUserId = GetCurrentUserId();

        List<int> validWorkspaceIds;
        if (workspaceId.HasValue)
        {
            var isMember = await _db.WorkspaceMembers
                .AnyAsync(wm => wm.WorkspaceId == workspaceId.Value && wm.UserId == currentUserId);
            if (!isMember)
                return StatusCode(403, new { message = "You must be a member of this workspace to view its channels." });

            validWorkspaceIds = new List<int> { workspaceId.Value };

            // Auto-join public channels of THIS workspace (excluding channels user was kicked from)
            var kickedChannelIds = await _db.ChannelKickRecords
                .Where(k => k.UserId == currentUserId)
                .Select(k => k.ChannelId)
                .ToListAsync();

            var missingPublicChannels = await _db.Channels
                .Where(c => c.WorkspaceId == workspaceId.Value && !c.IsDirectMessage && !c.IsPrivate 
                            && !c.Members.Any(m => m.UserId == currentUserId)
                            && !kickedChannelIds.Contains(c.Id))
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
        }
        else
        {
            validWorkspaceIds = await _db.WorkspaceMembers
                .Where(wm => wm.UserId == currentUserId)
                .Select(wm => wm.WorkspaceId)
                .ToListAsync();
        }

        // Get IDs of users who share these workspaces with current user (for DMs)
        var mutualUserIds = await _db.WorkspaceMembers
            .Where(wm => validWorkspaceIds.Contains(wm.WorkspaceId) && wm.UserId != currentUserId)
            .Select(wm => wm.UserId)
            .Distinct()
            .ToListAsync();

        // 1. Get channels where current user is a member, scoped to valid workspaces (or mutual DMs with messages and not closed)
        var userChannels = await _db.Channels
            .Where(c =>
                (!c.IsDirectMessage && c.WorkspaceId.HasValue && validWorkspaceIds.Contains(c.WorkspaceId.Value) && c.Members.Any(m => m.UserId == currentUserId))
                ||
                (c.IsDirectMessage && c.Members.Any(m => m.UserId == currentUserId && !m.IsClosed) && c.Members.Any(m => mutualUserIds.Contains(m.UserId)) && _db.Messages.Any(msg => msg.ChannelId == c.Id))
            )
            .Include(c => c.Owner)
            .Include(c => c.Workspace)
                .ThenInclude(w => w.Owner)
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
    public async Task<ActionResult<List<BrowseChannelDto>>> BrowseChannels([FromQuery] int? workspaceId = null)
    {
        var currentUserId = GetCurrentUserId();

        var query = _db.Channels
            .Where(c => !c.IsDirectMessage && (!c.IsPrivate || c.Members.Any(m => m.UserId == currentUserId)));

        if (workspaceId.HasValue)
        {
            var isMember = await _db.WorkspaceMembers
                .AnyAsync(wm => wm.WorkspaceId == workspaceId.Value && wm.UserId == currentUserId);
            if (!isMember)
                return StatusCode(403, new { message = "You must be a member of this workspace to browse its channels." });

            query = query.Where(c => c.WorkspaceId == workspaceId.Value);
        }
        else
        {
            var userWorkspaceIds = await _db.WorkspaceMembers
                .Where(wm => wm.UserId == currentUserId)
                .Select(wm => wm.WorkspaceId)
                .ToListAsync();
            query = query.Where(c => c.WorkspaceId.HasValue && userWorkspaceIds.Contains(c.WorkspaceId.Value));
        }

        var channels = await query
            .Include(c => c.Owner)
            .Include(c => c.Workspace)
                .ThenInclude(w => w.Owner)
            .Include(c => c.Members)
            .OrderBy(c => c.IsProtected ? 0 : 1)
            .ThenBy(c => c.Name)
            .ToListAsync();

        var channelIds = channels.Select(c => c.Id).ToList();

        var userKickedRecords = await _db.ChannelKickRecords
            .Where(k => channelIds.Contains(k.ChannelId) && k.UserId == currentUserId)
            .Include(k => k.KickedBy)
            .ToListAsync();

        var userKickedMap = userKickedRecords
            .GroupBy(k => k.ChannelId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(k => k.KickedAt).First());

        var userPendingRequestChannelIds = (await _db.ChannelJoinRequests
            .Where(r => channelIds.Contains(r.ChannelId) && r.UserId == currentUserId && r.Status == "Pending")
            .Select(r => r.ChannelId)
            .ToListAsync())
            .ToHashSet();

        var browseList = channels.Select(c =>
        {
            var kickRecord = userKickedMap.GetValueOrDefault(c.Id);
            string? kickedByUsername = kickRecord?.KickedBy?.Username;
            string? kickedByRole = null;
            if (kickRecord != null)
            {
                bool isKickerLeader = (c.OwnerId.HasValue && c.OwnerId.Value == kickRecord.KickedById) ||
                    (c.Workspace != null && c.Workspace.OwnerId == kickRecord.KickedById);
                kickedByRole = isKickerLeader ? "Leader" : "Moderator";
            }

            return new BrowseChannelDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                Type = c.Type ?? "text",
                WorkspaceId = c.WorkspaceId,
                IsPrivate = c.IsPrivate,
                IsProtected = c.IsProtected,
                MemberCount = c.Members.Count,
                IsMember = c.Members.Any(m => m.UserId == currentUserId),
                WasKicked = kickRecord != null,
                KickedByUsername = kickedByUsername,
                KickedByRole = kickedByRole,
                HasPendingJoinRequest = userPendingRequestChannelIds.Contains(c.Id),
                OwnerId = c.OwnerId,
                OwnerUsername = c.Owner?.Username,
                CreatedAt = c.CreatedAt
            };
        }).ToList();

        return Ok(browseList);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ChannelDto>> GetChannelById(int id)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Owner)
            .Include(c => c.Workspace)
                .ThenInclude(w => w.Owner)
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

        int targetWorkspaceId = dto.WorkspaceId ?? await _db.WorkspaceMembers
            .Where(wm => wm.UserId == currentUserId)
            .Select(wm => wm.WorkspaceId)
            .FirstOrDefaultAsync();

        if (targetWorkspaceId == 0)
            return BadRequest(new { message = "User does not belong to any workspace. Please create or join a workspace first." });

        var isWorkspaceMember = await _db.WorkspaceMembers
            .AnyAsync(wm => wm.WorkspaceId == targetWorkspaceId && wm.UserId == currentUserId);
        if (!isWorkspaceMember)
            return StatusCode(403, new { message = "You must be a member of the workspace to create a channel in it." });

        if (await _db.Channels.AnyAsync(c => !c.IsDirectMessage && c.WorkspaceId == targetWorkspaceId && c.Name.ToLower() == normalizedName))
        {
            return BadRequest(new { message = $"Channel #{normalizedName} already exists in this workspace." });
        }

        var channelType = dto.Type?.ToLowerInvariant() == "voice" ? "voice" : "text";

        var channel = new Channel
        {
            Name = normalizedName,
            Description = dto.Description?.Trim(),
            WorkspaceId = targetWorkspaceId,
            Type = channelType,
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
            Role = "Owner",
            JoinedAt = DateTime.UtcNow
        });

        if (!dto.IsPrivate)
        {
            // All members of this workspace automatically join public channel
            var workspaceMembers = await _db.WorkspaceMembers
                .Where(wm => wm.WorkspaceId == targetWorkspaceId && wm.UserId != currentUserId)
                .ToListAsync();

            foreach (var wm in workspaceMembers)
            {
                _db.ChannelMembers.Add(new ChannelMember
                {
                    ChannelId = channel.Id,
                    UserId = wm.UserId,
                    Role = "Member",
                    JoinedAt = DateTime.UtcNow
                });
            }
        }
        else if (dto.InitialMemberIds != null && dto.InitialMemberIds.Count > 0)
        {
            // If private channel, add specified initial members who belong to this workspace
            var validWorkspaceMemberIds = await _db.WorkspaceMembers
                .Where(wm => wm.WorkspaceId == targetWorkspaceId && dto.InitialMemberIds.Contains(wm.UserId) && wm.UserId != currentUserId)
                .Select(wm => wm.UserId)
                .ToListAsync();

            foreach (var targetId in validWorkspaceMemberIds)
            {
                _db.ChannelMembers.Add(new ChannelMember
                {
                    ChannelId = channel.Id,
                    UserId = targetId,
                    Role = "Member",
                    JoinedAt = DateTime.UtcNow
                });
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
            await _hubContext.Clients.Group($"workspace-{targetWorkspaceId}").SendAsync("ChannelCreated", channelDto);
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
    public async Task<IActionResult> JoinChannel(int id)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Owner)
            .Include(c => c.Workspace)
                .ThenInclude(w => w.Owner)
            .Include(c => c.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if (channel.IsDirectMessage)
            return BadRequest(new { message = "Cannot join a direct message." });

        if (channel.IsPrivate && !channel.Members.Any(m => m.UserId == currentUserId))
            return Forbid();

        var isAlreadyMember = channel.Members.Any(m => m.UserId == currentUserId);
        if (isAlreadyMember)
        {
            var existingDto = MapToDto(channel, currentUserId, null);
            return Ok(existingDto);
        }

        // Check if user was previously kicked from this channel
        var kickRecord = await _db.ChannelKickRecords
            .FirstOrDefaultAsync(k => k.ChannelId == id && k.UserId == currentUserId);

        if (kickRecord != null)
        {
            // User was previously kicked: create join request for the channel owner instead of joining directly
            var existingRequest = await _db.ChannelJoinRequests
                .FirstOrDefaultAsync(r => r.ChannelId == id && r.UserId == currentUserId && r.Status == "Pending");

            if (existingRequest != null)
            {
                return Ok(new { isPending = true, message = "A join request is already pending approval from the channel leader." });
            }

            var user = await _db.Users.FindAsync(currentUserId);
            var joinRequest = new ChannelJoinRequest
            {
                ChannelId = id,
                UserId = currentUserId,
                RequestedAt = DateTime.UtcNow,
                Status = "Pending",
                WasPreviouslyKicked = true
            };
            _db.ChannelJoinRequests.Add(joinRequest);
            await _db.SaveChangesAsync();

            var joinRequestDto = new ChannelJoinRequestDto
            {
                Id = joinRequest.Id,
                ChannelId = channel.Id,
                ChannelName = channel.Name,
                UserId = currentUserId,
                Username = user?.Username ?? "Unknown",
                AvatarUrl = user?.AvatarUrl,
                RequestedAt = joinRequest.RequestedAt,
                Status = joinRequest.Status,
                WasPreviouslyKicked = true
            };

            // Notify channel leader (owner or workspace owner) and moderators via SignalR
            var notifyUserIds = new HashSet<int>();
            if (channel.OwnerId.HasValue)
            {
                notifyUserIds.Add(channel.OwnerId.Value);
            }
            else if (channel.Workspace != null)
            {
                notifyUserIds.Add(channel.Workspace.OwnerId);
            }
            else if (channel.WorkspaceId.HasValue)
            {
                var wsOwnerId = await _db.Workspaces.Where(w => w.Id == channel.WorkspaceId.Value).Select(w => w.OwnerId).FirstOrDefaultAsync();
                if (wsOwnerId > 0)
                {
                    notifyUserIds.Add(wsOwnerId);
                }
            }

            var modIds = channel.Members.Where(m => m.Role == "Moderator").Select(m => m.UserId).ToList();
            foreach (var mId in modIds)
            {
                notifyUserIds.Add(mId);
            }

            foreach (var targetUserId in notifyUserIds)
            {
                await _hubContext.Clients.Group($"user-{targetUserId}").SendAsync("JoinRequestReceived", joinRequestDto);
            }

            return Ok(new { isPending = true, message = "Join request sent to the channel leader for approval." });
        }

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
            return BadRequest(new { message = "You cannot leave default protected channels (like #general or general-voice)." });

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

    private async Task<(bool isLeader, bool isModerator, bool canManage)> GetUserChannelPermissions(Channel channel, int userId)
    {
        bool isOwner = channel.OwnerId.HasValue && channel.OwnerId.Value == userId;
        bool isWsOwner = false;
        if (channel.WorkspaceId.HasValue)
        {
            isWsOwner = await _db.Workspaces.AnyAsync(w => w.Id == channel.WorkspaceId.Value && w.OwnerId == userId);
        }
        bool isLeader = isOwner || isWsOwner;

        var member = channel.Members.FirstOrDefault(m => m.UserId == userId);
        bool isMod = member != null && member.Role == "Moderator";

        return (isLeader, isMod, isLeader || isMod);
    }

    [HttpDelete("{id}/members/{userId}")]
    public async Task<IActionResult> KickMember(int id, int userId)
    {
        var currentUserId = GetCurrentUserId();

        var channel = await _db.Channels
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if (channel.IsDirectMessage)
            return BadRequest(new { message = "Cannot remove members from direct messages." });

        var (isLeader, isModerator, canManage) = await GetUserChannelPermissions(channel, currentUserId);

        if (!canManage)
        {
            return StatusCode(403, new { message = "Only the channel leader or moderators can remove members from this channel." });
        }

        if (userId == currentUserId)
        {
            return BadRequest(new { message = "You cannot remove yourself from the channel. Use Leave Channel instead." });
        }

        var member = channel.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
        {
            return NotFound(new { message = "User is not a member of this channel." });
        }

        // Cannot kick the channel owner/leader
        bool isTargetLeader = (channel.OwnerId.HasValue && channel.OwnerId.Value == userId) ||
            (channel.WorkspaceId.HasValue && await _db.Workspaces.AnyAsync(w => w.Id == channel.WorkspaceId.Value && w.OwnerId == userId));
        if (isTargetLeader)
        {
            return StatusCode(403, new { message = "Cannot kick the channel leader." });
        }

        // Moderators cannot kick other moderators
        if (!isLeader && member.Role == "Moderator")
        {
            return StatusCode(403, new { message = "Moderators cannot kick other moderators. Only the channel leader can." });
        }

        _db.ChannelMembers.Remove(member);

        // Record the kick so the user cannot directly re-join without approval
        var existingKick = await _db.ChannelKickRecords
            .FirstOrDefaultAsync(k => k.ChannelId == id && k.UserId == userId);
        if (existingKick == null)
        {
            _db.ChannelKickRecords.Add(new ChannelKickRecord
            {
                ChannelId = id,
                UserId = userId,
                KickedById = currentUserId,
                KickedAt = DateTime.UtcNow
            });
        }
        else
        {
            existingKick.KickedById = currentUserId;
            existingKick.KickedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        // 1. Notify members inside the channel
        await _hubContext.Clients.Group($"channel-{id}").SendAsync("UserLeftChannel", new { channelId = id, userId = userId });

        // 2. Notify the kicked user directly to evict them from the channel view
        await _hubContext.Clients.Group($"user-{userId}").SendAsync("ChannelKicked", new { channelId = id, channelName = channel.Name });

        return Ok(new { message = $"User was removed from #{channel.Name}." });
    }

    [HttpPut("{id}/members/{userId}/role")]
    public async Task<IActionResult> UpdateMemberRole(int id, int userId, [FromBody] UpdateChannelMemberRoleDto dto)
    {
        var currentUserId = GetCurrentUserId();

        var channel = await _db.Channels
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if (channel.IsDirectMessage)
            return BadRequest(new { message = "Direct messages do not support member roles." });

        var (isLeader, _, _) = await GetUserChannelPermissions(channel, currentUserId);
        if (!isLeader)
        {
            return StatusCode(403, new { message = "Only the channel leader can assign or remove moderator roles." });
        }

        if (userId == currentUserId)
        {
            return BadRequest(new { message = "Channel leader cannot modify their own role." });
        }

        var member = channel.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
        {
            return NotFound(new { message = "User is not a member of this channel." });
        }

        var newRole = dto.Role == "Moderator" ? "Moderator" : "Member";
        member.Role = newRole;
        await _db.SaveChangesAsync();

        // Broadcast to channel group and personal user group
        await _hubContext.Clients.Group($"channel-{id}").SendAsync("ChannelMemberRoleUpdated", new
        {
            channelId = id,
            userId = userId,
            role = newRole
        });

        await _hubContext.Clients.Group($"user-{userId}").SendAsync("ChannelMemberRoleUpdated", new
        {
            channelId = id,
            userId = userId,
            role = newRole
        });

        return Ok(new { message = $"Member role updated to {newRole}.", role = newRole });
    }

    [HttpGet("{id}/join-requests")]
    public async Task<ActionResult<List<ChannelJoinRequestDto>>> GetJoinRequests(int id)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        var (isLeader, isModerator, canManage) = await GetUserChannelPermissions(channel, currentUserId);
        if (!canManage)
        {
            return StatusCode(403, new { message = "Only the channel leader or moderators can view join requests." });
        }

        var requests = await _db.ChannelJoinRequests
            .Where(r => r.ChannelId == id && r.Status == "Pending")
            .Include(r => r.User)
            .OrderByDescending(r => r.RequestedAt)
            .Select(r => new ChannelJoinRequestDto
            {
                Id = r.Id,
                ChannelId = r.ChannelId,
                ChannelName = channel.Name,
                UserId = r.UserId,
                Username = r.User.Username,
                AvatarUrl = r.User.AvatarUrl,
                RequestedAt = r.RequestedAt,
                Status = r.Status,
                WasPreviouslyKicked = r.WasPreviouslyKicked
            })
            .ToListAsync();

        return Ok(requests);
    }

    [HttpPost("{id}/join-requests/{requestId}/approve")]
    public async Task<IActionResult> ApproveJoinRequest(int id, int requestId)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Owner)
            .Include(c => c.Workspace)
                .ThenInclude(w => w.Owner)
            .Include(c => c.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        var (isLeader, isModerator, canManage) = await GetUserChannelPermissions(channel, currentUserId);
        if (!canManage)
        {
            return StatusCode(403, new { message = "Only the channel leader or moderators can approve join requests." });
        }

        var request = await _db.ChannelJoinRequests
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == requestId && r.ChannelId == id && r.Status == "Pending");

        if (request == null)
            return NotFound(new { message = "Join request not found or already processed." });

        request.Status = "Approved";
        request.DecidedAt = DateTime.UtcNow;
        request.DecidedById = currentUserId;

        // Remove kick record so the user can freely stay and participate
        var kickRecord = await _db.ChannelKickRecords
            .FirstOrDefaultAsync(k => k.ChannelId == id && k.UserId == request.UserId);
        if (kickRecord != null)
        {
            _db.ChannelKickRecords.Remove(kickRecord);
        }

        // Add member if not already present
        if (!channel.Members.Any(m => m.UserId == request.UserId))
        {
            _db.ChannelMembers.Add(new ChannelMember
            {
                ChannelId = id,
                UserId = request.UserId,
                Role = "Member",
                JoinedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();

        var user = request.User;
        var userDto = new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            AvatarUrl = user.AvatarUrl,
            CreatedAt = user.CreatedAt,
            IsOnline = _presenceTracker.IsUserOnline(user.Username),
            Role = "Member"
        };

        // Reload channel to get latest members
        await _db.Entry(channel).Collection(c => c.Members).Query().Include(m => m.User).LoadAsync();
        var channelDto = MapToDto(channel, request.UserId, null);

        // Broadcast to channel members
        if (!channel.IsPrivate)
        {
            await _hubContext.Clients.All.SendAsync("UserJoinedChannel", new { channelId = id, user = userDto });
        }
        else
        {
            await _hubContext.Clients.Group($"channel-{id}").SendAsync("UserJoinedChannel", new { channelId = id, user = userDto });
        }

        // Send approval to the user directly
        await _hubContext.Clients.Group($"user-{request.UserId}").SendAsync("JoinRequestApproved", new
        {
            requestId = request.Id,
            channelId = id,
            channel = channelDto
        });

        // Notify managers that this request is resolved
        await _hubContext.Clients.Group($"channel-{id}").SendAsync("JoinRequestResolved", new
        {
            requestId = request.Id,
            channelId = id
        });

        return Ok(new { message = $"Approved @{user.Username} to join #{channel.Name}." });
    }

    [HttpPost("{id}/join-requests/{requestId}/reject")]
    public async Task<IActionResult> RejectJoinRequest(int id, int requestId)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Owner)
            .Include(c => c.Workspace)
                .ThenInclude(w => w.Owner)
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        var (isLeader, isModerator, canManage) = await GetUserChannelPermissions(channel, currentUserId);
        if (!canManage)
        {
            return StatusCode(403, new { message = "Only the channel leader or moderators can decline join requests." });
        }

        var request = await _db.ChannelJoinRequests
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == requestId && r.ChannelId == id && r.Status == "Pending");

        if (request == null)
            return NotFound(new { message = "Join request not found or already processed." });

        request.Status = "Rejected";
        request.DecidedAt = DateTime.UtcNow;
        request.DecidedById = currentUserId;

        await _db.SaveChangesAsync();

        // Notify user directly that their request was rejected
        await _hubContext.Clients.Group($"user-{request.UserId}").SendAsync("JoinRequestRejected", new
        {
            requestId = request.Id,
            channelId = id,
            channelName = channel.Name
        });

        // Notify managers that this request is resolved
        await _hubContext.Clients.Group($"channel-{id}").SendAsync("JoinRequestResolved", new
        {
            requestId = request.Id,
            channelId = id
        });

        return Ok(new { message = $"Declined join request from @{request.User.Username}." });
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
            return BadRequest(new { message = "Default system channels (like #general and general-voice) cannot be deleted." });

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
            .Include(c => c.Workspace)
                .ThenInclude(w => w.Owner)
            .Include(c => c.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if (channel.IsDirectMessage)
            return BadRequest(new { message = "Cannot invite members to a direct message." });

        // Only existing members can invite others
        if (!channel.Members.Any(m => m.UserId == currentUserId))
            return StatusCode(403, new { message = "Only channel members can invite others." });

        var (isLeader, isModerator, canManage) = await GetUserChannelPermissions(channel, currentUserId);
        if (channel.IsPrivate && !canManage)
        {
            return StatusCode(403, new { message = "Only channel leaders and moderators can invite members to private channels." });
        }

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
                Role = "Member",
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
                IsOnline = _presenceTracker.IsUserOnline(user.Username),
                Role = "Member"
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

        if (channel.IsProtected)
            return BadRequest(new { message = "Default protected channels (like #general and general-voice) cannot be modified." });

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

        // Ensure users share at least one mutual workspace
        var myWorkspaceIds = await _db.WorkspaceMembers
            .Where(wm => wm.UserId == currentUserId)
            .Select(wm => wm.WorkspaceId)
            .ToListAsync();

        var sharesWorkspace = await _db.WorkspaceMembers
            .AnyAsync(wm => wm.UserId == dto.TargetUserId && myWorkspaceIds.Contains(wm.WorkspaceId));

        if (!sharesWorkspace)
            return BadRequest(new { message = "You can only direct message users who share a workspace with you." });

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
            var myMember = existingDm.Members.FirstOrDefault(m => m.UserId == currentUserId);
            if (myMember != null && myMember.IsClosed)
            {
                myMember.IsClosed = false;
                await _db.SaveChangesAsync();
            }

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
            new ChannelMember { ChannelId = dmChannel.Id, UserId = currentUserId, JoinedAt = DateTime.UtcNow, IsClosed = false },
            new ChannelMember { ChannelId = dmChannel.Id, UserId = dto.TargetUserId, JoinedAt = DateTime.UtcNow, IsClosed = false }
        );
        await _db.SaveChangesAsync();

        // Reload to include members
        var created = await _db.Channels
            .Include(c => c.Owner)
            .Include(c => c.Members).ThenInclude(m => m.User)
            .FirstAsync(c => c.Id == dmChannel.Id);

        var dtoForCreator = MapToDto(created, currentUserId, null);

        // NOTE: We do not broadcast ChannelCreated to target user yet.
        // Target user will be notified in real-time when the first message is sent!
        return Ok(dtoForCreator);
    }

    [HttpPost("{id}/close-dm")]
    public async Task<IActionResult> CloseDm(int id)
    {
        var currentUserId = GetCurrentUserId();
        var channel = await _db.Channels
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if (!channel.IsDirectMessage)
            return BadRequest(new { message = "Only direct messages can be closed." });

        var member = channel.Members.FirstOrDefault(m => m.UserId == currentUserId);
        if (member == null)
            return StatusCode(403, new { message = "You are not a member of this direct message." });

        var hasMessages = await _db.Messages.AnyAsync(m => m.ChannelId == id);

        if (!hasMessages)
        {
            // Empty ghost DM: cleanly delete channel and memberships from database
            _db.ChannelMembers.RemoveRange(channel.Members);
            _db.Channels.Remove(channel);
            await _db.SaveChangesAsync();

            return Ok(new { success = true, deleted = true });
        }
        else
        {
            // DM has chat history: hide for current user while preserving history in DB
            member.IsClosed = true;
            await _db.SaveChangesAsync();

            return Ok(new { success = true, closed = true });
        }
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

        if (!effectiveOwnerId.HasValue && channel.Workspace != null)
        {
            effectiveOwnerId = channel.Workspace.OwnerId;
            effectiveOwnerUsername = channel.Workspace.Owner?.Username;
        }
        else if (!channel.IsDirectMessage && !effectiveOwnerId.HasValue && !channel.IsProtected)
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
            Type = channel.Type ?? "text",
            WorkspaceId = channel.WorkspaceId,
            IsDirectMessage = channel.IsDirectMessage,
            IsPrivate = channel.IsPrivate,
            IsProtected = channel.IsProtected,
            OwnerId = effectiveOwnerId,
            OwnerUsername = effectiveOwnerUsername,
            IsMember = channel.Members.Any(m => m.UserId == currentUserId),
            CreatedAt = channel.CreatedAt,
            UnreadCount = unreadCount,
            LastReadMessageId = lastReadMessageId,
            Members = channel.Members.Select(m =>
            {
                string effectiveRole = m.Role;
                if (string.IsNullOrEmpty(effectiveRole) || effectiveRole == "Member")
                {
                    if (channel.OwnerId == m.UserId || effectiveOwnerId == m.UserId)
                        effectiveRole = "Owner";
                    else
                        effectiveRole = "Member";
                }

                return new UserDto
                {
                    Id = m.User.Id,
                    Username = m.User.Username,
                    Email = m.User.Email,
                    AvatarUrl = m.User.AvatarUrl,
                    CreatedAt = m.User.CreatedAt,
                    IsOnline = _presenceTracker.IsUserOnline(m.User.Username),
                    Role = effectiveRole
                };
            }).ToList(),
            LastMessage = lastMessage == null ? null : new MessageDto
            {
                Id = lastMessage.Id,
                ChannelId = lastMessage.ChannelId,
                WorkspaceId = channel.WorkspaceId,
                SenderId = lastMessage.SenderId,
                SenderUsername = lastMessage.Sender?.Username ?? "",
                SenderAvatarUrl = lastMessage.Sender?.AvatarUrl,
                Content = lastMessage.Content,
                CreatedAt = lastMessage.CreatedAt
            }
        };
    }
}
