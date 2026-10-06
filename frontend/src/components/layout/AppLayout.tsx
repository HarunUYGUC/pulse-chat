import React, { useState, useEffect, useRef } from 'react';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { Sidebar } from './Sidebar';
import { ChatHeader } from './ChatHeader';
import { MembersSidebar } from './MembersSidebar';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { TypingIndicator } from '../chat/TypingIndicator';
import { VoiceStage } from '../voice/VoiceStage';
import { WorkspaceActionModal } from '../modals/WorkspaceActionModal';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { joinChannel, joinWorkspace } from '../../services/signalr';
import { Plus, LogIn, Users } from 'lucide-react';

export const AppLayout: React.FC = () => {
  // Members open by default on desktop (>=1024px), closed on smaller screens
  const [isMembersOpen, setIsMembersOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );
  // Remember user's desktop preference so it cleanly restores when expanding back to desktop
  const wasDesktopMembersOpenRef = useRef<boolean>(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const prevWidthRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  // Navigation drawer (Workspaces + Channels) open/closed on mobile (<768px)
  const [isNavOpen, setIsNavOpen] = useState(false);
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

  // Automatically adapt sidebar states when resizing window
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      // Temporarily disable CSS transitions during active window resizing to eliminate breakpoint flicker
      document.body.classList.add('is-resizing');
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        document.body.classList.remove('is-resizing');
      }, 120);

      const width = window.innerWidth;
      const prevWidth = prevWidthRef.current;
      prevWidthRef.current = width;

      // Crossing from desktop (>= 1024) to tablet/mobile (< 1024)
      if (prevWidth >= 1024 && width < 1024) {
        setIsMembersOpen(false);
      }
      // Crossing from tablet/mobile (< 1024) back to desktop (>= 1024)
      else if (prevWidth < 1024 && width >= 1024) {
        setIsMembersOpen(wasDesktopMembersOpenRef.current);
      }

      if (width >= 768) {
        setIsNavOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
      document.body.classList.remove('is-resizing');
    };
  }, []);

  const handleToggleMembers = () => {
    setIsMembersOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        wasDesktopMembersOpenRef.current = next;
      }
      return next;
    });
  };

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
      {/* Mobile Backdrop for Navigation Drawer (< 768px) */}
      {isNavOpen && (
        <div
          className="mobile-backdrop d-md-none"
          onClick={() => setIsNavOpen(false)}
        />
      )}

      {/* Mobile/Tablet Backdrop for Members Drawer (< 1024px) */}
      {isMembersOpen && (
        <div
          className="mobile-backdrop d-lg-none"
          onClick={() => setIsMembersOpen(false)}
        />
      )}

      {/* 1 & 2. Navigation Drawer (Workspace Dock + Channels Sidebar) */}
      <div className={`nav-drawer ${isNavOpen ? 'nav-open' : 'nav-closed'}`}>
        <WorkspaceSidebar />
        <Sidebar
          onChannelSelect={() => {
            if (window.innerWidth < 768) {
              setIsNavOpen(false);
            }
          }}
        />
      </div>

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
              onToggleMembers={handleToggleMembers}
              isMembersOpen={isMembersOpen}
              onToggleNav={() => setIsNavOpen(!isNavOpen)}
            />

            {activeChannel ? (
              activeChannel.type === 'voice' ? (
                <VoiceStage channel={activeChannel} />
              ) : (
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
              )
            ) : (
              <div className="d-flex align-items-center justify-content-center h-100 text-secondary">
                <div className="text-center px-3">
                  <h5>No channel selected</h5>
                  <p className="small">Choose a channel from the left to start messaging.</p>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm d-md-none mt-2"
                    onClick={() => setIsNavOpen(true)}
                  >
                    Open Channels
                  </button>
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
