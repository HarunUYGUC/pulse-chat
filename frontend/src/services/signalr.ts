import * as signalR from '@microsoft/signalr';
import { useChatStore } from '../store/chatStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useAuthStore } from '../store/authStore';
import {
  Message,
  TypingNotification,
  ReactionNotification,
  Channel,
  Workspace,
  WorkspaceMember,
  UserJoinedChannelNotification,
  UserLeftChannelNotification,
  ChannelJoinRequest,
  User,
} from '../types';

let hubConnection: signalR.HubConnection | null = null;

export const startSignalRConnection = async (token: string): Promise<signalR.HubConnection> => {
  if (hubConnection && hubConnection.state === signalR.HubConnectionState.Connected) {
    return hubConnection;
  }

  if (hubConnection) {
    try {
      await hubConnection.stop();
    } catch {
      // Ignore stop errors
    }
  }

  const hubUrl = window.location.origin.includes('5173')
    ? '/hubs/chat'
    : 'http://localhost:5000/hubs/chat';

  hubConnection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: () => token,
      skipNegotiation: false,
      transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 1500, 5000, 10000])
    .configureLogging(signalR.LogLevel.Information)
    .build();

  // SignalR Event Listeners
  hubConnection.on('ReceiveMessage', (message: Message) => {
    useChatStore.getState().addMessage(message);
  });

  hubConnection.on('ReceiveReaction', (notification: ReactionNotification) => {
    useChatStore.getState().handleReactionUpdate(notification);
  });

  hubConnection.on('ChannelCreated', (channel: Channel) => {
    useChatStore.getState().addChannel(channel);
    if (hubConnection?.state === signalR.HubConnectionState.Connected) {
      hubConnection.invoke('JoinChannel', channel.id).catch(() => {});
    }
  });

  hubConnection.on('ChannelDeleted', (channelId: number) => {
    useChatStore.getState().removeChannel(Number(channelId));
  });

  hubConnection.on('ChannelUpdated', (channel: Channel) => {
    useChatStore.getState().addChannel(channel);
  });

  hubConnection.on('UserJoinedChannel', (data: UserJoinedChannelNotification) => {
    const channelId = Number(data.channelId ?? data.ChannelId);
    if (channelId && data.user) {
      useChatStore.getState().userJoinedChannel(channelId, data.user);
    }
  });

  hubConnection.on('UserLeftChannel', (data: UserLeftChannelNotification) => {
    const channelId = Number(data.channelId ?? data.ChannelId);
    const userId = Number(data.userId ?? data.UserId);
    if (channelId && userId) {
      useChatStore.getState().userLeftChannel(channelId, userId);
    }
  });

  hubConnection.on('UserTyping', (notification: TypingNotification) => {
    useChatStore
      .getState()
      .setUserTyping(notification.channelId, notification.username, notification.isTyping);
  });

  hubConnection.on('UserWentOnline', (username: string) => {
    useChatStore.getState().userWentOnline(username);
    useWorkspaceStore.getState().updateMemberPresence(username, true);
  });

  hubConnection.on('UserWentOffline', (username: string) => {
    useChatStore.getState().userWentOffline(username);
    useWorkspaceStore.getState().updateMemberPresence(username, false);
  });

  hubConnection.on('GetOnlineUsers', (users: string[]) => {
    useChatStore.getState().setOnlineUsers(users);
  });

  hubConnection.on('UserUpdated', (user: User) => {
    if (useAuthStore.getState().user?.id === user.id) {
      useAuthStore.getState().setUser(user);
    }
    useChatStore.getState().handleUserUpdated(user);
    useWorkspaceStore.getState().updateMemberProfile(user);
  });

  // Workspace real-time event listeners
  hubConnection.on('WorkspaceJoined', (workspace: Workspace) => {
    useWorkspaceStore.getState().addWorkspace(workspace);
    if (hubConnection?.state === signalR.HubConnectionState.Connected) {
      hubConnection.invoke('JoinWorkspace', workspace.id).catch(() => {});
    }
  });

  hubConnection.on('WorkspaceMemberJoined', (data: { workspaceId: number; member: WorkspaceMember; memberCount?: number }) => {
    useWorkspaceStore.getState().memberJoined(data.workspaceId, data.member, data.memberCount);
    useChatStore.getState().workspaceMemberJoined(data.workspaceId, data.member);
  });

  hubConnection.on('WorkspaceMemberLeft', (data: { workspaceId: number; userId: number; memberCount?: number }) => {
    useWorkspaceStore.getState().memberLeft(data.workspaceId, data.userId, data.memberCount);
  });

  hubConnection.on('InviteCodeUpdated', (data: { workspaceId: number; inviteCode: string }) => {
    useWorkspaceStore.getState().updateInviteCode(data.workspaceId, data.inviteCode);
  });

  hubConnection.on('WorkspaceDeleted', (workspaceId: number) => {
    useWorkspaceStore.getState().removeWorkspace(Number(workspaceId));
  });

  hubConnection.on('ChannelKicked', (data: { channelId: number; channelName: string }) => {
    useChatStore.getState().removeChannel(Number(data.channelId));
  });

  hubConnection.on('JoinRequestReceived', (request: ChannelJoinRequest) => {
    useChatStore.getState().addJoinRequest(request);
  });

  hubConnection.on('JoinRequestApproved', async (data: { requestId: number; channelId: number; channel: Channel }) => {
    useChatStore.getState().removeJoinRequest(data.requestId);
    useChatStore.getState().addChannel(data.channel);
    useChatStore.getState().setActiveChannel(data.channel.id);
    if (hubConnection?.state === signalR.HubConnectionState.Connected) {
      await hubConnection.invoke('JoinChannel', data.channelId).catch(() => {});
    }
  });

  hubConnection.on('JoinRequestRejected', (data: { requestId: number; channelId: number; channelName: string }) => {
    useChatStore.getState().removeJoinRequest(data.requestId);
  });

  hubConnection.onreconnected(async () => {
    console.log('SignalR reconnected.');
    const channels = useChatStore.getState().channels;
    if (hubConnection?.state === signalR.HubConnectionState.Connected) {
      for (const ch of channels) {
        await hubConnection.invoke('JoinChannel', ch.id).catch(() => {});
      }
      const activeWsId = useWorkspaceStore.getState().activeWorkspaceId;
      if (activeWsId) {
        await hubConnection.invoke('JoinWorkspace', activeWsId).catch(() => {});
      }
    }
  });

  await hubConnection.start();
  console.log('SignalR Connected.');

  return hubConnection;
};

