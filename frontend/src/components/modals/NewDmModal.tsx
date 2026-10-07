import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X, Search, Check } from 'lucide-react';
import api from '../../services/api';
import { useChatStore } from '../../store/chatStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { Channel, User } from '../../types';

interface NewDmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewDmModal: React.FC<NewDmModalProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { allUsers, fetchUsers, addChannel, setActiveChannel, onlineUsers } = useChatStore();
  const { activeWorkspaceId } = useWorkspaceStore();

  useEffect(() => {
    if (isOpen) {
      fetchUsers(activeWorkspaceId ?? undefined);
    }
  }, [isOpen, fetchUsers, activeWorkspaceId]);

  if (!isOpen) return null;

  const filteredUsers = allUsers.filter((user) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartDm = async (targetUser: User) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await api.post<Channel>('/channels/dm', {
        targetUserId: targetUser.id,
      });

      addChannel(response.data);
      setActiveChannel(response.data.id);
      onClose();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Failed to start direct message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 2050 }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px' }}>
        <div className="modal-content pc-modal">
          <div
            className="modal-header pc-modal-header d-flex align-items-center justify-content-between p-3 border-bottom"
            style={{ borderColor: 'var(--pc-border)' }}
          >
            <div className="d-flex align-items-center gap-2">
              <MessageCircle size={20} className="text-primary" />
              <h5 className="modal-title fw-bold text-white mb-0">Direct Messages</h5>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-link p-1 ms-auto d-flex align-items-center justify-content-center rounded-circle"
              style={{
                width: '32px',
                height: '32px',
                color: '#949ba4',
                transition: 'background-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#949ba4';
              }}
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="modal-body p-3">
            <p className="small mb-3" style={{ color: '#b5bac1', lineHeight: 1.5 }}>
              Select a team member to start an instant 1-on-1 private conversation.
            </p>

            {error && (
              <div className="alert alert-danger py-2 px-3 small border-0 mb-3" role="alert">
                {error}
              </div>
            )}

            <div className="pc-search-box mb-3">
              <Search size={16} className="pc-search-icon" />
              <input
                type="text"
                placeholder="Search by username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            <div
              className="user-list"
              style={{ maxHeight: '280px', overflowY: 'auto' }}
            >
              {filteredUsers.length === 0 ? (
                <div className="text-center py-4 small" style={{ color: '#949ba4' }}>
                  No users found matching your search.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isOnline = onlineUsers.includes(user.username);
                  return (
                    <div
                      key={user.id}
                      className="d-flex align-items-center justify-content-between p-2 rounded mb-2"
                      style={{
                        backgroundColor: '#1e1f22',
                        border: '1px solid #383a40',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.15s ease, border-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#232529';
                        e.currentTarget.style.borderColor = '#4e5058';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#1e1f22';
                        e.currentTarget.style.borderColor = '#383a40';
                      }}
                      onClick={() => !isSubmitting && handleStartDm(user)}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div className="position-relative">
                          <img
                            src={
                              user.avatarUrl ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}&backgroundColor=5865f2`
                            }
                            alt={user.username}
                            className="rounded-circle"
                            style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                          />
                          <span
                            className={`status-indicator ${
                              isOnline ? 'status-online' : 'status-offline'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="fw-semibold text-white" style={{ fontSize: '0.92rem' }}>
                            {user.username}
                          </div>
                          <div style={{ fontSize: '0.75rem', marginTop: '1px' }}>
                            {isOnline ? (
                              <span style={{ color: '#23a55a', fontWeight: 500 }}>Online</span>
                            ) : (
                              <span style={{ color: '#949ba4' }}>Offline</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm pc-btn-primary py-1 px-3 d-flex align-items-center gap-1"
                        disabled={isSubmitting}
                      >
                        <Check size={14} />
                        <span>Chat</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="modal-footer pc-modal-footer border-0 pt-0">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm px-3"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
