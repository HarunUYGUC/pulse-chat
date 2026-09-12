import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Check } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { Channel } from '../../types';

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
}

export const InviteMembersModal: React.FC<InviteMembersModalProps> = ({
  isOpen,
  onClose,
  channel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { allUsers, fetchUsers, inviteMembers } = useChatStore();

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setSelectedUserIds([]);
      setSearchTerm('');
    }
  }, [isOpen, fetchUsers]);

  if (!isOpen) return null;

  // Filter out users who are already members of this channel
  const currentMemberIds = new Set(channel.members?.map((m) => m.id) || []);
  const availableUsers = allUsers.filter((u) => !currentMemberIds.has(u.id));

  const filteredUsers = availableUsers.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await inviteMembers(channel.id, selectedUserIds);
      onClose();
    } catch (err) {
      console.error('Failed to invite members:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1100 }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '460px' }}>
        <div className="modal-content pc-modal">
          {/* Header */}
          <div className="modal-header pc-modal-header">
            <div className="d-flex align-items-center gap-2">
              <UserPlus size={20} className="text-primary" />
              <div>
                <h5 className="modal-title fw-bold text-white mb-0">Invite Members</h5>
                <span className="text-secondary small">Add members to #{channel.name}</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
            />
          </div>

          {/* Body */}
          <form onSubmit={handleInvite}>
            <div className="modal-body pc-modal-body">
              {/* Search Bar */}
              <div className="position-relative mb-3">
                <Search
                  size={16}
                  className="position-absolute top-50 translate-middle-y ms-3 text-secondary"
                />
                <input
                  type="text"
                  className="form-control pc-input ps-5"
                  placeholder="Search members by username or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Members List */}
              <div className="mb-2">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label text-secondary small fw-semibold text-uppercase mb-0">
                    Available Workspace Users ({availableUsers.length})
                  </label>
                  {selectedUserIds.length > 0 && (
                    <span className="badge bg-primary rounded-pill">
                      {selectedUserIds.length} selected
                    </span>
                  )}
                </div>

                <div
                  className="rounded border p-2 custom-scrollbar"
                  style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderColor: 'var(--pc-border)',
                  }}
                >
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-4 text-secondary small">
                      {availableUsers.length === 0
                        ? 'All workspace users are already in this channel.'
                        : 'No matching users found.'}
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          className="d-flex align-items-center justify-content-between p-2 rounded mb-1 cursor-pointer hover-bg-dark"
                          style={{
                            backgroundColor: isSelected ? 'rgba(88, 101, 242, 0.15)' : 'transparent',
                            transition: 'background-color 0.15s',
                          }}
                          onClick={() => toggleUser(u.id)}
                        >
                          <div className="d-flex align-items-center gap-2 min-width-0">
                            <img
                              src={
                                u.avatarUrl ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}&backgroundColor=5865f2`
                              }
                              alt={u.username}
                              className="rounded-circle flex-shrink-0"
                              style={{ width: '28px', height: '28px', objectFit: 'cover' }}
                            />
                            <div className="text-truncate">
                              <span className="text-white small fw-medium d-block text-truncate">
                                {u.username}
                              </span>
                              <span className="text-secondary" style={{ fontSize: '0.72rem' }}>
                                {u.email}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${
                              isSelected ? 'bg-primary text-white' : 'border border-secondary'
                            }`}
                            style={{ width: '20px', height: '20px' }}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer pc-modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn pc-btn-primary d-flex align-items-center gap-1"
                disabled={isSubmitting || selectedUserIds.length === 0}
              >
                <UserPlus size={16} />
                <span>
                  {isSubmitting
                    ? 'Inviting...'
                    : selectedUserIds.length > 0
                    ? `Invite (${selectedUserIds.length})`
                    : 'Select Members'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
