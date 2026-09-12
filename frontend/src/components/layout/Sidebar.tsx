import React, { useState } from 'react';
import {
  Hash,
  Lock,
  Plus,
  Compass,
  MessageSquare,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { CreateChannelModal } from '../modals/CreateChannelModal';
import { NewDmModal } from '../modals/NewDmModal';
import { BrowseChannelsModal } from '../modals/BrowseChannelsModal';

export const Sidebar: React.FC = () => {
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isDmModalOpen, setIsDmModalOpen] = useState(false);
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false);

  const { user, logout } = useAuthStore();
  const {
    channels,
    activeChannelId,
    setActiveChannel,
    unreadCounts,
    onlineUsers,
  } = useChatStore();

  const textChannels = channels.filter((c) => !c.IsDirectMessage && !c.isDirectMessage);
  const dmChannels = channels.filter((c) => c.IsDirectMessage || c.isDirectMessage);

  return (
    <>
      <div className="sidebar">
        {/* Workspace Brand Header */}
        <div className="sidebar-header">
          <div className="d-flex align-items-center gap-2">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded"
              style={{
                width: '28px',
                height: '28px',
                backgroundColor: 'var(--pc-primary)',
                color: '#fff',
              }}
            >
              <MessageSquare size={16} />
            </div>
            <span className="fw-bold tracking-tight">PulseChat</span>
          </div>
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
            {textChannels.map((channel) => {
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
            })}
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
    </>
  );
};
