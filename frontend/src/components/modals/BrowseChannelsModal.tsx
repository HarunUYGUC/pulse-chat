import React, { useState, useEffect } from 'react';
import { Hash, Lock, Search, X, Users, Check, Shield, Volume2 } from 'lucide-react';
import api from '../../services/api';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { BrowseChannel } from '../../types';

interface BrowseChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BrowseChannelsModal: React.FC<BrowseChannelsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [channels, setChannels] = useState<BrowseChannel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const { user: currentUser } = useAuthStore();
  const { joinChannelById, leaveChannel, setActiveChannel } = useChatStore();
  const { activeWorkspaceId } = useWorkspaceStore();

  const loadBrowseChannels = async () => {
    setIsLoading(true);
    try {
      const url = activeWorkspaceId
        ? `/channels/browse?workspaceId=${activeWorkspaceId}`
        : '/channels/browse';
      const response = await api.get<BrowseChannel[]>(url);
      setChannels(response.data);
    } catch (err) {
      console.error('Failed to load channels directory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBrowseChannels();
      setSearchTerm('');
    }
  }, [isOpen, activeWorkspaceId]);

  if (!isOpen) return null;

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleJoin = async (channelId: number) => {
    setActionLoading(channelId);
    try {
      const result = await joinChannelById(channelId);
      if (result?.isPending) {
        await loadBrowseChannels();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Failed to join channel:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeave = async (channelId: number) => {
    setActionLoading(channelId);
    try {
      await leaveChannel(channelId);
      await loadBrowseChannels();
    } catch (err) {
      console.error('Failed to leave channel:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelect = (channel: BrowseChannel) => {
    if (channel.isMember) {
      setActiveChannel(channel.id);
      onClose();
    }
  };

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1050 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '600px' }}>
        <div className="modal-content pc-modal">
          <div
            className="modal-header pc-modal-header d-flex align-items-center justify-content-between p-3 border-bottom"
            style={{ borderColor: 'var(--pc-border)' }}
          >
            <div className="d-flex align-items-center gap-2">
              <Users size={20} className="text-primary" />
              <h5 className="modal-title fw-bold text-white mb-0">Browse Channels</h5>
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
              Explore public channels available in the workspace. Join channels that interest you, or leave ones you no longer follow.
            </p>

            <div className="pc-search-box mb-3">
              <Search size={16} className="pc-search-icon" />
              <input
                type="text"
                placeholder="Search channels by name or topic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            {isLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" role="status" />
                <div className="small mt-2" style={{ color: '#949ba4' }}>Loading channels directory...</div>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="text-center py-4 small" style={{ color: '#949ba4' }}>
                No channels found matching &ldquo;{searchTerm}&rdquo;.
              </div>
            ) : (
              <div className="d-flex flex-column gap-2" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {filteredChannels.map((channel) => {
                  const isBusy = actionLoading === channel.id;

                  return (
                    <div
                      key={channel.id}
                      className="p-3 rounded d-flex align-items-center justify-content-between gap-3"
                      style={{
                        backgroundColor: '#1e1f22',
                        border: '1px solid #383a40',
                        cursor: channel.isMember ? 'pointer' : 'default',
                        transition: 'background-color 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#4e5058';
                        e.currentTarget.style.backgroundColor = '#232529';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#383a40';
                        e.currentTarget.style.backgroundColor = '#1e1f22';
                      }}
                      onClick={() => handleSelect(channel)}
                    >
                      <div className="pe-1 flex-grow-1" style={{ minWidth: 0, overflow: 'hidden' }}>
                        <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                          {channel.type === 'voice' ? (
                            channel.isPrivate ? (
                              <span
                                className="position-relative d-inline-flex align-items-center justify-content-center flex-shrink-0"
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
                              <Volume2 size={16} className="text-success flex-shrink-0" />
                            )
                          ) : channel.isPrivate ? (
                            <Lock size={16} className="text-warning flex-shrink-0" />
                          ) : (
                            <Hash size={16} className="text-secondary flex-shrink-0" />
                          )}
                          <span
                            className="fw-semibold text-white text-truncate"
                            style={{ fontSize: '0.92rem', maxWidth: '240px' }}
                            title={channel.name}
                          >
                            {channel.name}
                          </span>

                          {channel.isProtected && (
                            <span
                              className="badge rounded-pill d-inline-flex align-items-center gap-1 flex-shrink-0"
                              style={{ backgroundColor: '#2b2d31', color: '#b5bac1', fontSize: '0.68rem', border: '1px solid #3f4147' }}
                            >
                              <Shield size={10} />
                              Default
                            </span>
                          )}

                          {channel.isMember && (
                            <span
                              className="badge rounded-pill d-inline-flex align-items-center gap-1 flex-shrink-0"
                              style={{ backgroundColor: 'rgba(35, 165, 90, 0.2)', color: '#23a55a', fontSize: '0.68rem', border: '1px solid rgba(35, 165, 90, 0.35)' }}
                            >
                              <Check size={10} />
                              Joined
                            </span>
                          )}

                          {channel.hasPendingJoinRequest && (
                            <span
                              className="badge rounded-pill d-inline-flex align-items-center gap-1 flex-shrink-0"
                              style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#facc15', fontSize: '0.68rem', border: '1px solid rgba(234, 179, 8, 0.35)' }}
                            >
                              Pending Approval
                            </span>
                          )}

                          {channel.wasKicked && !channel.hasPendingJoinRequest && !channel.isMember && (
                            <span
                              className="badge rounded-pill d-inline-flex align-items-center gap-1 flex-shrink-0"
                              style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.68rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                            >
                              Removed by Leader
                            </span>
                          )}
                        </div>

                        {channel.description && (
                          <div
                            className="text-truncate"
                            style={{
                              color: '#b5bac1',
                              fontSize: '0.82rem',
                              lineHeight: 1.4,
                            }}
                            title={channel.description}
                          >
                            {channel.description}
                          </div>
                        )}

                        <div className="mt-1 d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.75rem', color: '#949ba4' }}>
                          <span>👥 {channel.memberCount} member{channel.memberCount === 1 ? '' : 's'}</span>
                          {channel.ownerUsername && (
                            <span>• Created by <strong className="text-light fw-medium">{channel.ownerUsername}</strong></span>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {channel.isMember ? (
                          channel.isProtected || (currentUser && channel.ownerId === currentUser.id) ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary py-1 px-3"
                              onClick={() => handleSelect(channel)}
                            >
                              Open
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger py-1 px-3"
                              disabled={isBusy}
                              onClick={() => handleLeave(channel.id)}
                            >
                              {isBusy ? 'Leaving...' : 'Leave'}
                            </button>
                          )
                        ) : channel.hasPendingJoinRequest ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary py-1 px-3 opacity-75"
                            disabled
                          >
                            Pending Approval
                          </button>
                        ) : channel.wasKicked ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-warning text-dark py-1 px-3 fw-medium"
                            disabled={isBusy}
                            onClick={() => handleJoin(channel.id)}
                            title="You were previously removed from this channel. A join request will be sent to the channel leader."
                          >
                            {isBusy ? 'Requesting...' : 'Request to Join'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm pc-btn-primary py-1 px-3"
                            disabled={isBusy}
                            onClick={() => handleJoin(channel.id)}
                          >
                            {isBusy ? 'Joining...' : 'Join Channel'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="modal-footer pc-modal-footer border-0 pt-0">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm px-3"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
