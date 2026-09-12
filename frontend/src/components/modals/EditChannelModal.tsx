import React, { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { Channel } from '../../types';

interface EditChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
}

export const EditChannelModal: React.FC<EditChannelModalProps> = ({
  isOpen,
  onClose,
  channel,
}) => {
  const [description, setDescription] = useState(channel.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { updateChannelDescription } = useChatStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateChannelDescription(channel.id, description);
      onClose();
    } catch (err) {
      console.error('Failed to update channel description:', err);
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
              <Edit3 size={20} className="text-primary" />
              <div>
                <h5 className="modal-title fw-bold text-white mb-0">Edit Channel</h5>
                <span className="text-secondary small">Update #{channel.name} description</span>
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
          <form onSubmit={handleSubmit}>
            <div className="modal-body pc-modal-body">
              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold text-uppercase">
                  Channel Description
                </label>
                <textarea
                  className="form-control pc-input"
                  rows={4}
                  placeholder="What is this channel about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={250}
                  autoFocus
                />
                <div className="text-secondary text-end mt-1" style={{ fontSize: '0.72rem' }}>
                  {description.length}/250
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
                className="btn pc-btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Description'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
