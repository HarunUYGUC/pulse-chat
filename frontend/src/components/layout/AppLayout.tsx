import React, { useState, useEffect } from 'react';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { Sidebar } from './Sidebar';
import { ChatHeader } from './ChatHeader';
import { MembersSidebar } from './MembersSidebar';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { TypingIndicator } from '../chat/TypingIndicator';
import { WorkspaceActionModal } from '../modals/WorkspaceActionModal';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { joinChannel, joinWorkspace } from '../../services/signalr';
import { Plus, LogIn, Users } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [isMembersOpen, setIsMembersOpen] = useState(true);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'create' | 'join'>('create');

  const {
    channels,
    activeChannelId,
  } = useChatStore();

  const { user } = useAuthStore();
  const {
    workspaces,
    activeWorkspaceId,
    fetchWorkspaces,
    isLoading: isWorkspaceLoading,
  } = useWorkspaceStore();

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Join SignalR workspace group whenever active workspace changes
  useEffect(() => {
    if (activeWorkspaceId) {
      joinWorkspace(activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

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

  const hasNoWorkspaces = !isWorkspaceLoading && workspaces.length === 0;

  return (
    <div className="app-container">
      {/* 1. Left-most Workspace Dock */}
      <WorkspaceSidebar />

      {/* 2. Channel & DM Navigation Sidebar */}
      <Sidebar />

      {/* 3. Center Chat Canvas or Onboarding Empty State */}
      <div className="chat-main">
        {hasNoWorkspaces ? (
          <div className="d-flex align-items-center justify-content-center h-100 p-4">
            <div className="text-center" style={{ maxWidth: '460px' }}>
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: 'rgba(88, 101, 242, 0.15)',
                  color: 'var(--pc-primary)',
                }}
              >
                <Users size={32} />
              </div>
              <h4 className="fw-bold text-white mb-2">Welcome to PulseChat!</h4>
              <p className="text-secondary small mb-4">
                To start chatting, create your own workspace or join an existing one using an invite code.
              </p>
              <div className="d-flex justify-content-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary d-flex align-items-center gap-2 px-3"
                  onClick={() => {
                    setModalTab('create');
                    setIsActionModalOpen(true);
                  }}
                >
                  <Plus size={16} />
                  <span>Create Workspace</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline-light d-flex align-items-center gap-2 px-3"
                  onClick={() => {
                    setModalTab('join');
                    setIsActionModalOpen(true);
                  }}
                >
                  <LogIn size={16} />
                  <span>Join with Code</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* 4. Right Members Sidebar */}
      {!hasNoWorkspaces && !isDm && <MembersSidebar isOpen={isMembersOpen} />}

      <WorkspaceActionModal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        defaultTab={modalTab}
      />
    </div>
  );
};
