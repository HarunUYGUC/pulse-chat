import React, { useState, useEffect } from 'react';
import { Hash, Lock, Search, X, Users, Check, Shield } from 'lucide-react';
import api from '../../services/api';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
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

  const loadBrowseChannels = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<BrowseChannel[]>('/channels/browse');
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
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleJoin = async (channelId: number) => {
    setActionLoading(channelId);
    try {
      await joinChannelById(channelId);
      onClose();
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
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '580px' }}>
        <div className="modal-content pc-modal">
          <div className="modal-header pc-modal-header border-0 pb-2">
            <div className="d-flex align-items-center gap-2">
              <Users size={20} className="text-secondary" />
              <h5 className="modal-title fw-bold text-white mb-0">Browse Channels</h5>
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
              Explore public channels available in the workspace. Join channels that interest you, or leave ones you no longer follow.
            </p>

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
                placeholder="Search channels by name or topic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            {isLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-secondary" role="status" />
                <div className="text-secondary small mt-2">Loading channels directory...</div>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="text-center py-4 text-secondary small">
                No channels found matching &ldquo;{searchTerm}&rdquo;.
              </div>
            ) : (
              <div className="d-flex flex-column gap-2" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {filteredChannels.map((channel) => {
                  const isBusy = actionLoading === channel.id;

                  return (
                    <div
                      key={channel.id}
                      className="p-3 rounded d-flex align-items-center justify-content-between"
                      style={{
                        backgroundColor: '#1e1f22',
                        border: '1px solid #383a40',
                        cursor: channel.isMember ? 'pointer' : 'default',
                      }}
                      onClick={() => handleSelect(channel)}
                    >
                      <div className="min-width-0 pe-3 flex-grow-1">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          {channel.isPrivate ? (
                            <Lock size={16} className="text-warning flex-shrink-0" />
                          ) : (
                            <Hash size={16} className="text-secondary flex-shrink-0" />
                          )}
                          <span className="fw-bold text-white small">{channel.name}</span>

                          {channel.isProtected && (
                            <span
                              className="badge rounded-pill d-inline-flex align-items-center gap-1"
                              style={{ backgroundColor: '#2b2d31', color: '#949ba4', fontSize: '0.65rem' }}
                            >
                              <Shield size={10} />
                              Default
                            </span>
                          )}

                          {channel.isMember && (
                            <span
                              className="badge rounded-pill d-inline-flex align-items-center gap-1"
                              style={{ backgroundColor: 'rgba(35, 165, 90, 0.2)', color: 'var(--pc-online)', fontSize: '0.65rem' }}
                            >
                              <Check size={10} />
                              Joined
                            </span>
                          )}
                        </div>

                        {channel.description && (
                          <div
                            className="text-secondary small text-truncate"
                            style={{ fontSize: '0.8rem' }}
                          >
                            {channel.description}
                          </div>
                        )}

                        <div className="text-secondary mt-1" style={{ fontSize: '0.72rem' }}>
                          <span>👥 {channel.memberCount} member{channel.memberCount === 1 ? '' : 's'}</span>
                          {channel.ownerUsername && (
                            <span className="ms-2">• Created by {channel.ownerUsername}</span>
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
