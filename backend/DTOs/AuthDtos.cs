using System;
using System.ComponentModel.DataAnnotations;

namespace PulseChat.Api.DTOs;

public class RegisterDto
{
    [Required]
    [MinLength(3), MaxLength(30)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(100)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(6), MaxLength(100)]
    public string Password { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? AvatarUrl { get; set; }

    [MaxLength(50)]
    public string? InviteCode { get; set; }
}

public class LoginDto
{
    [Required]
    [MaxLength(100)]
    public string UsernameOrEmail { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Password { get; set; } = string.Empty;
}

public class UserDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsOnline { get; set; }
    public string Role { get; set; } = "Member";
}

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public UserDto User { get; set; } = null!;
}

public class UpdateProfileDto
{
    [MinLength(3), MaxLength(30)]
    public string? Username { get; set; }

    [MaxLength(500)]
    public string? AvatarUrl { get; set; }

    [MaxLength(100)]
    public string? CurrentPassword { get; set; }

    [MinLength(6), MaxLength(100)]
    public string? NewPassword { get; set; }
}
