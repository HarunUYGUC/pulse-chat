using System;

namespace PulseChat.Api.Models;

public class ChannelKickRecord
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public Channel Channel { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int KickedById { get; set; }
    public User KickedBy { get; set; } = null!;
    public DateTime KickedAt { get; set; } = DateTime.UtcNow;
}
