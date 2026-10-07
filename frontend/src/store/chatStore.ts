import { create } from 'zustand';
import api from '../services/api';
import { Channel, Message, User, ReactionNotification, ChannelJoinRequest, WorkspaceMember } from '../types';
import { useAuthStore } from './authStore';
import { useWorkspaceStore } from './workspaceStore';
import { joinChannel as signalrJoin, leaveChannel as signalrLeave } from '../services/signalr';

interface ChatState {
  channels: Channel[];
  activeChannelId: number | null;
  messages: Record<number, Message[]>;
  onlineUsers: string[];
  typingUsers: Record<number, string[]>;
  unreadCounts: Record<number, number>;
  lastReadMessageIds: Record<number, number | null>;
  allUsers: User[];
  isLoadingMessages: boolean;
  joinRequests: ChannelJoinRequest[];

  setChannels: (channels: Channel[]) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: number) => void;
  deleteChannel: (channelId: number) => Promise<void>;
  leaveChannel: (channelId: number) => Promise<void>;
  kickMember: (channelId: number, userId: number) => Promise<void>;
  joinChannelById: (channelId: number) => Promise<{ isPending?: boolean; message?: string }>;
  inviteMembers: (channelId: number, userIds: number[]) => Promise<void>;
  updateChannelDescription: (channelId: number, description: string) => Promise<void>;
  fetchJoinRequests: (channelId: number) => Promise<void>;
  approveJoinRequest: (channelId: number, requestId: number) => Promise<void>;
  rejectJoinRequest: (channelId: number, requestId: number) => Promise<void>;
  addJoinRequest: (request: ChannelJoinRequest) => void;
  removeJoinRequest: (requestId: number) => void;
  userJoinedChannel: (channelId: number, user: User) => void;
  workspaceMemberJoined: (workspaceId: number, member: WorkspaceMember) => void;
  userLeftChannel: (channelId: number, userId: number) => void;
  handleUserUpdated: (user: User) => void;
  setActiveChannel: (channelId: number) => void;
  setMessages: (channelId: number, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  handleReactionUpdate: (notification: ReactionNotification) => void;
  setOnlineUsers: (users: string[]) => void;
  userWentOnline: (username: string) => void;
  userWentOffline: (username: string) => void;
  setUserTyping: (channelId: number, username: string, isTyping: boolean) => void;
  fetchChannels: (workspaceId?: number) => Promise<void>;
  fetchMessages: (channelId: number) => Promise<void>;
  fetchMoreMessages: (channelId: number) => Promise<boolean>;
  fetchUsers: (workspaceId?: number) => Promise<void>;
  markChannelAsRead: (channelId: number, messageId?: number) => Promise<void>;
  resetChat: () => void;
  hasMoreMessages: Record<number, boolean>;
  isLoadingMoreMessages: boolean;
}

