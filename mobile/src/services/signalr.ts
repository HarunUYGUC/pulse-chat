import * as signalR from '@microsoft/signalr';
import { useChatStore } from '../store/chatStore';
import { HUB_URL } from '../config/env';
import {
  Message,
  TypingNotification,
  ReactionNotification,
  Channel,
  UserJoinedChannelNotification,
  UserLeftChannelNotification,
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

  hubConnection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => token,
      skipNegotiation: false,
      transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 1500, 5000, 10000])
    .configureLogging(signalR.LogLevel.Warning)
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
  });

  hubConnection.on('UserWentOffline', (username: string) => {
    useChatStore.getState().userWentOffline(username);
  });

  hubConnection.on('GetOnlineUsers', (users: string[]) => {
    useChatStore.getState().setOnlineUsers(users);
  });

  hubConnection.onreconnected(async () => {
    const channels = useChatStore.getState().channels;
    if (hubConnection?.state === signalR.HubConnectionState.Connected) {
      for (const ch of channels) {
        await hubConnection.invoke('JoinChannel', ch.id).catch(() => {});
      }
    }
  });

  await hubConnection.start();
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
