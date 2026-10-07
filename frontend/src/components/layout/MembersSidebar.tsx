import React, { useState, useEffect } from 'react';
import { UserPlus, UserX, Crown, Shield, ShieldCheck, ShieldMinus, X, Check } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { InviteMembersModal } from '../modals/InviteMembersModal';
import api from '../../services/api';
import { Channel, User } from '../../types';

interface MembersSidebarProps {
  isOpen?: boolean;
}

export const MembersSidebar: React.FC<MembersSidebarProps> = ({ isOpen = true }) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [memberToKick, setMemberToKick] = useState<User | null>(null);
  const [isKicking, setIsKicking] = useState(false);
  const [requestActionLoading, setRequestActionLoading] = useState<number | null>(null);
  const [roleActionLoading, setRoleActionLoading] = useState<number | null>(null);

  const {
    channels,
    activeChannelId,
    onlineUsers,
    joinRequests,
    fetchJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    addChannel,
    setActiveChannel,
    kickMember,
    updateMemberRole,
  } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const { workspaces } = useWorkspaceStore();

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const currentWorkspace = workspaces.find((w) => w.id === activeChannel?.workspaceId);
  const isWorkspaceOwner = Boolean(
    currentWorkspace && currentUser && currentWorkspace.ownerId === currentUser.id
  );

  // Channel Leader: channel owner OR (for protected/default channels like #general) workspace owner
  const isCurrentUserLeader = Boolean(
    currentUser && (
      (activeChannel?.ownerId && activeChannel.ownerId === currentUser.id) ||
      (!activeChannel?.ownerId && isWorkspaceOwner)
    )
  );

  const currentMember = activeChannel?.members?.find((m) => m.id === currentUser?.id);
  const isCurrentUserModerator = currentMember?.role === 'Moderator';
  const canManage = isCurrentUserLeader || isCurrentUserModerator;

  useEffect(() => {
    if (activeChannel?.id && canManage) {
      fetchJoinRequests(activeChannel.id);
    }
  }, [activeChannel?.id, canManage, fetchJoinRequests]);

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

  const handleToggleRole = async (targetUser: User, currentRole?: string) => {
    if (!activeChannel || !isCurrentUserLeader) return;
    const newRole = currentRole === 'Moderator' ? 'Member' : 'Moderator';
    setRoleActionLoading(targetUser.id);
    try {
      await updateMemberRole(activeChannel.id, targetUser.id, newRole);
    } catch (err) {
      console.error('Failed to update member role:', err);
    } finally {
      setRoleActionLoading(null);
    }
  };

  const handleConfirmKick = async () => {
    if (!memberToKick) return;
    setIsKicking(true);
    try {
      await kickMember(activeChannel.id, memberToKick.id);
      setMemberToKick(null);
    } catch (err) {
      console.error('Failed to kick member:', err);
    } finally {
      setIsKicking(false);
    }
  };

  const channelJoinRequests = canManage
    ? joinRequests.filter((r) => r.channelId === activeChannel.id)
    : [];

  const handleApproveRequest = async (requestId: number) => {
    setRequestActionLoading(requestId);
    try {
      await approveJoinRequest(activeChannel.id, requestId);
    } catch (err) {
      console.error('Failed to approve join request:', err);
    } finally {
      setRequestActionLoading(null);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    setRequestActionLoading(requestId);
    try {
      await rejectJoinRequest(activeChannel.id, requestId);
    } catch (err) {
      console.error('Failed to reject join request:', err);
    } finally {
      setRequestActionLoading(null);
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
          const isTargetLeader = Boolean(
            (activeChannel.ownerId && activeChannel.ownerId === member.id) ||
            (!activeChannel.ownerId && currentWorkspace?.ownerId === member.id) ||
            member.role === 'Owner'
          );
          const isTargetModerator = !isTargetLeader && member.role === 'Moderator';

          // Hierarchy permissions:
          // Leader can kick any non-leader; Moderator can only kick regular members
          const canKickThisMember = !isSelf && !isTargetLeader && (
            isCurrentUserLeader || (isCurrentUserModerator && !isTargetModerator)
          );

          // Only Channel Leader can assign/remove Moderator role
          const canChangeRoleThisMember = isCurrentUserLeader && !isSelf && !isTargetLeader;

          return (
            <div
              key={member.id}
              className="member-item d-flex align-items-center justify-content-between"
              title={isSelf ? 'You' : `Direct Message @${member.username}`}
              onClick={() => handleMemberClick(member)}
            >
              <div className="d-flex align-items-center gap-2 text-truncate me-2">
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

                <div className="text-truncate d-flex align-items-center gap-1">
                  <span className="small text-white fw-medium text-truncate">
                    {member.username}
                  </span>
                  {isTargetLeader && (
                    <span title="Channel Leader">
                      <Crown
                        size={13}
                        className="text-warning flex-shrink-0"
                      />
                    </span>
                  )}
                  {isTargetModerator && (
                    <span title="Moderator">
                      <Shield
                        size={13}
                        className="text-info flex-shrink-0"
                      />
                    </span>
                  )}
                  {isSelf && (
                    <span className="text-secondary ms-1 flex-shrink-0" style={{ fontSize: '0.75rem' }}>
                      (you)
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex align-items-center gap-1">
                {/* Promote / Demote Moderator (Only Channel Leader) */}
                {canChangeRoleThisMember && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link p-1 text-secondary opacity-75 hover-opacity-100 flex-shrink-0"
                    title={isTargetModerator ? 'Dismiss Moderator' : 'Make Moderator'}
                    disabled={roleActionLoading === member.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleRole(member, member.role);
                    }}
                  >
                    {isTargetModerator ? (
                      <ShieldMinus size={14} className="text-warning" />
                    ) : (
                      <ShieldCheck size={14} className="text-info" />
                    )}
                  </button>
                )}

                {/* Kick Member */}
                {canKickThisMember && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link p-1 text-secondary opacity-75 hover-opacity-100 flex-shrink-0"
                    title={`Remove @${member.username} from #${activeChannel.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMemberToKick(member);
                    }}
                  >
                    <UserX size={15} className="text-danger" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className={`members-sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-content">
          {/* Channel Leader & Moderator Pending Join Requests */}
          {canManage && channelJoinRequests.length > 0 && (
            <div
              className="mb-3 p-2 rounded"
              style={{
                backgroundColor: 'rgba(88, 101, 242, 0.08)',
                border: '1px solid rgba(88, 101, 242, 0.25)',
              }}
            >
              <div
                className="sidebar-section-title mb-2 text-primary fw-bold"
                style={{ fontSize: '0.7rem' }}
              >
                <span>JOIN REQUESTS — {channelJoinRequests.length}</span>
              </div>
              <div className="d-flex flex-column gap-2">
                {channelJoinRequests.map((req) => {
                  const isBusy = requestActionLoading === req.id;
                  return (
                    <div
                      key={req.id}
                      className="p-2 rounded"
                      style={{
                        backgroundColor: '#1e1f22',
                        border: '1px solid #383a40',
                      }}
                    >
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <img
                          src={
                            req.avatarUrl ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${req.username}&backgroundColor=5865f2`
                          }
                          alt={req.username}
                          className="rounded-circle"
                          style={{ width: '22px', height: '22px', objectFit: 'cover' }}
                        />
                        <span className="small text-white fw-medium text-truncate">
                          {req.username}
                        </span>
                      </div>

                      {req.wasPreviouslyKicked && (
                        <div
                          className="d-flex align-items-center gap-1 my-1 px-2 py-1 rounded"
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            lineHeight: '1.2',
                          }}
                        >
                          <span>⚠️ Previously kicked from channel</span>
                        </div>
                      )}

                      <div className="d-flex gap-1 mt-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-success d-flex align-items-center justify-content-center gap-1 flex-grow-1 py-0 px-2"
                          style={{ fontSize: '0.75rem', height: '26px' }}
                          disabled={isBusy}
                          onClick={() => handleApproveRequest(req.id)}
                        >
                          <Check size={13} />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center gap-1 flex-grow-1 py-0 px-2"
                          style={{ fontSize: '0.75rem', height: '26px' }}
                          disabled={isBusy}
                          onClick={() => handleRejectRequest(req.id)}
                        >
                          <X size={13} />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Members Button: in private channels, only Leader & Moderator can add members */}
          {activeChannel.isPrivate && canManage && (
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

      {/* Confirmation Modal to Kick/Remove Channel Member */}
      {memberToKick && (
        <div className="pc-modal-backdrop" onClick={() => setMemberToKick(null)}>
          <div
            className="pc-modal-dialog"
            style={{ maxWidth: '400px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-3 border-bottom d-flex align-items-center justify-content-between"
              style={{ borderColor: 'var(--pc-border)' }}
            >
              <h6 className="m-0 text-white fw-bold d-flex align-items-center gap-2">
                <UserX size={18} className="text-danger" />
                Remove from Channel
              </h6>
              <button
                type="button"
                className="btn btn-sm btn-link text-secondary p-0"
                onClick={() => setMemberToKick(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3">
              <p className="small text-secondary mb-3">
                Are you sure you want to remove <strong className="text-white">@{memberToKick.username}</strong> from{' '}
                <strong className="text-white">#{activeChannel.name}</strong>?
              </p>
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm px-3"
                  onClick={() => setMemberToKick(null)}
                  disabled={isKicking}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm px-3"
                  disabled={isKicking}
                  onClick={handleConfirmKick}
                >
                  {isKicking ? 'Removing...' : 'Remove Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