export const useChatStore = create<ChatState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  messages: {},
  hasMoreMessages: {},
  isLoadingMoreMessages: false,
  onlineUsers: [],
  typingUsers: {},
  unreadCounts: {},
  lastReadMessageIds: {},
  allUsers: [],
  isLoadingMessages: false,
  joinRequests: [],

  resetChat: () =>
    set({
      channels: [],
      activeChannelId: null,
      messages: {},
      hasMoreMessages: {},
      isLoadingMoreMessages: false,
      onlineUsers: [],
      typingUsers: {},
      unreadCounts: {},
      lastReadMessageIds: {},
      allUsers: [],
      isLoadingMessages: false,
      joinRequests: [],
    }),

  setChannels: (channels) => set({ channels }),

  addChannel: (channel) =>
    set((state) => {
      const exists = state.channels.some((c) => c.id === channel.id);
      if (exists) {
        return {
          channels: state.channels.map((c) => (c.id === channel.id ? channel : c)),
        };
      }
      return { channels: [...state.channels, channel] };
    }),

  removeChannel: (channelId: number) => {
    const state = get();
    const remainingChannels = state.channels.filter((c) => c.id !== channelId);
    let nextActiveId = state.activeChannelId;

    if (state.activeChannelId === channelId) {
      // Find fallback channel: general or first remaining
      const general = remainingChannels.find((c) => c.name === 'general') || remainingChannels[0];
      nextActiveId = general ? general.id : null;
    }

    set({
      channels: remainingChannels,
    });

    if (nextActiveId) {
      get().setActiveChannel(nextActiveId);
    } else {
      set({ activeChannelId: null });
    }
  },

  deleteChannel: async (channelId: number) => {
    await api.delete(`/channels/${channelId}`);
    get().removeChannel(channelId);
  },

  leaveChannel: async (channelId: number) => {
    await api.post(`/channels/${channelId}/leave`);
    await signalrLeave(channelId);
    get().removeChannel(channelId);
  },

  kickMember: async (channelId: number, userId: number) => {
    await api.delete(`/channels/${channelId}/members/${userId}`);
    get().userLeftChannel(channelId, userId);
  },

  joinChannelById: async (channelId: number) => {
    const res = await api.post<{ isPending?: boolean; message?: string } & Partial<Channel>>(
      `/channels/${channelId}/join`
    );
    if (res.data?.isPending) {
      return { isPending: true, message: res.data.message };
    }
    const channel = res.data as Channel;
    get().addChannel(channel);
    get().setActiveChannel(channel.id);
    await signalrJoin(channelId);
    return { isPending: false };
  },

  inviteMembers: async (channelId: number, userIds: number[]) => {
    const res = await api.post<Channel>(`/channels/${channelId}/invite`, { userIds });
    get().addChannel(res.data);
  },

  updateChannelDescription: async (channelId: number, description: string) => {
    const res = await api.put<Channel>(`/channels/${channelId}`, { description });
    get().addChannel(res.data);
  },

  fetchJoinRequests: async (channelId: number) => {
    try {
      const response = await api.get<ChannelJoinRequest[]>(`/channels/${channelId}/join-requests`);
      set({ joinRequests: response.data });
    } catch {
      set({ joinRequests: [] });
    }
  },

  approveJoinRequest: async (channelId: number, requestId: number) => {
    await api.post(`/channels/${channelId}/join-requests/${requestId}/approve`);
    set((state) => ({
      joinRequests: state.joinRequests.filter((r) => r.id !== requestId),
    }));
  },

  rejectJoinRequest: async (channelId: number, requestId: number) => {
    await api.post(`/channels/${channelId}/join-requests/${requestId}/reject`);
    set((state) => ({
      joinRequests: state.joinRequests.filter((r) => r.id !== requestId),
    }));
  },

  addJoinRequest: (request: ChannelJoinRequest) =>
    set((state) => {
      if (state.joinRequests.some((r) => r.id === request.id)) return state;
      return { joinRequests: [request, ...state.joinRequests] };
    }),

  removeJoinRequest: (requestId: number) =>
    set((state) => ({
      joinRequests: state.joinRequests.filter((r) => r.id !== requestId),
    })),

  userJoinedChannel: (channelId: number, user: User) =>
    set((state) => {
      const updatedChannels = state.channels.map((c) => {
        if (c.id !== channelId) return c;
        const currentMembers = c.members || [];
        if (currentMembers.some((m) => m.id === user.id)) {
          return c;
        }
        return {
          ...c,
          members: [...currentMembers, user],
        };
      });
      return { channels: updatedChannels };
    }),

  workspaceMemberJoined: (workspaceId: number, member: WorkspaceMember) => {
    const user: User = {
      id: member.id,
      username: member.username,
      email: member.email,
      avatarUrl: member.avatarUrl,
      createdAt: member.joinedAt,
      isOnline: member.isOnline,
    };
    if (member.isOnline) {
      get().userWentOnline(member.username);
    }
    set((state) => {
      const updatedChannels = state.channels.map((c) => {
        if (Number(c.workspaceId) !== Number(workspaceId)) return c;
        if (c.isPrivate || c.isDirectMessage || c.IsDirectMessage) return c;
        const currentMembers = c.members || [];
        if (currentMembers.some((m) => Number(m.id) === Number(user.id))) return c;
        return {
          ...c,
          members: [...currentMembers, user],
        };
      });
      return { channels: updatedChannels };
    });
  },

  userLeftChannel: (channelId: number, userId: number) => {
    const currentUserId = useAuthStore.getState().user?.id;
    if (currentUserId && userId === currentUserId) {
      get().removeChannel(channelId);
      return;
    }

    set((state) => {
      const updatedChannels = state.channels.map((c) => {
        if (c.id !== channelId) return c;
        const currentMembers = c.members || [];
        return {
          ...c,
          members: currentMembers.filter((m) => m.id !== userId),
        };
      });
      return { channels: updatedChannels };
    });
  },

  handleUserUpdated: (user: User) => {
    set((state) => {
      const oldUser = state.allUsers.find((u) => u.id === user.id);
      const oldUsername = oldUser?.username;

      // 1. Update allUsers
      const allUsers = state.allUsers.some((u) => u.id === user.id)
        ? state.allUsers.map((u) => (u.id === user.id ? { ...u, ...user } : u))
        : [...state.allUsers, user];

      // 2. Update channels (members & ownerUsername)
      const channels = state.channels.map((c) => {
        let memberUpdated = false;
        const newMembers = c.members?.map((m) => {
          if (m.id === user.id) {
            memberUpdated = true;
            return { ...m, ...user };
          }
          return m;
        });

        const ownerChanged = c.ownerId === user.id && c.ownerUsername !== user.username;
        if (memberUpdated || ownerChanged) {
          return {
            ...c,
            members: newMembers || c.members,
            ownerUsername: c.ownerId === user.id ? user.username : c.ownerUsername,
          };
        }
        return c;
      });

      // 3. Update messages (senderUsername & senderAvatarUrl)
      const messages = { ...state.messages };
      for (const chId in messages) {
        let msgListChanged = false;
        const updatedList = messages[chId].map((msg) => {
          if (msg.senderId === user.id) {
            msgListChanged = true;
            return {
              ...msg,
              senderUsername: user.username,
              senderAvatarUrl: user.avatarUrl,
            };
          }
          return msg;
        });
        if (msgListChanged) {
          messages[chId] = updatedList;
        }
      }

      // 4. Update onlineUsers if username changed
      let onlineUsers = state.onlineUsers;
      if (oldUsername && oldUsername !== user.username) {
        onlineUsers = onlineUsers.map((name) => (name === oldUsername ? user.username : name));
      }

      return {
        allUsers,
        channels,
        messages,
        onlineUsers,
      };
    });
  },

  setActiveChannel: (channelId) => {
    const currentUserId = useAuthStore.getState().user?.id;
    const storageKey = currentUserId
      ? `pulsechat_last_channel_${currentUserId}`
      : 'pulsechat_last_channel';
    try {
      localStorage.setItem(storageKey, String(channelId));
    } catch {
      // Ignore localStorage write errors
    }

    const prevUnread = get().unreadCounts[channelId] || 0;
    if (prevUnread > 0) {
      const ch = get().channels.find((c) => c.id === channelId);
      if (ch?.workspaceId) {
        useWorkspaceStore.getState().decrementWorkspaceUnread(ch.workspaceId, prevUnread);
      }
    }

    set((state) => ({
      activeChannelId: channelId,
      unreadCounts: {
        ...state.unreadCounts,
        [channelId]: 0,
      },
    }));
    // Fetch messages for newly selected channel
    get().fetchMessages(channelId);
  },

  setMessages: (channelId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: messages,
      },
    })),

  addMessage: (message) =>
    set((state) => {
      const msgChannelId = Number(
        message.channelId || (message as unknown as { ChannelId: number }).ChannelId
      );
      const channelMessages = state.messages[msgChannelId] || [];

      // Prevent duplicate messages
      if (channelMessages.some((m) => m.id === message.id)) {
        return state;
      }

      const updatedMessages = [...channelMessages, message];
      const isCurrentActive = state.activeChannelId === msgChannelId;

      const currentUserId = useAuthStore.getState().user?.id;
      const isSentByMe = Boolean(currentUserId && message.senderId === currentUserId);

      const newUnread = { ...state.unreadCounts };
      if (!isCurrentActive && !isSentByMe) {
        newUnread[msgChannelId] = (newUnread[msgChannelId] || 0) + 1;

        const ch = state.channels.find((c) => c.id === msgChannelId);
        const wsId =
          message.workspaceId ??
          (message as unknown as { WorkspaceId?: number }).WorkspaceId ??
          ch?.workspaceId;
        if (wsId) {
          useWorkspaceStore.getState().incrementWorkspaceUnread(wsId);
        }
      }

      // Also update channel lastMessage
      const updatedChannels = state.channels.map((c) => {
        if (c.id === msgChannelId) {
          return { ...c, lastMessage: message };
        }
        return c;
      });

      return {
        messages: {
          ...state.messages,
          [msgChannelId]: updatedMessages,
        },
        unreadCounts: newUnread,
        channels: updatedChannels,
      };
    }),

  handleReactionUpdate: (notification: ReactionNotification) =>
    set((state) => {
      const channelMessages = state.messages[notification.channelId] || [];
      const updatedMessages = channelMessages.map((msg) => {
        if (msg.id !== notification.messageId) return msg;

        const currentReactions = { ...(msg.reactions || {}) };
        const userList = [...(currentReactions[notification.emoji] || [])];

        if (notification.isAdded) {
          if (!userList.includes(notification.username)) {
            userList.push(notification.username);
          }
          currentReactions[notification.emoji] = userList;
        } else {
          const filtered = userList.filter((u) => u !== notification.username);
          if (filtered.length > 0) {
            currentReactions[notification.emoji] = filtered;
          } else {
            delete currentReactions[notification.emoji];
          }
        }

        return { ...msg, reactions: currentReactions };
      });

      return {
        messages: {
          ...state.messages,
          [notification.channelId]: updatedMessages,
        },
      };
    }),

  markChannelAsRead: async (channelId: number, messageId?: number) => {
    const prevUnread = get().unreadCounts[channelId] || 0;
    if (prevUnread > 0) {
      const ch = get().channels.find((c) => c.id === channelId);
      if (ch?.workspaceId) {
        useWorkspaceStore.getState().decrementWorkspaceUnread(ch.workspaceId, prevUnread);
      }
    }

    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [channelId]: 0,
      },
    }));

    try {
      const res = await api.post<{ channelId: number; lastReadMessageId: number }>(
        `/channels/${channelId}/read`,
        messageId ? { messageId } : {}
      );
      if (res.data?.lastReadMessageId) {
        set((state) => ({
          lastReadMessageIds: {
            ...state.lastReadMessageIds,
            [channelId]: res.data.lastReadMessageId,
          },
        }));
      }
    } catch (err) {
      console.error(`Failed to mark channel ${channelId} as read:`, err);
    }
  },

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  userWentOnline: (username) =>
    set((state) => {
      if (!state.onlineUsers.includes(username)) {
        return { onlineUsers: [...state.onlineUsers, username] };
      }
      return state;
    }),

  userWentOffline: (username) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.filter((u) => u !== username),
    })),

  setUserTyping: (channelId, username, isTyping) =>
    set((state) => {
      const current = state.typingUsers[channelId] || [];
      let updated: string[];
      if (isTyping) {
        updated = current.includes(username) ? current : [...current, username];
      } else {
        updated = current.filter((u) => u !== username);
      }
      return {
        typingUsers: {
          ...state.typingUsers,
          [channelId]: updated,
        },
      };
    }),

  fetchChannels: async (workspaceId?: number) => {
    try {
      const url = workspaceId ? `/channels?workspaceId=${workspaceId}` : '/channels';
      const response = await api.get<Channel[]>(url);
      const channels = response.data;
      const unreadCounts: Record<number, number> = {};
      const lastReadMessageIds: Record<number, number | null> = {};
      for (const ch of channels) {
        unreadCounts[ch.id] = ch.unreadCount || 0;
        lastReadMessageIds[ch.id] = ch.lastReadMessageId ?? null;
      }
      set({ channels, unreadCounts, lastReadMessageIds });

      if (workspaceId) {
        const totalWsUnread = Object.values(unreadCounts).reduce((acc, curr) => acc + curr, 0);
        useWorkspaceStore.getState().setWorkspaceUnread(workspaceId, totalWsUnread);
      }

      if (channels.length === 0) {
        set({ activeChannelId: null });
        return;
      }

      const currentUserId = useAuthStore.getState().user?.id;
      const storageKey = currentUserId
        ? `pulsechat_last_channel_${currentUserId}`
        : 'pulsechat_last_channel';
      const savedChannelIdStr = localStorage.getItem(storageKey);
      const savedChannelId = savedChannelIdStr ? parseInt(savedChannelIdStr, 10) : null;

      const currentActive = get().activeChannelId;

      let targetChannel: Channel | undefined;
      // 1. If currently active channel is valid in channels, keep it
      if (currentActive && channels.some((c) => c.id === currentActive)) {
        targetChannel = channels.find((c) => c.id === currentActive);
      }
      // 2. Otherwise, if there is a saved channel in localStorage (e.g. from page refresh) and it's valid
      else if (savedChannelId && channels.some((c) => c.id === savedChannelId)) {
        targetChannel = channels.find((c) => c.id === savedChannelId);
      }
      // 3. Otherwise fallback to 'general' or first channel
      else {
        targetChannel = channels.find((c) => c.name === 'general') || channels[0];
      }

      if (targetChannel) {
        get().setActiveChannel(targetChannel.id);
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  },

  fetchMessages: async (channelId: number) => {
    set({ isLoadingMessages: true });
    try {
      const response = await api.get<Message[]>(`/channels/${channelId}/messages?limit=50`);
      const msgs = response.data;
      set((state) => ({
        messages: {
          ...state.messages,
          [channelId]: msgs,
        },
        hasMoreMessages: {
          ...state.hasMoreMessages,
          [channelId]: msgs.length === 50,
        },
        isLoadingMessages: false,
      }));
    } catch (err) {
      console.error(`Failed to fetch messages for channel ${channelId}:`, err);
      set({ isLoadingMessages: false });
    }
  },

  fetchMoreMessages: async (channelId: number) => {
    const state = get();
    if (state.isLoadingMoreMessages) return false;
    if (state.hasMoreMessages[channelId] === false) return false;

    const currentMessages = state.messages[channelId] || [];
    if (currentMessages.length === 0) return false;

    const oldestMessageId = currentMessages[0].id;
    set({ isLoadingMoreMessages: true });

    try {
      const response = await api.get<Message[]>(
        `/channels/${channelId}/messages?limit=50&beforeId=${oldestMessageId}`
      );
      const olderMessages = response.data;

      set((s) => {
        const existing = s.messages[channelId] || [];
        const existingIds = new Set(existing.map((m) => m.id));
        const filteredOlder = olderMessages.filter((m) => !existingIds.has(m.id));

        return {
          messages: {
            ...s.messages,
            [channelId]: [...filteredOlder, ...existing],
          },
          hasMoreMessages: {
            ...s.hasMoreMessages,
            [channelId]: olderMessages.length === 50,
          },
          isLoadingMoreMessages: false,
        };
      });

      return olderMessages.length > 0;
    } catch (err) {
      console.error(`Failed to fetch older messages for channel ${channelId}:`, err);
      set({ isLoadingMoreMessages: false });
      return false;
    }
  },

  fetchUsers: async (workspaceId?: number) => {
    try {
      const url = workspaceId ? `/auth/users?workspaceId=${workspaceId}` : '/auth/users';
      const response = await api.get<User[]>(url);
      set({ allUsers: response.data });
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  },
}));
