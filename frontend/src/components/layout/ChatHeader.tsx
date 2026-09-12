import React, { useState, useRef, useEffect } from 'react';
import {
  Hash,
  AtSign,
  Users,
  Lock,
  MoreVertical,
  Trash2,
  LogOut,
  AlertTriangle,
  UserPlus,
  Edit3,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { InviteMembersModal } from '../modals/InviteMembersModal';
import { EditChannelModal } from '../modals/EditChannelModal';

interface ChatHeaderProps {
  onToggleMembers: () => void;
  isMembersOpen: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleMembers,
  isMembersOpen,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const { channels, activeChannelId, onlineUsers, deleteChannel, leaveChannel } = useChatStore();
  const { user } = useAuthStore();

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  if (!activeChannel) {
    return (
      <div className="chat-header">
        <span className="text-secondary small">Select a channel or direct message</span>
      </div>
    );
  }

  const isDm = Boolean(activeChannel.isDirectMessage || activeChannel.IsDirectMessage);
  const isPrivate = Boolean(activeChannel.isPrivate);
  const isProtected = Boolean(activeChannel.isProtected);
  const isOwner = Boolean(
    user && !isProtected && !isDm && (
      activeChannel.ownerId === user.id ||
      (!activeChannel.ownerId && activeChannel.ownerUsername === user.username)
    )
  );

  const otherMember = isDm
    ? activeChannel.members?.find((m) => m.id !== user?.id)
    : null;
  const displayName = isDm && otherMember ? otherMember.username : activeChannel.name;
  const isTargetOnline = otherMember ? onlineUsers.includes(otherMember.username) : false;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteChannel(activeChannel.id);
      setShowDeleteModal(false);
      setShowMenu(false);
    } catch (err) {
      console.error('Failed to delete channel:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveChannel(activeChannel.id);
      setShowMenu(false);
    } catch (err) {
      console.error('Failed to leave channel:', err);
    }
  };

  return (
    <>
      <div className="chat-header">
        <div className="d-flex align-items-center gap-2 min-width-0">
          {isDm ? (
            <AtSign size={20} className="text-secondary flex-shrink-0" />
          ) : isPrivate ? (
            <Lock size={20} className="text-warning flex-shrink-0" />
          ) : (
            <Hash size={20} className="text-secondary flex-shrink-0" />
          )}

          <div className="text-truncate">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-white small">{displayName}</span>
              {isDm && (
                <span
                  className="badge rounded-pill"
                  style={{
                    backgroundColor: isTargetOnline ? 'var(--pc-online)' : 'var(--pc-offline)',
                    fontSize: '0.65rem',
                    fontWeight: 500,
                  }}
                >
                  {isTargetOnline ? 'Online' : 'Offline'}
                </span>
              )}
            </div>
            {activeChannel.description && !isDm && (
              <div className="text-secondary text-truncate" style={{ fontSize: '0.75rem' }}>
                {activeChannel.description}
              </div>
            )}
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {!isDm && (
            <>
              {isPrivate && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 py-1 px-2 text-primary"
                  onClick={() => setShowInviteModal(true)}
                  title="Invite Members to Private Channel"
                >
                  <UserPlus size={16} />
                  <span className="small d-none d-sm-inline">Invite</span>
                </button>
              )}

              <button
                type="button"
                className={`btn btn-sm ${
                  isMembersOpen ? 'btn-secondary text-white' : 'btn-outline-secondary'
                } d-flex align-items-center gap-1 py-1 px-2`}
                onClick={onToggleMembers}
                title="Toggle Member List"
              >
                <Users size={16} />
                <span className="small d-none d-sm-inline">
                  {activeChannel.members?.length || 1}
                </span>
              </button>

              {/* Channel Options Dropdown */}
              <div className="position-relative" ref={menuRef}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary py-1 px-2 text-secondary"
                  onClick={() => setShowMenu(!showMenu)}
                  title="Channel Settings"
                >
                  <MoreVertical size={16} />
                </button>

                {showMenu && (
                  <div
                    className="position-absolute end-0 top-100 mt-1 p-2 rounded shadow-lg"
                    style={{
                      backgroundColor: '#1e1f22',
                      border: '1px solid #383a40',
                      width: '210px',
                      zIndex: 100,
                    }}
                  >
                    <div className="px-2 py-1 mb-1 border-bottom" style={{ borderColor: '#383a40' }}>
                      <div className="text-white small fw-bold text-truncate">#{activeChannel.name}</div>
                      {isProtected ? (
                        <div className="text-secondary" style={{ fontSize: '0.7rem' }}>
                          🛡️ Default System Channel
                        </div>
                      ) : activeChannel.ownerUsername ? (
                        <div className="text-secondary" style={{ fontSize: '0.7rem' }}>
                          Created by {activeChannel.ownerUsername}
                        </div>
                      ) : null}
                    </div>

                    {isPrivate && (
                      <button
                        type="button"
                        className="btn btn-sm w-100 text-start d-flex align-items-center gap-2 py-1 px-2 text-primary hover-white"
                        style={{ background: 'none', border: 'none' }}
                        onClick={() => {
                          setShowMenu(false);
                          setShowInviteModal(true);
                        }}
                      >
                        <UserPlus size={14} />
                        <span className="small">Invite Members</span>
                      </button>
                    )}

                    {!isDm && (isOwner || isProtected) && (
                      <button
                        type="button"
                        className="btn btn-sm w-100 text-start d-flex align-items-center gap-2 py-1 px-2 text-secondary hover-white"
                        style={{ background: 'none', border: 'none' }}
                        onClick={() => {
                          setShowMenu(false);
                          setShowEditModal(true);
                        }}
                      >
                        <Edit3 size={14} />
                        <span className="small">Edit Description</span>
                      </button>
                    )}

                    {!isOwner && !isProtected && (
                      <button
                        type="button"
                        className="btn btn-sm w-100 text-start d-flex align-items-center gap-2 py-1 px-2 text-secondary hover-white"
                        style={{ background: 'none', border: 'none' }}
                        onClick={handleLeave}
                      >
                        <LogOut size={14} />
                        <span className="small">Leave Channel</span>
                      </button>
                    )}

                    {isOwner && !isProtected && (
                      <button
                        type="button"
                        className="btn btn-sm w-100 text-start d-flex align-items-center gap-2 py-1 px-2 text-danger"
                        style={{ background: 'none', border: 'none' }}
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteModal(true);
                        }}
                      >
                        <Trash2 size={14} />
                        <span className="small fw-semibold">Delete Channel</span>
                      </button>
                    )}

                    {isProtected && (
                      <div className="text-secondary px-2 py-1" style={{ fontSize: '0.7rem' }}>
                        🛡️ Protected system channel cannot be deleted or left.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Channel Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1100 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px' }}>
            <div className="modal-content pc-modal">
              <div className="modal-header pc-modal-header border-0 pb-0">
                <div className="d-flex align-items-center gap-2 text-danger">
                  <AlertTriangle size={22} />
                  <h5 className="modal-title fw-bold text-white mb-0">Delete Channel</h5>
                </div>
              </div>

              <div className="modal-body pt-3">
                <p className="text-secondary small mb-2">
                  Are you sure you want to delete <strong className="text-white">#{activeChannel.name}</strong>?
                </p>
                <div
                  className="p-3 rounded small text-danger"
                  style={{ backgroundColor: 'rgba(242, 63, 67, 0.1)', border: '1px solid rgba(242, 63, 67, 0.3)' }}
                >
                  ⚠️ This action is permanent. All messages, files, and reactions in this channel will be permanently removed for all members.
                </div>
              </div>

              <div className="modal-footer pc-modal-footer border-0 pt-0">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-3"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm px-3"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Channel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <InviteMembersModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          channel={activeChannel}
        />
      )}

      {showEditModal && (
        <EditChannelModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          channel={activeChannel}
        />
      )}
    </>
  );
};
