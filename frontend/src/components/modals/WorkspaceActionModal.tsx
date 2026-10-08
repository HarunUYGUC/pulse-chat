import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, LogIn, Sparkles, Key } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

interface WorkspaceActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'create' | 'join';
}

export const WorkspaceActionModal: React.FC<WorkspaceActionModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'create',
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(defaultTab);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setError(null);
    }
  }, [isOpen, defaultTab]);

  const { createWorkspace, joinWorkspace } = useWorkspaceStore();

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('Workspace name must be at least 2 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createWorkspace({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to create workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = inviteCode.trim().toUpperCase();
    if (!trimmedCode) {
      setError('Please enter an invite code.');
      return;
    }

    setIsSubmitting(true);
    try {
      await joinWorkspace({ inviteCode: trimmedCode });
      setInviteCode('');
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to join workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="pc-modal-backdrop" onClick={onClose}>
      <div
        className="pc-modal-dialog"
        style={{ maxWidth: '440px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between p-3 border-bottom" style={{ borderColor: 'var(--pc-border)' }}>
          <div className="d-flex align-items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            <h6 className="m-0 fw-bold text-white">Workspaces</h6>
          </div>
          <button
            type="button"
            className="pc-modal-close-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="modal-tab-bar">
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('create');
              setError(null);
            }}
          >
            <Plus size={16} />
            <span>Create Workspace</span>
          </button>
          <button
            type="button"
            className={`modal-tab-btn join-tab ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('join');
              setError(null);
            }}
          >
            <LogIn size={16} />
            <span>Join with Code</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-3">
          {error && (
            <div className="alert alert-danger py-2 small mb-3" role="alert">
              {error}
            </div>
          )}

          {activeTab === 'create' ? (
            <form onSubmit={handleCreate}>
              <div className="small mb-3" style={{ color: '#b5bac1', lineHeight: 1.5 }}>
                Your workspace is where your team or friends hang out. Make it yours and invite members with a unique code!
              </div>

              <div className="mb-3">
                <label className="pc-form-label">
                  Workspace Name
                </label>
                <input
                  type="text"
                  className="form-control pc-input"
                  placeholder="e.g. Acme Dev Team, Gaming Club"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  required
                  autoFocus
                />
              </div>

              <div className="mb-3">
                <label className="pc-form-label">
                  Description <span className="fw-normal font-monospace" style={{ textTransform: 'none', fontSize: '0.75rem', color: '#949ba4' }}>(Optional)</span>
                </label>
                <textarea
                  className="form-control pc-input"
                  rows={2}
                  placeholder="What is this workspace about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="d-flex justify-content-end gap-2 pt-2">
                <button
                  type="button"
                  className="pc-action-btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pc-action-btn-primary"
                  disabled={isSubmitting || !name.trim()}
                >
                  <Plus size={16} />
                  <span>{isSubmitting ? 'Creating...' : 'Create Workspace'}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoin}>
              <div className="small mb-3" style={{ color: '#b5bac1', lineHeight: 1.5 }}>
                Enter an invite code below to join an existing workspace. Invite codes look like{' '}
                <code className="px-1 py-0.5 rounded text-white" style={{ backgroundColor: '#1e1f22', border: '1px solid #3f4147' }}>
                  PULSE-XXXXXX
                </code>
                .
              </div>

              <div className="mb-3">
                <label className="pc-form-label">
                  Invite Code
                </label>
                <div className="input-group pc-input-group">
                  <span className="input-group-text">
                    <Key size={16} />
                  </span>
                  <input
                    type="text"
                    className="form-control pc-input font-monospace fw-semibold"
                    placeholder="PULSE-XXXXXX"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 pt-2">
                <button
                  type="button"
                  className="pc-action-btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pc-action-btn-success"
                  disabled={isSubmitting || !inviteCode.trim()}
                >
                  <LogIn size={16} />
                  <span>{isSubmitting ? 'Joining...' : 'Join Workspace'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
