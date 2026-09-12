using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PulseChat.Api.Data;
using PulseChat.Api.DTOs;
using PulseChat.Api.Models;
using PulseChat.Api.Services;

namespace PulseChat.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ITokenService _tokenService;
    private readonly PresenceTracker _presenceTracker;

    public AuthController(AppDbContext db, ITokenService tokenService, PresenceTracker presenceTracker)
    {
        _db = db;
        _tokenService = tokenService;
        _presenceTracker = presenceTracker;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] RegisterDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var trimmedUsername = dto.Username.Trim();
        var trimmedEmail = dto.Email.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Username.ToLower() == trimmedUsername.ToLower()))
        {
            return BadRequest(new { message = "Username is already taken." });
        }

        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == trimmedEmail))
        {
            return BadRequest(new { message = "Email address is already registered." });
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

        // Fallback default avatar generator using DiceBear API or clean initials
        var avatar = string.IsNullOrWhiteSpace(dto.AvatarUrl)
            ? $"https://api.dicebear.com/7.x/initials/svg?seed={Uri.EscapeDataString(trimmedUsername)}&backgroundColor=0d6efd,6610f2,6f42c1,0dcaf0"
            : dto.AvatarUrl.Trim();

        var user = new User
        {
            Username = trimmedUsername,
            Email = trimmedEmail,
            PasswordHash = passwordHash,
            AvatarUrl = avatar,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // Automatically join public channels (Discord model)
        var publicChannels = await _db.Channels.Where(c => !c.IsDirectMessage && !c.IsPrivate).ToListAsync();
        foreach (var ch in publicChannels)
        {
            _db.ChannelMembers.Add(new ChannelMember
            {
                ChannelId = ch.Id,
                UserId = user.Id,
                JoinedAt = DateTime.UtcNow
            });
        }
        await _db.SaveChangesAsync();

        var token = _tokenService.CreateToken(user);

        return Ok(new AuthResponseDto
        {
            Token = token,
            User = new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                AvatarUrl = user.AvatarUrl,
                CreatedAt = user.CreatedAt,
                IsOnline = true
            }
        });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var identifier = dto.UsernameOrEmail.Trim().ToLowerInvariant();

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == identifier || u.Email.ToLower() == identifier);

        if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid username/email or password." });
        }

        var token = _tokenService.CreateToken(user);

        return Ok(new AuthResponseDto
        {
            Token = token,
            User = new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                AvatarUrl = user.AvatarUrl,
                CreatedAt = user.CreatedAt,
                IsOnline = _presenceTracker.IsUserOnline(user.Username)
            }
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetCurrentUser()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return NotFound();

        return Ok(new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            AvatarUrl = user.AvatarUrl,
            CreatedAt = user.CreatedAt,
            IsOnline = _presenceTracker.IsUserOnline(user.Username)
        });
    }

    [Authorize]
    [HttpGet("users")]
    public async Task<ActionResult<System.Collections.Generic.IEnumerable<UserDto>>> GetAllUsers()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int.TryParse(userIdClaim, out var currentUserId);

        var users = await _db.Users
            .Where(u => u.Id != currentUserId)
            .OrderBy(u => u.Username)
            .Select(u => new UserDto
            {
                Id = u.Id,
                Username = u.Username,
                Email = u.Email,
                AvatarUrl = u.AvatarUrl,
                CreatedAt = u.CreatedAt,
                IsOnline = false
            })
            .ToListAsync();

        foreach (var u in users)
        {
            u.IsOnline = _presenceTracker.IsUserOnline(u.Username);
        }

        return Ok(users);
    }
}
