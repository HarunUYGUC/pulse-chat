using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace PulseChat.Api.DTOs;

public class MessageDto
{
    public int Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int ChannelId { get; set; }
    public int SenderId { get; set; }
    public string SenderUsername { get; set; } = string.Empty;
    public string? SenderAvatarUrl { get; set; }
    // Mapping of Emoji => List of usernames who reacted
    public Dictionary<string, List<string>> Reactions { get; set; } = new();
}

public class SendMessageDto
{
    [Required]
    public int ChannelId { get; set; }

    [Required]
    [MinLength(1), MaxLength(4000)]
    public string Content { get; set; } = string.Empty;
}

public class SendReactionDto
{
    [Required]
    public int ChannelId { get; set; }

    [Required]
    public int MessageId { get; set; }

    [Required]
    public string Emoji { get; set; } = string.Empty;
}

public class ReactionNotificationDto
{
    public int ChannelId { get; set; }
    public int MessageId { get; set; }
    public string Emoji { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public bool IsAdded { get; set; }
}

public class TypingNotificationDto
{
    public int ChannelId { get; set; }
    public string Username { get; set; } = string.Empty;
    public bool IsTyping { get; set; }
}
