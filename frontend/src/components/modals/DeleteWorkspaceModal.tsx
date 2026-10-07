import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { Workspace } from '../../types';

interface DeleteWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace | null;
}

export const DeleteWorkspaceModal: React.FC<DeleteWorkspaceModalProps> = ({
  isOpen,
  onClose,
  workspace,
}) => {
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { deleteWorkspace } = useWorkspaceStore();

  if (!isOpen || !workspace) return null;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmName.trim().toLowerCase() !== workspace.name.trim().toLowerCase()) {
      setError('The entered workspace name does not match.');
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await deleteWorkspace(workspace.id);
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'Failed to delete workspace.');
    } finally {
      setIsDeleting(false);
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
          <div className="d-flex align-items-center gap-2 text-danger">
            <AlertTriangle size={20} />
            <h6 className="m-0 fw-bold text-white">Delete &apos;{workspace.name}&apos;</h6>
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
        <form onSubmit={handleDelete} className="p-3">
          {error && (
            <div className="alert alert-danger py-2 small mb-3" role="alert">
              {error}
            </div>
          )}

          <div className="p-3 rounded mb-3 bg-danger bg-opacity-10 border border-danger border-opacity-25">
            <p className="small text-danger mb-0">
              Are you sure you want to delete <strong className="text-white">{workspace.name}</strong>? This action is permanent and cannot be undone. All channels, messages, and uploaded files will be completely removed.
            </p>
          </div>

          <div className="mb-3">
            <label className="form-label text-secondary small fw-semibold text-uppercase">
              To confirm, type <strong className="text-white">{workspace.name}</strong> below:
            </label>
            <input
              type="text"
              className="form-control form-control-dark"
              placeholder={workspace.name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="d-flex justify-content-end gap-2 pt-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm px-3"
              onClick={onClose}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger btn-sm px-3"
              disabled={isDeleting || confirmName.trim().toLowerCase() !== workspace.name.trim().toLowerCase()}
            >
              {isDeleting ? 'Deleting...' : 'Delete Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
