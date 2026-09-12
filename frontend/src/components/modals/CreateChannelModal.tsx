import React, { useState, useEffect } from 'react';
import { Hash, Lock, X, Check } from 'lucide-react';
import api from '../../services/api';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { Channel } from '../../types';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addChannel, setActiveChannel, allUsers, fetchUsers } = useChatStore();
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setName('');
      setDescription('');
      setIsPrivate(false);
      setSelectedUserIds([]);
      setError(null);
    }
  }, [isOpen, fetchUsers]);

  if (!isOpen) return null;

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formattedName = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!formattedName || formattedName.length < 2) {
      setError('Channel name must be at least 2 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post<Channel>('/channels', {
        name: formattedName,
        description: description.trim() || undefined,
        isPrivate,
        initialMemberIds: isPrivate ? selectedUserIds : undefined,
      });

      addChannel(response.data);
      setActiveChannel(response.data.id);
      setName('');
      setDescription('');
      setIsPrivate(false);
      setSelectedUserIds([]);
      onClose();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Failed to create channel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const otherUsers = allUsers.filter((u) => u.id !== currentUser?.id);

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1050 }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
        <div className="modal-content pc-modal">
          <div className="modal-header pc-modal-header border-0 pb-0">
            <div className="d-flex align-items-center gap-2">
              {isPrivate ? (
                <Lock size={20} className="text-warning" />
              ) : (
                <Hash size={20} className="text-secondary" />
              )}
              <h5 className="modal-title fw-bold text-white mb-0">Create Channel</h5>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-link text-secondary p-0"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body pt-3">
              {error && (
                <div className="alert alert-danger py-2 px-3 small border-0 mb-3" role="alert">
                  {error}
                </div>
              )}

              {/* Channel Name */}
              <div className="mb-3">
                <label className="form-label small fw-bold text-uppercase text-secondary">
                  Channel Name
                </label>
                <div className="input-group">
                  <span
                    className="input-group-text border-0 text-secondary"
                    style={{ backgroundColor: '#1e1f22' }}
                  >
                    {isPrivate ? <Lock size={15} /> : '#'}
                  </span>
                  <input
                    type="text"
                    className="form-control pc-input"
                    placeholder="e.g. project-x, marketing"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Topic / Description */}
              <div className="mb-3">
                <label className="form-label small fw-bold text-uppercase text-secondary">
                  Topic / Description (Optional)
                </label>
                <textarea
                  className="form-control pc-input"
                  rows={2}
                  placeholder="What is this channel about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Private Channel Toggle */}
              <div
                className="p-3 rounded mb-3"
                style={{ backgroundColor: '#1e1f22', border: '1px solid #383a40' }}
              >
                <div className="d-flex align-items-center justify-content-between">
                  <div className="me-3">
                    <div className="d-flex align-items-center gap-2">
                      <Lock size={16} className={isPrivate ? 'text-warning' : 'text-secondary'} />
                      <span className="fw-semibold text-white small">Make Private Channel</span>
                    </div>
                    <div className="text-secondary" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                      {isPrivate
                        ? 'Only invited members can view or join this channel.'
                        : 'Anyone in the workspace can browse and join this channel.'}
                    </div>
                  </div>

                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="privateToggle"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      style={{ cursor: 'pointer', width: '2.5em', height: '1.3em' }}
                    />
                  </div>
                </div>

                {/* If Private: Invite Members Picker */}
                {isPrivate && (
                  <div className="mt-3 pt-3 border-top" style={{ borderColor: '#383a40' }}>
                    <div className="small fw-semibold text-secondary mb-2">
                      Invite Team Members ({selectedUserIds.length} selected):
                    </div>

                    {otherUsers.length === 0 ? (
                      <div className="text-secondary small fst-italic">
                        No other registered users in workspace yet.
                      </div>
                    ) : (
                      <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {otherUsers.map((target) => {
                          const isSelected = selectedUserIds.includes(target.id);
                          return (
                            <div
                              key={target.id}
                              className="d-flex align-items-center justify-content-between p-2 rounded mb-1"
                              style={{
                                backgroundColor: isSelected ? 'rgba(88, 101, 242, 0.15)' : '#2b2d31',
                                border: isSelected ? '1px solid var(--pc-primary)' : '1px solid transparent',
                                cursor: 'pointer',
                              }}
                              onClick={() => toggleUserSelection(target.id)}
                            >
                              <div className="d-flex align-items-center gap-2 text-truncate">
                                <img
                                  src={
                                    target.avatarUrl ||
                                    `https://api.dicebear.com/7.x/initials/svg?seed=${target.username}&backgroundColor=5865f2`
                                  }
                                  alt={target.username}
                                  className="rounded-circle"
                                  style={{ width: '24px', height: '24px', objectFit: 'cover' }}
                                />
                                <span className="small text-white text-truncate">{target.username}</span>
                              </div>

                              <div
                                className="rounded d-flex align-items-center justify-content-center"
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  backgroundColor: isSelected ? 'var(--pc-primary)' : '#1e1f22',
                                  border: '1px solid #4e5058',
                                  color: '#fff',
                                }}
                              >
                                {isSelected && <Check size={12} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer pc-modal-footer border-0 pt-0">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm px-3"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn pc-btn-primary btn-sm px-3"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Channel'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
