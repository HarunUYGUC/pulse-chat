import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, RefreshCw, UserPlus, ShieldAlert } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAuthStore } from '../../store/authStore';

interface WorkspaceInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkspaceInviteModal: React.FC<WorkspaceInviteModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { workspaces, activeWorkspaceId, regenerateInviteCode } = useWorkspaceStore();
  const { user } = useAuthStore();

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const isOwner = activeWorkspace && user && activeWorkspace.ownerId === user.id;

  if (!isOpen || !activeWorkspace) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeWorkspace.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard.');
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError(null);
    try {
      await regenerateInviteCode(activeWorkspace.id);
      setShowRegenConfirm(false);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to regenerate invite code.');
    } finally {
      setIsRegenerating(false);
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
            <UserPlus size={20} className="text-primary" />
            <h6 className="m-0 fw-bold text-white">Invite to {activeWorkspace.name}</h6>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-link text-secondary p-0"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-3">
          {error && (
            <div className="alert alert-danger py-2 small mb-3" role="alert">
              {error}
            </div>
          )}

          <p className="text-secondary small mb-3">
            Share this invite code with friends or teammates. Anyone with this code can join <strong className="text-white">{activeWorkspace.name}</strong> and see its public channels.
          </p>

          <label className="form-label text-secondary small fw-semibold text-uppercase">
            Workspace Invite Code
          </label>
          <div className="input-group mb-3">
            <input
              type="text"
              readOnly
              className="form-control form-control-dark font-monospace fw-bold text-primary"
              style={{ fontSize: '1.1rem', letterSpacing: '0.05em' }}
              value={activeWorkspace.inviteCode}
            />
            <button
              type="button"
              className={`btn ${copied ? 'btn-success' : 'btn-primary'} d-flex align-items-center gap-1 px-3`}
              onClick={handleCopy}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span className="small">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div className="p-2 rounded mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--pc-border)' }}>
            <div className="text-secondary small" style={{ fontSize: '0.78rem' }}>
              💡 Members can enter this code in the <strong>&quot;Join with Code&quot;</strong> tab on their workspace dock or during registration.
            </div>
          </div>

          {/* Owner controls */}
          {isOwner && (
            <div className="pt-2 border-top" style={{ borderColor: 'var(--pc-border)' }}>
              {!showRegenConfirm ? (
                <button
                  type="button"
                  className="btn btn-link btn-sm text-secondary text-decoration-none p-0 d-flex align-items-center gap-1"
                  onClick={() => setShowRegenConfirm(true)}
                >
                  <RefreshCw size={14} />
                  <span>Generate a new invite code</span>
                </button>
              ) : (
                <div className="p-2 rounded bg-danger bg-opacity-10 border border-danger border-opacity-25 mt-2">
                  <div className="d-flex align-items-start gap-2 mb-2">
                    <ShieldAlert size={16} className="text-danger flex-shrink-0 mt-1" />
                    <span className="small text-danger" style={{ fontSize: '0.8rem' }}>
                      Regenerating will revoke the current invite code. Past invite links/codes will stop working.
                    </span>
                  </div>
                  <div className="d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm py-0 px-2"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => setShowRegenConfirm(false)}
                      disabled={isRegenerating}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm py-0 px-2 d-flex align-items-center gap-1"
                      style={{ fontSize: '0.75rem' }}
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                    >
                      {isRegenerating && <RefreshCw size={12} className="spin" />}
                      <span>Yes, Regenerate</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
