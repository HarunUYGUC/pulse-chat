using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace PulseChat.Api.DTOs;

public class ChannelDto
{
    public int Id { get; set; }
    public int? WorkspaceId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Type { get; set; } = "text";
    public bool IsDirectMessage { get; set; }
    public bool IsPrivate { get; set; }
    public bool IsProtected { get; set; }
    public int? OwnerId { get; set; }
    public string? OwnerUsername { get; set; }
    public bool IsMember { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<UserDto> Members { get; set; } = new();
    public MessageDto? LastMessage { get; set; }
    public int UnreadCount { get; set; }
    public int? LastReadMessageId { get; set; }
}

public class CreateChannelDto
{
    public int? WorkspaceId { get; set; }

    [Required]
    [MinLength(2), MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Description { get; set; }

    public string Type { get; set; } = "text"; // "text" or "voice"

    public bool IsPrivate { get; set; } = false;

    public List<int>? InitialMemberIds { get; set; }
}

public class BrowseChannelDto
{
    public int Id { get; set; }
    public int? WorkspaceId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Type { get; set; } = "text";
    public bool IsPrivate { get; set; }
    public bool IsProtected { get; set; }
    public int MemberCount { get; set; }
    public bool IsMember { get; set; }
    public int? OwnerId { get; set; }
    public string? OwnerUsername { get; set; }
    public bool WasKicked { get; set; }
    public string? KickedByUsername { get; set; }
    public string? KickedByRole { get; set; }
    public bool HasPendingJoinRequest { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class VoiceParticipantDto
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string ConnectionId { get; set; } = string.Empty;
    public int ChannelId { get; set; }
    public int? WorkspaceId { get; set; }
    public bool IsMuted { get; set; }
    public bool IsDeafened { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

public class VoiceSignalDto
{
    public string TargetConnectionId { get; set; } = string.Empty;
    public string? Sdp { get; set; }
    public object? Candidate { get; set; }
}

public class VoiceStateDto
{
    public int ChannelId { get; set; }
    public bool IsMuted { get; set; }
    public bool IsDeafened { get; set; }
}

public class ChannelJoinRequestDto
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public string ChannelName { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public DateTime RequestedAt { get; set; }
    public string Status { get; set; } = "Pending";
    public bool WasPreviouslyKicked { get; set; }
}

public class CreateDmDto
{
    [Required]
    public int TargetUserId { get; set; }
}

public class InviteMembersDto
{
    [Required]
    public List<int> UserIds { get; set; } = new();
}

public class UpdateChannelDto
{
    [MaxLength(250)]
    public string? Description { get; set; }
}

public class MarkReadDto
{
    public int? MessageId { get; set; }
}

public class UpdateChannelMemberRoleDto
{
    [Required]
    public string Role { get; set; } = "Member"; // "Moderator" or "Member"
}
