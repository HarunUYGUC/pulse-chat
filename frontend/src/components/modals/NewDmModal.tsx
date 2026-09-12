import React, { useState, useEffect } from 'react';
import { MessageCircle, X, Search, Check } from 'lucide-react';
import api from '../../services/api';
import { useChatStore } from '../../store/chatStore';
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

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

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

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 1050 }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px' }}>
        <div className="modal-content pc-modal">
          <div className="modal-header pc-modal-header border-0 pb-2">
            <div className="d-flex align-items-center gap-2">
              <MessageCircle size={20} className="text-secondary" />
              <h5 className="modal-title fw-bold text-white mb-0">Direct Messages</h5>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-link text-secondary p-0"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          <div className="modal-body pt-2">
            <p className="text-secondary small mb-3">
              Select a team member to start an instant 1-on-1 private conversation.
            </p>

            {error && (
              <div className="alert alert-danger py-2 px-3 small border-0 mb-3" role="alert">
                {error}
              </div>
            )}

            <div className="input-group mb-3">
              <span
                className="input-group-text border-0 text-secondary"
                style={{ backgroundColor: '#1e1f22' }}
              >
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-control pc-input"
                placeholder="Search by username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            <div
              className="user-list"
              style={{ maxHeight: '260px', overflowY: 'auto' }}
            >
              {filteredUsers.length === 0 ? (
                <div className="text-center py-4 text-secondary small">
                  No users found matching your search.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isOnline = onlineUsers.includes(user.username);
                  return (
                    <div
                      key={user.id}
                      className="d-flex align-items-center justify-content-between p-2 rounded mb-1"
                      style={{
                        backgroundColor: '#1e1f22',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.15s ease',
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
                          <div className="fw-semibold text-white small">{user.username}</div>
                          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>
                            {isOnline ? 'Online' : 'Offline'}
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
    </div>
  );
};
