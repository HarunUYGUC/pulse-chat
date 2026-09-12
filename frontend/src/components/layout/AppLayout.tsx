import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { ChatHeader } from './ChatHeader';
import { MembersSidebar } from './MembersSidebar';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { TypingIndicator } from '../chat/TypingIndicator';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { joinChannel } from '../../services/signalr';

export const AppLayout: React.FC = () => {
  const [isMembersOpen, setIsMembersOpen] = useState(true);

  const {
    channels,
    activeChannelId,
    fetchChannels,
  } = useChatStore();

  const { user } = useAuthStore();

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Join SignalR group whenever active channel changes
  useEffect(() => {
    if (activeChannelId) {
      joinChannel(activeChannelId);
    }
  }, [activeChannelId]);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const isDm = Boolean(activeChannel?.isDirectMessage || activeChannel?.IsDirectMessage);

  let displayName = activeChannel?.name || '';
  if (isDm && activeChannel?.members) {
    const otherMember = activeChannel.members.find((m) => m.id !== user?.id);
    if (otherMember) displayName = otherMember.username;
  }

  return (
    <div className="app-container">
      {/* 1. Left Navigation Sidebar */}
      <Sidebar />

      {/* 2. Center Chat Canvas */}
      <div className="chat-main">
        <ChatHeader
          onToggleMembers={() => setIsMembersOpen(!isMembersOpen)}
          isMembersOpen={isMembersOpen}
        />

        {activeChannel ? (
          <>
            <MessageList
              channelId={activeChannel.id}
              channelName={displayName}
              isDm={isDm}
            />

            <TypingIndicator />

            <MessageInput
              channelId={activeChannel.id}
              channelName={displayName}
              isDm={isDm}
            />
          </>
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 text-secondary">
            <div className="text-center">
              <h5>No channel selected</h5>
              <p className="small">Choose a channel from the left to start messaging.</p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Right Members Sidebar */}
      {isMembersOpen && !isDm && <MembersSidebar />}
    </div>
  );
};
