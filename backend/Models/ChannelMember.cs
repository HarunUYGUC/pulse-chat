using System;

namespace PulseChat.Api.Models;

public class ChannelMember
{
    public int ChannelId { get; set; }
    public Channel Channel { get; set; } = null!;

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public string Role { get; set; } = "Member"; // "Owner", "Moderator", "Member"
    public int? LastReadMessageId { get; set; }
    public DateTime? LastReadAt { get; set; }
    public bool IsClosed { get; set; } = false;
}
