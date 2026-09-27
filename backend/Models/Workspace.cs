using System;
using System.Collections.Generic;

namespace PulseChat.Api.Models;

public class Workspace
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string InviteCode { get; set; } = string.Empty;

    public int OwnerId { get; set; }
    public User? Owner { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<WorkspaceMember> Members { get; set; } = new List<WorkspaceMember>();
    public ICollection<Channel> Channels { get; set; } = new List<Channel>();
}
