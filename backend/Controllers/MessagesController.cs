using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PulseChat.Api.Data;
using PulseChat.Api.DTOs;

namespace PulseChat.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/channels/{channelId}/[controller]")]
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _db;

    public MessagesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<MessageDto>>> GetMessages(int channelId, [FromQuery] int limit = 50, [FromQuery] int? beforeId = null)
    {
        var currentUserId = GetCurrentUserId();

        var channel = await _db.Channels
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
            return NotFound(new { message = "Channel not found." });

        if (channel.WorkspaceId.HasValue)
        {
            var isWorkspaceMember = await _db.WorkspaceMembers
                .AnyAsync(wm => wm.WorkspaceId == channel.WorkspaceId.Value && wm.UserId == currentUserId);
            if (!isWorkspaceMember)
                return StatusCode(403, new { message = "You must be a member of this workspace to access this channel's messages." });
        }

        var isKicked = await _db.ChannelKickRecords
            .AnyAsync(k => k.ChannelId == channelId && k.UserId == currentUserId);
        if (isKicked)
            return StatusCode(403, new { message = "You have been removed from this channel." });

        if ((channel.IsDirectMessage || channel.IsPrivate) && !channel.Members.Any(m => m.UserId == currentUserId))
            return StatusCode(403, new { message = "You do not have permission to view messages in this channel." });

        var query = _db.Messages
            .Where(m => m.ChannelId == channelId);

        if (beforeId.HasValue && beforeId.Value > 0)
        {
            query = query.Where(m => m.Id < beforeId.Value);
        }

        var messages = await query
            .OrderByDescending(m => m.Id)
            .Take(Math.Min(limit, 100))
            .Include(m => m.Sender)
            .Include(m => m.Reactions)
                .ThenInclude(r => r.User)
            .ToListAsync();

        var dtos = messages.Select(m =>
        {
            var reactionDict = new Dictionary<string, List<string>>();
            foreach (var grp in m.Reactions.GroupBy(r => r.Emoji))
            {
                reactionDict[grp.Key] = grp.Select(r => r.User.Username).ToList();
            }

            return new MessageDto
            {
                Id = m.Id,
                Content = m.Content,
                CreatedAt = m.CreatedAt,
                ChannelId = m.ChannelId,
                WorkspaceId = channel.WorkspaceId,
                SenderId = m.SenderId,
                SenderUsername = m.Sender.Username,
                SenderAvatarUrl = m.Sender.AvatarUrl,
                Reactions = reactionDict
            };
        }).ToList();

        // Reverse to return in chronological ascending order
        dtos.Reverse();

        return Ok(dtos);
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }
}
