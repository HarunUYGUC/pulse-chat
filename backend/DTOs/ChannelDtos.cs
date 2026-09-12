using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace PulseChat.Api.DTOs;

public class ChannelDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
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
    [Required]
    [MinLength(2), MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Description { get; set; }

    public bool IsPrivate { get; set; } = false;

    public List<int>? InitialMemberIds { get; set; }
}

public class BrowseChannelDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPrivate { get; set; }
    public bool IsProtected { get; set; }
    public int MemberCount { get; set; }
    public bool IsMember { get; set; }
    public int? OwnerId { get; set; }
    public string? OwnerUsername { get; set; }
    public DateTime CreatedAt { get; set; }
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
