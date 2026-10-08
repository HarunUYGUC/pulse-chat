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
import { Plus, LogIn, Users, Menu, Sparkles } from 'lucide-react';

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
          <div className="d-flex flex-column h-100 position-relative w-100">
            {/* Mobile Header Bar when no workspaces exist (< 768px) */}
            <div
              className="d-flex d-md-none align-items-center px-3 py-2 border-bottom border-dark"
              style={{ minHeight: '52px', backgroundColor: 'var(--pc-bg-subnav)' }}
            >
              <button
                type="button"
                className="btn btn-dark btn-sm p-1 text-secondary me-2 d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px', borderRadius: '6px' }}
                onClick={() => setIsNavOpen(true)}
                title="Open Navigation"
                aria-label="Open Navigation"
              >
                <Menu size={18} />
              </button>
              <span className="fw-bold text-white small">PulseChat</span>
            </div>

            <div className="d-flex align-items-center justify-content-center flex-grow-1 p-3 p-sm-4">
              <div className="onboarding-card">
                <div className="onboarding-card-body">
                  <div className="onboarding-icon-badge" title="PulseChat">
                    <Users size={34} strokeWidth={2.2} />
                  </div>

                  <div>
                    <span className="onboarding-kicker">
                      <Sparkles size={12} className="me-1" />
                      Get Started
                    </span>
                  </div>

                  <h2 className="onboarding-title">Welcome to PulseChat!</h2>

                  <p className="onboarding-subtitle">
                    To start chatting, create your own workspace or join an existing community using an invite code.
                  </p>

                  <div className="d-flex flex-column flex-sm-row justify-content-center gap-3">
                    <button
                      type="button"
                      className="onboarding-btn-primary"
                      onClick={() => {
                        setModalTab('create');
                        setIsActionModalOpen(true);
                      }}
                    >
                      <Plus size={18} />
                      <span>Create Workspace</span>
                    </button>
                    <button
                      type="button"
                      className="onboarding-btn-join"
                      onClick={() => {
                        setModalTab('join');
                        setIsActionModalOpen(true);
                      }}
                    >
                      <LogIn size={18} />
                      <span>Join with Code</span>
                    </button>
                  </div>

                  <div className="onboarding-footer-note">
                    <span>💡</span>
                    <span>You can switch or add workspaces anytime from the left dock.</span>
                  </div>
                </div>
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
