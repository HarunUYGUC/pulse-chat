import React, { useState } from 'react';
import { Plus, MessageSquare } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { WorkspaceActionModal } from '../modals/WorkspaceActionModal';

export const WorkspaceSidebar: React.FC = () => {
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionTab, setActionTab] = useState<'create' | 'join'>('create');

  const { workspaces, activeWorkspaceId, setActiveWorkspaceId } = useWorkspaceStore();

  const getWorkspaceInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const getWorkspaceColor = (id: number) => {
    const colors = [
      '#5865F2', // Blurple
      '#57F287', // Green
      '#FEE75C', // Yellow
      '#EB459E', // Fuchsia
      '#ED4245', // Red
      '#00A8FC', // Cyan
      '#9B59B6', // Purple
    ];
    return colors[id % colors.length];
  };

  return (
    <>
      <nav className="workspace-sidebar" aria-label="Workspaces">
        {/* PulseChat Global Home Icon */}
        <div className="workspace-icon-wrapper" title="PulseChat">
          <div className="workspace-pill-active" style={{ height: activeWorkspaceId === null ? '40px' : '0px' }} />
          <button
            type="button"
            className={`workspace-icon-btn ${activeWorkspaceId === null ? 'active' : ''}`}
            style={{ backgroundColor: 'var(--pc-primary)', color: '#fff' }}
            onClick={() => {
              if (workspaces.length > 0) {
                setActiveWorkspaceId(workspaces[0].id);
              }
            }}
          >
            <MessageSquare size={24} />
          </button>
        </div>

        <div className="workspace-separator" />

        {/* Workspaces List */}
        <div className="workspace-list-container">
          {workspaces.map((ws) => {
            const isActive = activeWorkspaceId === ws.id;
            const initials = getWorkspaceInitials(ws.name);
            const color = getWorkspaceColor(ws.id);
            const unreadCount = ws.unreadCount || 0;
            const tooltip = `${ws.name} (${ws.memberCount} members)${
              unreadCount > 0 ? ` • ${unreadCount} unread message${unreadCount === 1 ? '' : 's'}` : ''
            }`;

            return (
              <div key={ws.id} className="workspace-icon-wrapper" title={tooltip}>
                <div
                  className={`workspace-pill-active ${isActive ? 'active' : ''}`}
                  style={{
                    height: isActive ? '40px' : unreadCount > 0 ? '8px' : '0px',
                  }}
                />
                <button
                  type="button"
                  className={`workspace-icon-btn ${isActive ? 'active' : ''}`}
                  style={{
                    backgroundColor: isActive ? color : 'var(--pc-bg-subnav)',
                    color: '#fff',
                  }}
                  onClick={() => setActiveWorkspaceId(ws.id)}
                >
                  <span className="fw-bold" style={{ fontSize: '0.9rem', letterSpacing: '0.03em' }}>
                    {initials}
                  </span>
                  {unreadCount > 0 && (
                    <span className="workspace-unread-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="workspace-separator" />

        {/* Add / Join Workspace Action Button */}
        <div className="workspace-icon-wrapper" title="Add or Join a Workspace">
          <div className="workspace-pill-active" style={{ height: '0px' }} />
          <button
            type="button"
            className="workspace-icon-btn add-btn"
            onClick={() => {
              setActionTab('create');
              setIsActionModalOpen(true);
            }}
          >
            <Plus size={22} />
          </button>
        </div>
      </nav>

      <WorkspaceActionModal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        defaultTab={actionTab}
      />
    </>
  );
};
