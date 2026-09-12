using PulseChat.Api.Models;

namespace PulseChat.Api.Services;

public interface ITokenService
{
    string CreateToken(User user);
}
