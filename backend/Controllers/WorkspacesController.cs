using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
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
public class WorkspacesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PresenceTracker _presenceTracker;
    private readonly IHubContext<ChatHub> _hubContext;

    public WorkspacesController(AppDbContext db, PresenceTracker presenceTracker, IHubContext<ChatHub> hubContext)
    {
        _db = db;
        _presenceTracker = presenceTracker;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<ActionResult<List<WorkspaceDto>>> GetUserWorkspaces()
    {
        var currentUserId = GetCurrentUserId();

        var memberships = await _db.WorkspaceMembers
            .Where(wm => wm.UserId == currentUserId)
            .Include(wm => wm.Workspace!)
                .ThenInclude(w => w.Owner)
            .Include(wm => wm.Workspace!)
                .ThenInclude(w => w.Members)
            .OrderBy(wm => wm.WorkspaceId)
            .ToListAsync();

        var wsIds = memberships.Select(m => m.WorkspaceId).ToList();

        // Calculate unread count per workspace for current user
        var userChannelMembers = await _db.ChannelMembers
            .Where(cm => cm.UserId == currentUserId && cm.Channel.WorkspaceId.HasValue && wsIds.Contains(cm.Channel.WorkspaceId.Value) && !cm.Channel.IsDirectMessage)
            .Select(cm => new
            {
                WorkspaceId = cm.Channel.WorkspaceId!.Value,
                ChannelId = cm.ChannelId,
                LastReadMessageId = cm.LastReadMessageId ?? 0
            })
            .ToListAsync();

        var chIds = userChannelMembers.Select(cm => cm.ChannelId).ToList();

        var unreadMessages = await _db.Messages
            .Where(m => chIds.Contains(m.ChannelId) && m.SenderId != currentUserId)
            .Select(m => new { m.ChannelId, m.Id })
            .ToListAsync();

        var unreadByChannel = userChannelMembers.ToDictionary(
            cm => cm.ChannelId,
            cm => unreadMessages.Count(m => m.ChannelId == cm.ChannelId && m.Id > cm.LastReadMessageId)
        );

        var unreadByWorkspace = userChannelMembers
            .GroupBy(cm => cm.WorkspaceId)
            .ToDictionary(
                g => g.Key,
                g => g.Sum(cm => unreadByChannel.GetValueOrDefault(cm.ChannelId, 0))
            );

        var dtos = memberships.Select(m => new WorkspaceDto
        {
            Id = m.Workspace!.Id,
            Name = m.Workspace.Name,
            Description = m.Workspace.Description,
            InviteCode = m.Workspace.InviteCode,
            OwnerId = m.Workspace.OwnerId,
            OwnerUsername = m.Workspace.Owner?.Username,
            Role = m.Role,
            MemberCount = m.Workspace.Members.Count,
            UnreadCount = unreadByWorkspace.GetValueOrDefault(m.Workspace.Id, 0),
            CreatedAt = m.Workspace.CreatedAt
        }).ToList();

        return Ok(dtos);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<WorkspaceDto>> GetWorkspaceById(int id)
    {
        var currentUserId = GetCurrentUserId();

        var membership = await _db.WorkspaceMembers
            .Include(wm => wm.Workspace!)
                .ThenInclude(w => w.Owner)
            .Include(wm => wm.Workspace!)
                .ThenInclude(w => w.Members)
            .FirstOrDefaultAsync(wm => wm.WorkspaceId == id && wm.UserId == currentUserId);

        if (membership == null)
            return NotFound(new { message = "Workspace not found or you are not a member." });

        var userChannelMembers = await _db.ChannelMembers
            .Where(cm => cm.UserId == currentUserId && cm.Channel.WorkspaceId == id && !cm.Channel.IsDirectMessage)
            .Select(cm => new
            {
                ChannelId = cm.ChannelId,
                LastReadMessageId = cm.LastReadMessageId ?? 0
            })
            .ToListAsync();

        var chIds = userChannelMembers.Select(cm => cm.ChannelId).ToList();

        var unreadMessages = await _db.Messages
            .Where(m => chIds.Contains(m.ChannelId) && m.SenderId != currentUserId)
            .Select(m => new { m.ChannelId, m.Id })
            .ToListAsync();

        var unreadCount = userChannelMembers.Sum(cm =>
            unreadMessages.Count(m => m.ChannelId == cm.ChannelId && m.Id > cm.LastReadMessageId));

        var ws = membership.Workspace!;
        return Ok(new WorkspaceDto
        {
            Id = ws.Id,
            Name = ws.Name,
            Description = ws.Description,
            InviteCode = ws.InviteCode,
            OwnerId = ws.OwnerId,
            OwnerUsername = ws.Owner?.Username,
            Role = membership.Role,
            MemberCount = ws.Members.Count,
            UnreadCount = unreadCount,
            CreatedAt = ws.CreatedAt
        });
    }

    [HttpPost]
    public async Task<ActionResult<WorkspaceDto>> CreateWorkspace([FromBody] CreateWorkspaceDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = GetCurrentUserId();
        var trimmedName = dto.Name.Trim();

        var inviteCode = await GenerateUniqueInviteCode();

        var workspace = new Workspace
        {
            Name = trimmedName,
            Description = dto.Description?.Trim(),
            InviteCode = inviteCode,
            OwnerId = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Workspaces.Add(workspace);
        await _db.SaveChangesAsync();

        // 1. Add creator as Owner member
        _db.WorkspaceMembers.Add(new WorkspaceMember
        {
            WorkspaceId = workspace.Id,
            UserId = currentUserId,
            Role = "Owner",
            JoinedAt = DateTime.UtcNow
        });

        // 2. Automatically create default #general (text) and Genel Ses (voice) channels for this workspace
        var generalChannel = new Channel
        {
            Name = "general",
            Description = "General discussion for this workspace",
            Type = "text",
            WorkspaceId = workspace.Id,
            IsDirectMessage = false,
            IsPrivate = false,
            IsProtected = true,
            OwnerId = null,
            CreatedAt = DateTime.UtcNow
        };

        var voiceChannel = new Channel
        {
            Name = "Genel Ses",
            Description = "Default voice lounge for team discussions and hangouts.",
            Type = "voice",
            WorkspaceId = workspace.Id,
            IsDirectMessage = false,
            IsPrivate = false,
            IsProtected = false,
            OwnerId = null,
            CreatedAt = DateTime.UtcNow
        };

        _db.Channels.Add(generalChannel);
        _db.Channels.Add(voiceChannel);
        await _db.SaveChangesAsync();

        // 3. Add creator to default channels
        _db.ChannelMembers.Add(new ChannelMember
        {
            ChannelId = generalChannel.Id,
            UserId = currentUserId,
            JoinedAt = DateTime.UtcNow
        });

        _db.ChannelMembers.Add(new ChannelMember
        {
            ChannelId = voiceChannel.Id,
            UserId = currentUserId,
            JoinedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var owner = await _db.Users.FindAsync(currentUserId);

        var workspaceDto = new WorkspaceDto
        {
            Id = workspace.Id,
            Name = workspace.Name,
            Description = workspace.Description,
            InviteCode = workspace.InviteCode,
            OwnerId = workspace.OwnerId,
            OwnerUsername = owner?.Username,
            Role = "Owner",
            MemberCount = 1,
            CreatedAt = workspace.CreatedAt
        };

        return CreatedAtAction(nameof(GetWorkspaceById), new { id = workspace.Id }, workspaceDto);
    }

    [HttpPost("join")]
    public async Task<ActionResult<WorkspaceDto>> JoinWorkspace([FromBody] JoinWorkspaceDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentUserId = GetCurrentUserId();
        var code = dto.InviteCode.Trim().ToUpperInvariant();

        var workspace = await _db.Workspaces
            .Include(w => w.Owner)
            .Include(w => w.Members)
            .FirstOrDefaultAsync(w => w.InviteCode.ToUpper() == code);

        if (workspace == null)
            return NotFound(new { message = "Invalid invite code. Workspace not found." });

        var existingMember = workspace.Members.FirstOrDefault(m => m.UserId == currentUserId);
        if (existingMember != null)
        {
            return BadRequest(new { message = "You are already a member of this workspace." });
        }

        // Add user as Member
        var newMembership = new WorkspaceMember
        {
            WorkspaceId = workspace.Id,
            UserId = currentUserId,
            Role = "Member",
            JoinedAt = DateTime.UtcNow
        };
        _db.WorkspaceMembers.Add(newMembership);

        // Auto-add user to all public non-DM channels in this workspace
        var publicChannels = await _db.Channels
            .Where(c => c.WorkspaceId == workspace.Id && !c.IsDirectMessage && !c.IsPrivate)
            .ToListAsync();

        foreach (var ch in publicChannels)
        {
            _db.ChannelMembers.Add(new ChannelMember
            {
                ChannelId = ch.Id,
                UserId = currentUserId,
                JoinedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();

        var joiningUser = await _db.Users.FindAsync(currentUserId);
        var actualMemberCount = await _db.WorkspaceMembers.CountAsync(wm => wm.WorkspaceId == workspace.Id);

        var workspaceDto = new WorkspaceDto
        {
            Id = workspace.Id,
            Name = workspace.Name,
            Description = workspace.Description,
            InviteCode = workspace.InviteCode,
            OwnerId = workspace.OwnerId,
            OwnerUsername = workspace.Owner?.Username,
            Role = "Member",
            MemberCount = actualMemberCount,
            CreatedAt = workspace.CreatedAt
        };

        var memberDto = new WorkspaceMemberDto
        {
            Id = joiningUser!.Id,
            Username = joiningUser.Username,
            Email = joiningUser.Email,
            AvatarUrl = joiningUser.AvatarUrl,
            Role = "Member",
            JoinedAt = newMembership.JoinedAt,
            IsOnline = _presenceTracker.IsUserOnline(joiningUser.Username)
        };

        // Broadcast to existing workspace members that a new member joined
        await _hubContext.Clients.Group($"workspace-{workspace.Id}").SendAsync("WorkspaceMemberJoined", new
        {
            workspaceId = workspace.Id,
            member = memberDto,
            memberCount = actualMemberCount
        });

        // Broadcast UserJoinedChannel for all public channels they were automatically added to
        var userDto = new UserDto
        {
            Id = joiningUser.Id,
            Username = joiningUser.Username,
            Email = joiningUser.Email,
            AvatarUrl = joiningUser.AvatarUrl,
            CreatedAt = joiningUser.CreatedAt,
            IsOnline = _presenceTracker.IsUserOnline(joiningUser.Username)
        };

        foreach (var ch in publicChannels)
        {
            await _hubContext.Clients.Group($"channel-{ch.Id}").SendAsync("UserJoinedChannel", new
            {
                channelId = ch.Id,
                user = userDto
            });
        }

        return Ok(workspaceDto);
    }

    [HttpGet("{id}/members")]
    public async Task<ActionResult<List<WorkspaceMemberDto>>> GetWorkspaceMembers(int id)
    {
        var currentUserId = GetCurrentUserId();

        var isMember = await _db.WorkspaceMembers
            .AnyAsync(wm => wm.WorkspaceId == id && wm.UserId == currentUserId);

        if (!isMember)
            return StatusCode(403, new { message = "You must be a member of this workspace to view its members." });

        var members = await _db.WorkspaceMembers
            .Where(wm => wm.WorkspaceId == id)
            .Include(wm => wm.User)
            .OrderBy(wm => wm.Role == "Owner" ? 0 : wm.Role == "Admin" ? 1 : 2)
            .ThenBy(wm => wm.User!.Username)
            .ToListAsync();

        var dtos = members.Select(m => new WorkspaceMemberDto
        {
            Id = m.User!.Id,
            Username = m.User.Username,
            Email = m.User.Email,
            AvatarUrl = m.User.AvatarUrl,
            Role = m.Role,
            JoinedAt = m.JoinedAt,
            IsOnline = _presenceTracker.IsUserOnline(m.User.Username)
        }).ToList();

        return Ok(dtos);
    }

    [HttpPost("{id}/regenerate-invite")]
    public async Task<ActionResult<object>> RegenerateInviteCode(int id)
    {
        var currentUserId = GetCurrentUserId();

        var workspace = await _db.Workspaces.FindAsync(id);
        if (workspace == null)
            return NotFound(new { message = "Workspace not found." });

        if (workspace.OwnerId != currentUserId)
            return StatusCode(403, new { message = "Only the workspace owner can regenerate the invite code." });

        var newCode = await GenerateUniqueInviteCode();
        workspace.InviteCode = newCode;
        await _db.SaveChangesAsync();

        // Broadcast to workspace group so UI updates for owner/admins
        await _hubContext.Clients.Group($"workspace-{id}").SendAsync("InviteCodeUpdated", new
        {
            workspaceId = id,
            inviteCode = newCode
        });

        return Ok(new { inviteCode = newCode });
    }

    [HttpPost("{id}/leave")]
    public async Task<IActionResult> LeaveWorkspace(int id)
    {
        var currentUserId = GetCurrentUserId();

        var membership = await _db.WorkspaceMembers
            .FirstOrDefaultAsync(wm => wm.WorkspaceId == id && wm.UserId == currentUserId);

        if (membership == null)
            return NotFound(new { message = "You are not a member of this workspace." });

        if (membership.Role == "Owner")
            return BadRequest(new { message = "Workspace owner cannot leave the workspace. Delete it or transfer ownership first." });

        _db.WorkspaceMembers.Remove(membership);

        // Remove from channels in this workspace
        var workspaceChannelMemberships = await _db.ChannelMembers
            .Where(cm => cm.UserId == currentUserId && cm.Channel.WorkspaceId == id)
            .ToListAsync();

        _db.ChannelMembers.RemoveRange(workspaceChannelMemberships);
        await _db.SaveChangesAsync();

        var remainingCount = await _db.WorkspaceMembers.CountAsync(wm => wm.WorkspaceId == id);
        await _hubContext.Clients.Group($"workspace-{id}").SendAsync("WorkspaceMemberLeft", new
        {
            workspaceId = id,
            userId = currentUserId,
            memberCount = remainingCount
        });

        return Ok(new { message = "Left workspace successfully." });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWorkspace(int id)
    {
        var currentUserId = GetCurrentUserId();

        var workspace = await _db.Workspaces.FindAsync(id);
        if (workspace == null)
            return NotFound(new { message = "Workspace not found." });

        if (id == 1 || workspace.InviteCode == "PULSE-DEMO")
            return BadRequest(new { message = "The default community workspace cannot be deleted." });

        if (workspace.OwnerId != currentUserId)
            return StatusCode(403, new { message = "Only the workspace owner can delete this workspace." });

        // 1. Delete all channels in this workspace along with their messages, reactions, and memberships
        var channels = await _db.Channels
            .Where(c => c.WorkspaceId == id)
            .Include(c => c.Messages)
                .ThenInclude(m => m.Reactions)
            .Include(c => c.Members)
            .ToListAsync();

        foreach (var channel in channels)
        {
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
        }
        _db.Channels.RemoveRange(channels);

        // 2. Delete all workspace memberships
        var workspaceMembers = await _db.WorkspaceMembers
            .Where(wm => wm.WorkspaceId == id)
            .ToListAsync();
        _db.WorkspaceMembers.RemoveRange(workspaceMembers);

        // 3. Delete the workspace itself
        _db.Workspaces.Remove(workspace);
        await _db.SaveChangesAsync();

        // 4. Broadcast to workspace members
        await _hubContext.Clients.Group($"workspace-{id}").SendAsync("WorkspaceDeleted", id);

        return NoContent();
    }

    private async Task<string> GenerateUniqueInviteCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous characters (0, O, 1, I)
        string code;
        bool exists;

        do
        {
            var randomBytes = new byte[6];
            RandomNumberGenerator.Fill(randomBytes);
            var charArray = new char[6];
            for (int i = 0; i < 6; i++)
            {
                charArray[i] = chars[randomBytes[i] % chars.Length];
            }
            code = $"PULSE-{new string(charArray)}";
            exists = await _db.Workspaces.AnyAsync(w => w.InviteCode == code);
        } while (exists);

        return code;
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }
}
