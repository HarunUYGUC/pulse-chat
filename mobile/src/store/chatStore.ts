import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { Channel, Message, User, ReactionNotification } from '../types';
import { useAuthStore } from './authStore';
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

  setChannels: (channels: Channel[]) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: number) => void;
  deleteChannel: (channelId: number) => Promise<void>;
  leaveChannel: (channelId: number) => Promise<void>;
  joinChannelById: (channelId: number) => Promise<void>;
  inviteMembers: (channelId: number, userIds: number[]) => Promise<void>;
  updateChannelDescription: (channelId: number, description: string) => Promise<void>;
  userJoinedChannel: (channelId: number, user: User) => void;
  userLeftChannel: (channelId: number, userId: number) => void;
  setActiveChannel: (channelId: number) => void;
  setMessages: (channelId: number, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  handleReactionUpdate: (notification: ReactionNotification) => void;
  setOnlineUsers: (users: string[]) => void;
  userWentOnline: (username: string) => void;
  userWentOffline: (username: string) => void;
  setUserTyping: (channelId: number, username: string, isTyping: boolean) => void;
  fetchChannels: () => Promise<void>;
  fetchMessages: (channelId: number) => Promise<void>;
  fetchUsers: () => Promise<void>;
  markChannelAsRead: (channelId: number, messageId?: number) => Promise<void>;
  resetChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  messages: {},
  onlineUsers: [],
  typingUsers: {},
  unreadCounts: {},
  lastReadMessageIds: {},
  allUsers: [],
  isLoadingMessages: false,

  resetChat: () =>
    set({
      channels: [],
      activeChannelId: null,
      messages: {},
      onlineUsers: [],
      typingUsers: {},
      unreadCounts: {},
      lastReadMessageIds: {},
      allUsers: [],
      isLoadingMessages: false,
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

  joinChannelById: async (channelId: number) => {
    const res = await api.post<Channel>(`/channels/${channelId}/join`);
    get().addChannel(res.data);
    get().setActiveChannel(res.data.id);
    await signalrJoin(channelId);
  },

  inviteMembers: async (channelId: number, userIds: number[]) => {
    const res = await api.post<Channel>(`/channels/${channelId}/invite`, { userIds });
    get().addChannel(res.data);
  },

  updateChannelDescription: async (channelId: number, description: string) => {
    const res = await api.put<Channel>(`/channels/${channelId}`, { description });
    get().addChannel(res.data);
  },

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

  setActiveChannel: (channelId) => {
    const currentUserId = useAuthStore.getState().user?.id;
    const storageKey = currentUserId
      ? `pulsechat_last_channel_${currentUserId}`
      : 'pulsechat_last_channel';
    try {
      AsyncStorage.setItem(storageKey, String(channelId));
    } catch {
      // Ignore storage write errors
    }

    set((state) => ({
      activeChannelId: channelId,
      unreadCounts: {
        ...state.unreadCounts,
        [channelId]: 0,
      },
    }));
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

      if (channelMessages.some((m) => m.id === message.id)) {
        return state;
      }

      const updatedMessages = [...channelMessages, message];
      const isCurrentActive = state.activeChannelId === msgChannelId;

      const newUnread = { ...state.unreadCounts };
      if (!isCurrentActive) {
        newUnread[msgChannelId] = (newUnread[msgChannelId] || 0) + 1;
      }

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

  fetchChannels: async () => {
    try {
      const response = await api.get<Channel[]>('/channels');
      const channels = response.data;
      const unreadCounts: Record<number, number> = {};
      const lastReadMessageIds: Record<number, number | null> = {};
      for (const ch of channels) {
        unreadCounts[ch.id] = ch.unreadCount || 0;
        lastReadMessageIds[ch.id] = ch.lastReadMessageId ?? null;
      }
      set({ channels, unreadCounts, lastReadMessageIds });

      if (channels.length === 0) return;

      const currentUserId = useAuthStore.getState().user?.id;
      const storageKey = currentUserId
        ? `pulsechat_last_channel_${currentUserId}`
        : 'pulsechat_last_channel';
      const savedChannelIdStr = await AsyncStorage.getItem(storageKey);
      const savedChannelId = savedChannelIdStr ? parseInt(savedChannelIdStr, 10) : null;

      const currentActive = get().activeChannelId;

      let targetChannel: Channel | undefined;
      if (currentActive && channels.some((c) => c.id === currentActive)) {
        targetChannel = channels.find((c) => c.id === currentActive);
      } else if (savedChannelId && channels.some((c) => c.id === savedChannelId)) {
        targetChannel = channels.find((c) => c.id === savedChannelId);
      } else {
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
      const response = await api.get<Message[]>(`/channels/${channelId}/messages`);
      set((state) => ({
        messages: {
          ...state.messages,
          [channelId]: response.data,
        },
        isLoadingMessages: false,
      }));
    } catch (err) {
      console.error(`Failed to fetch messages for channel ${channelId}:`, err);
      set({ isLoadingMessages: false });
    }
  },

  fetchUsers: async () => {
    try {
      const response = await api.get<User[]>('/auth/users');
      set({ allUsers: response.data });
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  },
}));
