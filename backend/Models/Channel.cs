using System;
using System.Collections.Generic;

namespace PulseChat.Api.Models;

public class Channel
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsDirectMessage { get; set; } = false;
    public bool IsPrivate { get; set; } = false;
    public bool IsProtected { get; set; } = false; // Protected channels cannot be deleted (e.g. #general)

    public int? OwnerId { get; set; }
    public User? Owner { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<ChannelMember> Members { get; set; } = new List<ChannelMember>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
}
