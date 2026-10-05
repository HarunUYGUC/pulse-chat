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
  workspaceId?: number;
  WorkspaceId?: number;
  senderId: number;
  senderUsername: string;
  senderAvatarUrl?: string;
  reactions?: Record<string, string[]>; // Emoji => list of usernames
}

export interface Channel {
  id: number;
  name: string;
  description?: string;
  type?: 'text' | 'voice';
  workspaceId?: number;
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
  type?: 'text' | 'voice';
  workspaceId?: number;
  isPrivate: boolean;
  isProtected: boolean;
  memberCount: number;
  isMember: boolean;
  wasKicked?: boolean;
  hasPendingJoinRequest?: boolean;
  ownerId?: number;
  ownerUsername?: string;
  createdAt: string;
}

export interface ChannelJoinRequest {
  id: number;
  channelId: number;
  channelName: string;
  userId: number;
  username: string;
  avatarUrl?: string;
  requestedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  wasPreviouslyKicked: boolean;
}

export interface Workspace {
  id: number;
  name: string;
  description?: string;
  inviteCode: string;
  ownerId: number;
  ownerUsername?: string;
  role: string; // "Owner" | "Admin" | "Member"
  memberCount: number;
  unreadCount?: number;
  createdAt: string;
}

export interface WorkspaceMember {
  id: number;
  username: string;
  email: string;
  avatarUrl?: string;
  role: string;
  joinedAt: string;
  isOnline: boolean;
}

export interface CreateWorkspaceData {
  name: string;
  description?: string;
}

export interface JoinWorkspaceData {
  inviteCode: string;
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
  inviteCode?: string;
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

export interface UpdateProfileData {
  username?: string;
  avatarUrl?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface VoiceParticipant {
  userId: number;
  username: string;
  avatarUrl?: string;
  connectionId: string;
  channelId: number;
  workspaceId?: number;
  isMuted: boolean;
  isDeafened: boolean;
  joinedAt: string;
}

export interface VoiceOfferData {
  senderConnectionId: string;
  senderUserId: number;
  senderUsername: string;
  sdp: string;
}

export interface VoiceAnswerData {
  senderConnectionId: string;
  senderUserId: number;
  senderUsername: string;
  sdp: string;
}

export interface VoiceIceData {
  senderConnectionId: string;
  candidate: RTCIceCandidateInit;
}

export interface VoiceStateNotification {
  channelId: number;
  userId: number;
  connectionId: string;
  isMuted: boolean;
  isDeafened: boolean;
}

export interface VoiceUserLeftNotification {
  channelId: number;
  userId: number;
  connectionId: string;
}


