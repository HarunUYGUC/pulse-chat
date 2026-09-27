import React, { useState, useRef, useEffect } from 'react';
import {
  Hash,
  Lock,
  Plus,
  Compass,
  UserPlus,
  LogOut,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { CreateChannelModal } from '../modals/CreateChannelModal';
import { NewDmModal } from '../modals/NewDmModal';
import { BrowseChannelsModal } from '../modals/BrowseChannelsModal';
import { WorkspaceInviteModal } from '../modals/WorkspaceInviteModal';
import { DeleteWorkspaceModal } from '../modals/DeleteWorkspaceModal';

export const Sidebar: React.FC = () => {
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isDmModalOpen, setIsDmModalOpen] = useState(false);
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isWsMenuOpen, setIsWsMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const { user, logout } = useAuthStore();
  const {
    channels,
    activeChannelId,
    setActiveChannel,
    unreadCounts,
    onlineUsers,
  } = useChatStore();
  const { workspaces, activeWorkspaceId, leaveWorkspace } = useWorkspaceStore();

  const activeWorkspace = workspaces.find((w) => Number(w.id) === Number(activeWorkspaceId));
  const isOwner = Boolean(activeWorkspace && user && activeWorkspace.ownerId === user.id);
  const isDefaultCommunity = activeWorkspace?.id === 1 || activeWorkspace?.inviteCode === 'PULSE-DEMO';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsWsMenuOpen(false);
      }
    };
    if (isWsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isWsMenuOpen]);

  const textChannels = channels.filter((c) => !c.IsDirectMessage && !c.isDirectMessage);
  const dmChannels = channels.filter((c) => c.IsDirectMessage || c.isDirectMessage);

  return (
    <>
      <div className="sidebar">
        {/* Workspace Brand / Name Header with Dropdown Menu */}
        <div
          className="sidebar-header position-relative d-flex flex-column justify-content-center"
          style={{ cursor: activeWorkspace ? 'pointer' : 'default' }}
          ref={menuRef}
          onClick={() => activeWorkspace && setIsWsMenuOpen(!isWsMenuOpen)}
        >
          <div className="d-flex align-items-center justify-content-between w-100">
            <div className="d-flex align-items-center gap-2 text-truncate me-2">
              <span className="fw-bold tracking-tight text-white text-truncate" title={activeWorkspace?.name || 'PulseChat'}>
                {activeWorkspace?.name || 'PulseChat'}
              </span>
              {activeWorkspace && (
                <ChevronDown
                  size={16}
                  className={`text-secondary flex-shrink-0 transition-transform ${isWsMenuOpen ? 'rotate-180' : ''}`}
                />
              )}
            </div>
          </div>

          {activeWorkspace?.description && (
            <div
              className="text-secondary small mt-1"
              style={{
                fontSize: '0.74rem',
                lineHeight: '1.3',
                fontWeight: 400,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={activeWorkspace.description}
            >
              {activeWorkspace.description}
            </div>
          )}

          {/* Workspace Settings / Action Dropdown Menu */}
          {isWsMenuOpen && activeWorkspace && (
            <div
              className="position-absolute shadow-lg py-2 rounded"
              style={{
                top: 'calc(100% + 4px)',
                left: '8px',
                right: '8px',
                backgroundColor: 'var(--pc-bg-subnav)',
                border: '1px solid var(--pc-border)',
                zIndex: 1000,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 small text-white border-0 bg-transparent w-100"
                onClick={() => {
                  setIsWsMenuOpen(false);
                  setIsInviteModalOpen(true);
                }}
              >
                <UserPlus size={16} className="text-primary" />
                <span>Invite People</span>
              </button>

              {!isOwner && (
                <button
                  type="button"
                  className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 small text-warning border-0 bg-transparent w-100"
                  onClick={async () => {
                    setIsWsMenuOpen(false);
                    if (window.confirm(`Are you sure you want to leave ${activeWorkspace.name}?`)) {
                      await leaveWorkspace(activeWorkspace.id);
                    }
                  }}
                >
                  <LogOut size={16} />
                  <span>Leave Workspace</span>
                </button>
              )}

              {isOwner && !isDefaultCommunity && (
                <>
                  <div className="dropdown-divider my-1 border-secondary opacity-25" />
                  <button
                    type="button"
                    className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 small text-danger border-0 bg-transparent w-100"
                    onClick={() => {
                      setIsWsMenuOpen(false);
                      setIsDeleteModalOpen(true);
                    }}
                  >
                    <Trash2 size={16} />
                    <span>Delete Workspace</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="sidebar-content">
          {/* Channels Header & List */}
          <div className="sidebar-section-title">
            <span>Channels</span>
            <div className="d-flex align-items-center gap-1">
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-secondary"
                title="Browse Channels"
                onClick={() => setIsBrowseModalOpen(true)}
              >
                <Compass size={16} />
              </button>
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-secondary"
                title="Create Channel"
                onClick={() => setIsChannelModalOpen(true)}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="mb-3">
            {textChannels.length === 0 ? (
              <div
                className="text-secondary small px-2 py-1"
                style={{ fontSize: '0.8rem', fontStyle: 'italic' }}
              >
                No channels in this workspace yet.
              </div>
            ) : (
              textChannels.map((channel) => {
                const isActive = activeChannelId === channel.id;
                const unread = unreadCounts[channel.id] || 0;
                const isUnread = !isActive && unread > 0;
                const isPrivate = Boolean(channel.isPrivate);

                return (
                  <div
                    key={channel.id}
                    className={`sidebar-item ${isActive ? 'active' : ''} ${isUnread ? 'has-unread' : ''}`}
                    onClick={() => setActiveChannel(channel.id)}
                  >
                    {isUnread && <span className="unread-indicator-dot" />}
                    {isPrivate ? (
                      <Lock
                        size={16}
                        className={`channel-icon flex-shrink-0 ${isUnread ? 'text-white' : 'text-warning'}`}
                      />
                    ) : (
                      <Hash
                        size={18}
                        className={`channel-icon flex-shrink-0 ${isUnread ? 'text-white' : 'text-secondary'}`}
                      />
                    )}
                    <span className={`flex-grow-1 text-truncate small ${isUnread ? 'fw-bold text-white' : ''}`}>
                      {channel.name}
                    </span>
                    {unread > 0 && <span className="pc-badge-unread">{unread}</span>}
                  </div>
                );
              })
            )}
          </div>

          {/* Direct Messages Header & List */}
          <div className="sidebar-section-title">
            <span>Direct Messages</span>
            <button
              type="button"
              className="btn btn-sm btn-link p-0 text-secondary"
              title="New Direct Message"
              onClick={() => setIsDmModalOpen(true)}
            >
              <Plus size={16} />
            </button>
          </div>

          <div>
            {dmChannels.length === 0 ? (
              <div
                className="text-secondary small px-2 py-1"
                style={{ fontSize: '0.8rem', fontStyle: 'italic' }}
              >
                No direct messages yet.
              </div>
            ) : (
              dmChannels.map((dm) => {
                const isActive = activeChannelId === dm.id;
                const unread = unreadCounts[dm.id] || 0;
                const isUnread = !isActive && unread > 0;

                // Find the other member in DM
                const otherMember = dm.members?.find((m) => m.id !== user?.id);
                const displayName = otherMember ? otherMember.username : dm.name;
                const isOnline = onlineUsers.includes(displayName);

                return (
                  <div
                    key={dm.id}
                    className={`sidebar-item ${isActive ? 'active' : ''} ${isUnread ? 'has-unread' : ''}`}
                    onClick={() => setActiveChannel(dm.id)}
                  >
                    {isUnread && <span className="unread-indicator-dot" />}
                    <div className="position-relative flex-shrink-0">
                      <img
                        src={
                          otherMember?.avatarUrl ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}&backgroundColor=5865f2`
                        }
                        alt={displayName}
                        className="rounded-circle"
                        style={{ width: '22px', height: '22px', objectFit: 'cover' }}
                      />
                      <span
                        className={`status-indicator ${
                          isOnline ? 'status-online' : 'status-offline'
                        }`}
                        style={{ width: '8px', height: '8px', borderWidth: '1.5px' }}
                      />
                    </div>
                    <span className={`flex-grow-1 text-truncate small ${isUnread ? 'fw-bold text-white' : ''}`}>
                      {displayName}
                    </span>
                    {unread > 0 && <span className="pc-badge-unread">{unread}</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* User Status Bar Footer */}
        <div className="sidebar-footer">
          <div className="d-flex align-items-center gap-2 text-truncate" style={{ maxWidth: '180px' }}>
            <div className="position-relative flex-shrink-0">
              <img
                src={
                  user?.avatarUrl ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}&backgroundColor=5865f2`
                }
                alt={user?.username}
                className="rounded-circle"
                style={{ width: '32px', height: '32px', objectFit: 'cover' }}
              />
              <span className="status-indicator status-online" />
            </div>
            <div className="text-truncate">
              <div className="fw-semibold text-white small text-truncate">{user?.username}</div>
              <div className="text-secondary" style={{ fontSize: '0.7rem' }}>
                Online
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-link text-secondary p-1"
            title="Log Out"
            onClick={logout}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Modals */}
      <CreateChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
      />
      <NewDmModal
        isOpen={isDmModalOpen}
        onClose={() => setIsDmModalOpen(false)}
      />
      <BrowseChannelsModal
        isOpen={isBrowseModalOpen}
        onClose={() => setIsBrowseModalOpen(false)}
      />
      <WorkspaceInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
      <DeleteWorkspaceModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        workspace={activeWorkspace ?? null}
      />
    </>
  );
};
