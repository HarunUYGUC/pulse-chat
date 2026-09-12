import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { InviteMembersModal } from '../modals/InviteMembersModal';
import api from '../../services/api';
import { Channel, User } from '../../types';

export const MembersSidebar: React.FC = () => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const { channels, activeChannelId, onlineUsers, addChannel, setActiveChannel } = useChatStore();
  const { user: currentUser } = useAuthStore();

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  if (!activeChannel || activeChannel.isDirectMessage || activeChannel.IsDirectMessage) {
    return null;
  }

  const members = activeChannel.members || [];
  const onlineMembers: User[] = [];
  const offlineMembers: User[] = [];

  members.forEach((m) => {
    if (onlineUsers.includes(m.username)) {
      onlineMembers.push(m);
    } else {
      offlineMembers.push(m);
    }
  });

  const handleMemberClick = async (targetUser: User) => {
    if (targetUser.id === currentUser?.id) return;

    try {
      const response = await api.post<Channel>('/channels/dm', {
        targetUserId: targetUser.id,
      });
      addChannel(response.data);
      setActiveChannel(response.data.id);
    } catch (err) {
      console.error('Failed to open DM:', err);
    }
  };

  const renderMemberList = (title: string, list: User[], isOnline: boolean) => {
    if (list.length === 0) return null;

    return (
      <div className="mb-3">
        <div className="sidebar-section-title">
          <span>{`${title} — ${list.length}`}</span>
        </div>
        {list.map((member) => {
          const isSelf = member.id === currentUser?.id;
          return (
            <div
              key={member.id}
              className="member-item"
              title={isSelf ? 'You' : `Direct Message @${member.username}`}
              onClick={() => handleMemberClick(member)}
            >
              <div className="position-relative flex-shrink-0">
                <img
                  src={
                    member.avatarUrl ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${member.username}&backgroundColor=5865f2`
                  }
                  alt={member.username}
                  className="rounded-circle"
                  style={{ width: '28px', height: '28px', objectFit: 'cover' }}
                />
                <span
                  className={`status-indicator ${
                    isOnline ? 'status-online' : 'status-offline'
                  }`}
                  style={{ width: '8px', height: '8px', borderWidth: '1.5px' }}
                />
              </div>

              <div className="text-truncate">
                <span className="small text-white fw-medium">
                  {member.username}
                  {isSelf && (
                    <span className="text-secondary ms-1" style={{ fontSize: '0.75rem' }}>
                      (you)
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="members-sidebar">
        <div className="sidebar-content">
          {activeChannel.isPrivate && (
            <div className="p-2 mb-2 border-bottom" style={{ borderColor: 'var(--pc-border)' }}>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-1 py-1"
                onClick={() => setIsInviteModalOpen(true)}
              >
                <UserPlus size={14} />
                <span className="small">Add Members</span>
              </button>
            </div>
          )}
          {renderMemberList('Online', onlineMembers, true)}
          {renderMemberList('Offline', offlineMembers, false)}
        </div>
      </div>

      {isInviteModalOpen && (
        <InviteMembersModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          channel={activeChannel}
        />
      )}
    </>
  );
};
