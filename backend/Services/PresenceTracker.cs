using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PulseChat.Api.Services;

public class PresenceTracker
{
    private static readonly ConcurrentDictionary<string, HashSet<string>> OnlineUsers = new();

    public Task<bool> UserConnected(string username, string connectionId)
    {
        bool isFirstConnection = false;
        lock (OnlineUsers)
        {
            if (OnlineUsers.TryGetValue(username, out var connections))
            {
                connections.Add(connectionId);
            }
            else
            {
                OnlineUsers[username] = new HashSet<string> { connectionId };
                isFirstConnection = true;
            }
        }

        return Task.FromResult(isFirstConnection);
    }

    public Task<bool> UserDisconnected(string username, string connectionId)
    {
        bool isCompletelyOffline = false;
        lock (OnlineUsers)
        {
            if (!OnlineUsers.TryGetValue(username, out var connections))
            {
                return Task.FromResult(isCompletelyOffline);
            }

            connections.Remove(connectionId);

            if (connections.Count == 0)
            {
                OnlineUsers.TryRemove(username, out _);
                isCompletelyOffline = true;
            }
        }

        return Task.FromResult(isCompletelyOffline);
    }

    public Task<string[]> GetOnlineUsers()
    {
        string[] onlineUsernames;
        lock (OnlineUsers)
        {
            onlineUsernames = OnlineUsers.OrderBy(k => k.Key).Select(k => k.Key).ToArray();
        }

        return Task.FromResult(onlineUsernames);
    }

    public bool IsUserOnline(string username)
    {
        lock (OnlineUsers)
        {
            return OnlineUsers.ContainsKey(username);
        }
    }
}
