import React, { useState, useEffect } from 'react';
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

  return (
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
            className="btn btn-sm btn-link text-secondary p-0"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="d-flex border-bottom" style={{ borderColor: 'var(--pc-border)', backgroundColor: 'rgba(0,0,0,0.15)' }}>
          <button
            type="button"
            className={`btn flex-fill rounded-0 py-2 fw-semibold small d-flex align-items-center justify-content-center gap-2 ${
              activeTab === 'create'
                ? 'text-white border-bottom border-2 border-primary bg-transparent'
                : 'bg-transparent border-0'
            }`}
            style={activeTab !== 'create' ? { color: '#949ba4' } : undefined}
            onClick={() => {
              setActiveTab('create');
              setError(null);
            }}
          >
            <Plus size={16} />
            Create Workspace
          </button>
          <button
            type="button"
            className={`btn flex-fill rounded-0 py-2 fw-semibold small d-flex align-items-center justify-content-center gap-2 ${
              activeTab === 'join'
                ? 'text-white border-bottom border-2 border-primary bg-transparent'
                : 'bg-transparent border-0'
            }`}
            style={activeTab !== 'join' ? { color: '#949ba4' } : undefined}
            onClick={() => {
              setActiveTab('join');
              setError(null);
            }}
          >
            <LogIn size={16} />
            Join with Code
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
                  className="btn btn-secondary btn-sm px-3"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm px-3"
                  disabled={isSubmitting || !name.trim()}
                >
                  {isSubmitting ? 'Creating...' : 'Create Workspace'}
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
                <div className="input-group">
                  <span
                    className="input-group-text"
                    style={{
                      backgroundColor: 'var(--pc-bg-sidebar)',
                      borderColor: 'var(--pc-border)',
                      color: '#949ba4',
                    }}
                  >
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
                  className="btn btn-secondary btn-sm px-3"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success btn-sm px-3"
                  disabled={isSubmitting || !inviteCode.trim()}
                >
                  {isSubmitting ? 'Joining...' : 'Join Workspace'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
