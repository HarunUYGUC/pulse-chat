using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using PulseChat.Api.DTOs;

namespace PulseChat.Api.Services;

public class VoiceTracker
{
    // channelId -> List of participants in that channel
    private readonly ConcurrentDictionary<int, List<VoiceParticipantDto>> _channelParticipants = new();

    // connectionId -> channelId
    private readonly ConcurrentDictionary<string, int> _connectionToChannel = new();

    public (List<VoiceParticipantDto> participants, int? previousChannelId) AddUser(int channelId, VoiceParticipantDto participant)
    {
        int? previousChannelId = null;

        lock (_channelParticipants)
        {
            // If connection was already in a channel, remove first
            if (_connectionToChannel.TryRemove(participant.ConnectionId, out var oldChannelId))
            {
                previousChannelId = oldChannelId;
                if (_channelParticipants.TryGetValue(oldChannelId, out var oldList))
                {
                    oldList.RemoveAll(p => p.ConnectionId == participant.ConnectionId || p.UserId == participant.UserId);
                    if (oldList.Count == 0)
                    {
                        _channelParticipants.TryRemove(oldChannelId, out _);
                    }
                }
            }

            // Also remove any existing record of this userId across any channel (one voice channel per user)
            foreach (var kvp in _channelParticipants)
            {
                var removedCount = kvp.Value.RemoveAll(p => p.UserId == participant.UserId);
                if (removedCount > 0 && kvp.Key != channelId)
                {
                    previousChannelId = kvp.Key;
                }
            }

            // Add to new channel
            var list = _channelParticipants.GetOrAdd(channelId, _ => new List<VoiceParticipantDto>());
            list.RemoveAll(p => p.UserId == participant.UserId || p.ConnectionId == participant.ConnectionId);
            list.Add(participant);

            _connectionToChannel[participant.ConnectionId] = channelId;

            return (list.ToList(), previousChannelId);
        }
    }

    public (int channelId, VoiceParticipantDto removedParticipant)? RemoveUser(string connectionId)
    {
        lock (_channelParticipants)
        {
            if (!_connectionToChannel.TryRemove(connectionId, out var channelId))
            {
                return null;
            }

            if (_channelParticipants.TryGetValue(channelId, out var list))
            {
                var participant = list.FirstOrDefault(p => p.ConnectionId == connectionId);
                if (participant != null)
                {
                    list.Remove(participant);
                    if (list.Count == 0)
                    {
                        _channelParticipants.TryRemove(channelId, out _);
                    }
                    return (channelId, participant);
                }
            }

            return null;
        }
    }

    public (int channelId, VoiceParticipantDto updatedParticipant)? UpdateState(string connectionId, bool isMuted, bool isDeafened)
    {
        lock (_channelParticipants)
        {
            if (!_connectionToChannel.TryGetValue(connectionId, out var channelId))
            {
                return null;
            }

            if (_channelParticipants.TryGetValue(channelId, out var list))
            {
                var participant = list.FirstOrDefault(p => p.ConnectionId == connectionId);
                if (participant != null)
                {
                    participant.IsMuted = isMuted;
                    participant.IsDeafened = isDeafened;
                    return (channelId, participant);
                }
            }

            return null;
        }
    }

    public List<VoiceParticipantDto> GetParticipants(int channelId)
    {
        lock (_channelParticipants)
        {
            if (_channelParticipants.TryGetValue(channelId, out var list))
            {
                return list.ToList();
            }
            return new List<VoiceParticipantDto>();
        }
    }

    public Dictionary<int, List<VoiceParticipantDto>> GetAllParticipants()
    {
        lock (_channelParticipants)
        {
            return _channelParticipants.ToDictionary(k => k.Key, v => v.Value.ToList());
        }
    }
}
