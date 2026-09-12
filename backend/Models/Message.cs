using System;
using System.Collections.Generic;

namespace PulseChat.Api.Models;

public class Message
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Foreign keys & navigation
    public int SenderId { get; set; }
    public User Sender { get; set; } = null!;

    public int ChannelId { get; set; }
    public Channel Channel { get; set; } = null!;

    public ICollection<MessageReaction> Reactions { get; set; } = new List<MessageReaction>();
}
