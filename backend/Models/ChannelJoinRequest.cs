using System;

namespace PulseChat.Api.Models;

public class ChannelJoinRequest
{
    public int Id { get; set; }
    public int ChannelId { get; set; }
    public Channel Channel { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "Pending"; // "Pending", "Approved", "Rejected"
    public bool WasPreviouslyKicked { get; set; }
    public DateTime? DecidedAt { get; set; }
    public int? DecidedById { get; set; }
    public User? DecidedBy { get; set; }
}
