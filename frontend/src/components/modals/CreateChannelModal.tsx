import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Hash, Lock, X, Check, Volume2 } from 'lucide-react';
import api from '../../services/api';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { Channel } from '../../types';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultChannelType?: 'text' | 'voice';
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  defaultChannelType = 'text',
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channelType, setChannelType] = useState<'text' | 'voice'>(defaultChannelType);
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addChannel, setActiveChannel, allUsers, fetchUsers } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const { activeWorkspaceId } = useWorkspaceStore();

  useEffect(() => {
    if (isOpen) {
      fetchUsers(activeWorkspaceId ?? undefined);
      setName('');
      setDescription('');
      setChannelType(defaultChannelType);
      setIsPrivate(false);
      setSelectedUserIds([]);
      setError(null);
    }
  }, [isOpen, fetchUsers, activeWorkspaceId, defaultChannelType]);

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
        type: channelType,
        workspaceId: activeWorkspaceId ?? undefined,
        isPrivate,
        initialMemberIds: isPrivate ? selectedUserIds : undefined,
      });

      addChannel(response.data);
      setActiveChannel(response.data.id);
      onClose();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Failed to create channel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const otherUsers = allUsers.filter((u) => u.id !== currentUser?.id);

  return createPortal(
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 2050 }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
        <div className="modal-content pc-modal">
          <div
            className="modal-header pc-modal-header d-flex align-items-center justify-content-between p-3 border-bottom"
            style={{ borderColor: 'var(--pc-border)' }}
          >
            <div className="d-flex align-items-center gap-2">
              {channelType === 'voice' ? (
                isPrivate ? (
                  <span
                    className="position-relative d-inline-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: '20px', height: '20px' }}
                    title="Private Voice Channel"
                  >
                    <Volume2 size={20} className="text-success" />
                    <Lock
                      size={11}
                      className="position-absolute text-warning"
                      style={{ bottom: '-2px', right: '-4px', strokeWidth: 2.8 }}
                    />
                  </span>
                ) : (
                  <Volume2 size={20} className="text-success" />
                )
              ) : isPrivate ? (
                <Lock size={20} className="text-warning" />
              ) : (
                <Hash size={20} className="text-primary" />
              )}
              <h5 className="modal-title fw-bold text-white mb-0">Create Channel</h5>
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

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-3">
              {error && (
                <div className="alert alert-danger py-2 px-3 small border-0 mb-3" role="alert">
                  {error}
                </div>
              )}

              {/* Channel Type Selector (Text vs Voice) */}
              <div className="mb-3">
                <label className="pc-form-label">CHANNEL TYPE</label>
                <div className="d-flex flex-column gap-2">
                  {/* Text Channel Option */}
                  <div
                    className="p-2 rounded d-flex align-items-center justify-content-between"
                    style={{
                      backgroundColor: channelType === 'text' ? 'rgba(88, 101, 242, 0.15)' : '#1e1f22',
                      border: channelType === 'text' ? '1px solid var(--pc-primary)' : '1px solid #383a40',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => setChannelType('text')}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <Hash size={22} className={channelType === 'text' ? 'text-primary' : 'text-secondary'} />
                      <div>
                        <div className="fw-semibold text-white small">Text Channel</div>
                        <div style={{ fontSize: '0.75rem', color: '#949ba4' }}>
                          Post messages, images, files, and emojis
                        </div>
                      </div>
                    </div>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: '18px',
                        height: '18px',
                        border: channelType === 'text' ? '5px solid var(--pc-primary)' : '2px solid #4e5058',
                        backgroundColor: '#fff',
                      }}
                    />
                  </div>

                  {/* Voice Channel Option */}
                  <div
                    className="p-2 rounded d-flex align-items-center justify-content-between"
                    style={{
                      backgroundColor: channelType === 'voice' ? 'rgba(35, 165, 90, 0.15)' : '#1e1f22',
                      border: channelType === 'voice' ? '1px solid #23a55a' : '1px solid #383a40',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => setChannelType('voice')}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <Volume2 size={22} className={channelType === 'voice' ? 'text-success' : 'text-secondary'} />
                      <div>
                        <div className="fw-semibold text-white small">Voice Channel</div>
                        <div style={{ fontSize: '0.75rem', color: '#949ba4' }}>
                          Hang out together with real-time voice and audio
                        </div>
                      </div>
                    </div>
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: '18px',
                        height: '18px',
                        border: channelType === 'voice' ? '5px solid #23a55a' : '2px solid #4e5058',
                        backgroundColor: '#fff',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Channel Name */}
              <div className="mb-3">
                <label className="pc-form-label">
                  CHANNEL NAME
                </label>
                <div className="pc-search-box">
                  <span className="pc-search-icon fw-bold fs-6" style={{ minWidth: '16px', textAlign: 'center' }}>
                    {channelType === 'voice' ? (
                      isPrivate ? (
                        <span
                          className="position-relative d-inline-flex align-items-center justify-content-center"
                          style={{ width: '16px', height: '16px' }}
                          title="Private Voice Channel"
                        >
                          <Volume2 size={16} className="text-success" />
                          <Lock
                            size={9}
                            className="position-absolute text-warning"
                            style={{ bottom: '-2px', right: '-3px', strokeWidth: 2.8 }}
                          />
                        </span>
                      ) : (
                        <Volume2 size={16} className="text-success" />
                      )
                    ) : isPrivate ? (
                      <Lock size={15} className="text-warning" />
                    ) : (
                      <Hash size={16} className="text-secondary" />
                    )}
                  </span>
                  <input
                    type="text"
                    placeholder={channelType === 'voice' ? 'e.g. general-voice, lounge' : 'e.g. project-x, marketing'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Topic / Description */}
              <div className="mb-3">
                <label className="pc-form-label">
                  Topic / Description <span className="fw-normal font-monospace" style={{ textTransform: 'none', fontSize: '0.75rem', color: '#949ba4' }}>(Optional)</span>
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
                      <Lock size={16} className={isPrivate ? 'text-warning' : 'text-primary'} />
                      <span className="fw-semibold text-white small">Make Private Channel</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#b5bac1', marginTop: '2px', lineHeight: 1.4 }}>
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
                    <div className="small fw-semibold mb-2" style={{ color: '#b5bac1' }}>
                      Invite Team Members ({selectedUserIds.length} selected):
                    </div>

                    {otherUsers.length === 0 ? (
                      <div className="small fst-italic" style={{ color: '#949ba4' }}>
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
                                border: isSelected ? '1px solid var(--pc-primary)' : '1px solid #383a40',
                                cursor: 'pointer',
                                transition: 'background-color 0.15s, border-color 0.15s',
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
                                  fontSize: '10px',
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
    </div>,
    document.body
  );
};
