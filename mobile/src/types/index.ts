export interface User {
  id: number;
  username: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
  isOnline?: boolean;
}

export interface Message {
  id: number;
  content: string;
  createdAt: string;
  channelId: number;
  ChannelId?: number;
  senderId: number;
  senderUsername: string;
  senderAvatarUrl?: string;
  reactions?: Record<string, string[]>; // Emoji => list of usernames
}

export interface Channel {
  id: number;
  name: string;
  description?: string;
  isDirectMessage: boolean;
  IsDirectMessage?: boolean;
  isPrivate?: boolean;
  isProtected?: boolean;
  ownerId?: number;
  ownerUsername?: string;
  isMember?: boolean;
  createdAt: string;
  members: User[];
  lastMessage?: Message;
  unreadCount?: number;
  lastReadMessageId?: number | null;
}

export interface BrowseChannel {
  id: number;
  name: string;
  description?: string;
  isPrivate: boolean;
  isProtected: boolean;
  memberCount: number;
  isMember: boolean;
  ownerId?: number;
  ownerUsername?: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  avatarUrl?: string;
}

export interface LoginData {
  usernameOrEmail: string;
  password: string;
}

export interface TypingNotification {
  channelId: number;
  username: string;
  isTyping: boolean;
}

export interface ReactionNotification {
  channelId: number;
  messageId: number;
  emoji: string;
  username: string;
  isAdded: boolean;
}

export interface UserJoinedChannelNotification {
  channelId?: number;
  ChannelId?: number;
  user: User;
}

export interface UserLeftChannelNotification {
  channelId?: number;
  ChannelId?: number;
  userId?: number;
  UserId?: number;
}
