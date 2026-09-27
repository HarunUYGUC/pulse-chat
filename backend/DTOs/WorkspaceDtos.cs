using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace PulseChat.Api.DTOs;

public class WorkspaceDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string InviteCode { get; set; } = string.Empty;
    public int OwnerId { get; set; }
    public string? OwnerUsername { get; set; }
    public string Role { get; set; } = "Member";
    public int MemberCount { get; set; }
    public int UnreadCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateWorkspaceDto
{
    [Required]
    [MinLength(2), MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(250)]
    public string? Description { get; set; }
}

public class JoinWorkspaceDto
{
    [Required]
    public string InviteCode { get; set; } = string.Empty;
}

public class WorkspaceMemberDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string Role { get; set; } = "Member";
    public DateTime JoinedAt { get; set; }
    public bool IsOnline { get; set; }
}