export const stopSignalRConnection = async (): Promise<void> => {
  if (hubConnection) {
    try {
      await hubConnection.stop();
    } catch (err) {
      console.error('Error stopping SignalR connection:', err);
    }
    hubConnection = null;
  }
};

export const joinChannel = async (channelId: number): Promise<void> => {
  if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) {
    return;
  }

  try {
    await hubConnection.invoke('JoinChannel', channelId);
  } catch (err) {
    console.error(`Failed to join channel ${channelId}:`, err);
  }
};

export const leaveChannel = async (channelId: number): Promise<void> => {
  if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) {
    return;
  }

  try {
    await hubConnection.invoke('LeaveChannel', channelId);
  } catch (err) {
    console.error(`Failed to leave channel ${channelId}:`, err);
  }
};

export const joinWorkspace = async (workspaceId: number): Promise<void> => {
  if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) {
    return;
  }

  try {
    await hubConnection.invoke('JoinWorkspace', workspaceId);
  } catch (err) {
    console.error(`Failed to join workspace ${workspaceId}:`, err);
  }
};

export const leaveWorkspace = async (workspaceId: number): Promise<void> => {
  if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) {
    return;
  }

  try {
    await hubConnection.invoke('LeaveWorkspace', workspaceId);
  } catch (err) {
    console.error(`Failed to leave workspace ${workspaceId}:`, err);
  }
};

export const sendMessage = async (channelId: number, content: string): Promise<void> => {
  if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) {
    throw new Error('Real-time connection is not active.');
  }

  await hubConnection.invoke('SendMessage', {
    channelId,
    content,
  });
};

export const sendReaction = async (
  channelId: number,
  messageId: number,
  emoji: string
): Promise<void> => {
  if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) {
    return;
  }

  try {
    await hubConnection.invoke('SendReaction', {
      channelId,
      messageId,
      emoji,
    });
  } catch (err) {
    console.error('Failed to send reaction:', err);
  }
};

export const sendTyping = async (channelId: number, isTyping: boolean): Promise<void> => {
  if (!hubConnection || hubConnection.state !== signalR.HubConnectionState.Connected) {
    return;
  }

  try {
    await hubConnection.invoke('SendTyping', channelId, isTyping);
  } catch (err) {
    console.error('Failed to send typing indicator:', err);
  }
};
