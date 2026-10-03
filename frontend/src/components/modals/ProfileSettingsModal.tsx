import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  X,
  Sparkles,
  RotateCcw,
  Key,
  Eye,
  EyeOff,
  Check,
  Calendar,
  Mail,
  ShieldCheck,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { UpdateProfileData } from '../../types';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_PRESETS = [
  { id: 'bottts-1', name: 'CyberPulse', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberPulse' },
  { id: 'bottts-2', name: 'Quantum', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Quantum' },
  { id: 'adventurer-1', name: 'Alex', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alex' },
  { id: 'adventurer-2', name: 'Nova', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Nova' },
  { id: 'fun-emoji-1', name: 'Spark', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Cool' },
  { id: 'lorelei-1', name: 'Luna', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Luna' },
  { id: 'pixel-art-1', name: 'Retro', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Retro' },
  { id: 'notionists-1', name: 'Sketch', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Sketch' },
];

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customAvatarInput, setCustomAvatarInput] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize or reset when modal opens or user changes
  useEffect(() => {
    if (isOpen && user) {
      setActiveTab('profile');
      setUsername(user.username || '');
      setAvatarUrl(user.avatarUrl || '');
      setCustomAvatarInput(user.avatarUrl || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setError(null);
      setCurrentPasswordError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleCustomAvatarChange = (url: string) => {
    setCustomAvatarInput(url);
    setAvatarUrl(url);
  };

  const handleSelectPreset = (url: string) => {
    setAvatarUrl(url);
    setCustomAvatarInput(url);
  };

  const handleRandomizeAvatar = () => {
    const styles = ['bottts', 'adventurer', 'lorelei', 'fun-emoji', 'pixel-art', 'notionists', 'big-smile'];
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    const randomSeed = Math.random().toString(36).substring(2, 9);
    const newUrl = `https://api.dicebear.com/7.x/${randomStyle}/svg?seed=${randomSeed}`;
    setAvatarUrl(newUrl);
    setCustomAvatarInput(newUrl);
  };

  const handleResetToInitials = () => {
    const seed = username.trim() || user.username || 'User';
    const initialsUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=5865f2`;
    setAvatarUrl(initialsUrl);
    setCustomAvatarInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCurrentPasswordError(null);
    setSuccessMessage(null);

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      setActiveTab('profile');
      setError('Username must be between 3 and 30 characters.');
      return;
    }

    // Password validation if any password field is filled or user is on password tab
    if (currentPassword || newPassword || confirmPassword || activeTab === 'password') {
      if (activeTab === 'password' && !currentPassword && !newPassword && !confirmPassword) {
        // If on password tab and all are empty, but user hasn't changed profile either
        if (trimmedUsername === user.username && avatarUrl === (user.avatarUrl || '')) {
          setError('Please enter your current password and a new password.');
          return;
        }
      } else {
        if (!currentPassword) {
          setActiveTab('password');
          setError('Current password is required to change your password.');
          setCurrentPasswordError('Current password is required to change your password.');
          return;
        }
        if (!newPassword) {
          setActiveTab('password');
          setError('New password is required to change your password.');
          return;
        }
        if (newPassword.length < 6) {
          setActiveTab('password');
          setError('New password must be at least 6 characters.');
          return;
        }
        if (newPassword !== confirmPassword) {
          setActiveTab('password');
          setError('New passwords do not match.');
          return;
        }
      }
    }

    const payload: UpdateProfileData = {};

    if (trimmedUsername !== user.username) {
      payload.username = trimmedUsername;
    }

    if (avatarUrl !== (user.avatarUrl || '')) {
      payload.avatarUrl = avatarUrl;
    }

    if (newPassword && currentPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    // If nothing changed
    if (!payload.username && payload.avatarUrl === undefined && !payload.newPassword) {
      setSuccessMessage('No changes made.');
      setTimeout(() => setSuccessMessage(null), 2500);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProfile(payload);
      setSuccessMessage('Profile updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPasswordError(null);

      // Auto close after brief success indication
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      const errObj = err as Error;
      const errorMsg = errObj.message || 'Failed to update profile.';
      setError(errorMsg);
      if (errorMsg.toLowerCase().includes('password')) {
        setActiveTab('password');
        if (errorMsg.toLowerCase().includes('current password')) {
          setCurrentPasswordError(errorMsg);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedJoinedDate = (() => {
    try {
      return new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return user.createdAt;
    }
  })();

  const previewAvatarSrc =
    avatarUrl ||
    user.avatarUrl ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=5865f2`;

  const hasPasswordChanges = Boolean(currentPassword || newPassword || confirmPassword);
  const isCurrentPasswordMissing = Boolean(!currentPassword.trim() && (newPassword || confirmPassword));

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1050 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
        style={{
          maxWidth: '520px',
          width: '95%',
          maxHeight: '90vh',
          margin: '1.75rem auto',
        }}
      >
        <div
          className="modal-content pc-modal"
          style={{
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="modal-header pc-modal-header d-flex align-items-center justify-content-between p-3 border-bottom flex-shrink-0"
            style={{ borderColor: 'var(--pc-border)' }}
          >
            <div className="d-flex align-items-center gap-2">
              <UserIcon size={20} className="text-primary" />
              <h5 className="modal-title fw-bold text-white mb-0">Edit Profile</h5>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-link p-1 ms-auto d-flex align-items-center justify-content-center rounded-circle"
              style={{
                width: '32px',
                height: '32px',
                color: '#949ba4',
                transition: 'background-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#949ba4';
              }}
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs (Always clearly visible at the top) */}
          <div
            className="d-flex border-bottom px-3 pt-2 gap-2 flex-shrink-0"
            style={{
              borderColor: 'var(--pc-border)',
              backgroundColor: 'var(--pc-bg-subnav)',
            }}
          >
            <button
              type="button"
              className={`btn btn-sm pb-2 px-3 fw-semibold border-0 rounded-0 position-relative ${
                activeTab === 'profile' ? 'text-white' : 'text-secondary'
              }`}
              style={{
                background: 'transparent',
                borderBottom: activeTab === 'profile' ? '2px solid var(--pc-primary)' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setActiveTab('profile')}
            >
              <UserIcon size={15} className="me-2" />
              Profile Details
            </button>
            <button
              type="button"
              className={`btn btn-sm pb-2 px-3 fw-semibold border-0 rounded-0 position-relative ${
                activeTab === 'password' ? 'text-white' : 'text-secondary'
              }`}
              style={{
                background: 'transparent',
                borderBottom: activeTab === 'password' ? '2px solid var(--pc-primary)' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setActiveTab('password')}
            >
              <Key size={15} className="me-2" />
              Change Password
              {hasPasswordChanges && (
                <span
                  className="position-absolute rounded-circle bg-primary"
                  style={{ width: '6px', height: '6px', top: '6px', right: '4px' }}
                />
              )}
            </button>
          </div>

          {/* Form wrapper */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: '1 1 auto',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Alert Feedback (Always pinned at top, never scrolled away) */}
            {error && (
              <div
                className="alert alert-danger py-2 px-3 small border-0 mb-0 d-flex align-items-center gap-2 flex-shrink-0"
                style={{
                  borderRadius: 0,
                  backgroundColor: 'rgba(237, 66, 69, 0.15)',
                  borderBottom: '1px solid rgba(237, 66, 69, 0.3)',
                  color: '#ff7b72',
                }}
                role="alert"
              >
                <AlertCircle size={16} className="flex-shrink-0" />
                <span className="flex-grow-1 fw-medium">{error}</span>
              </div>
            )}
            {successMessage && (
              <div
                className="alert alert-success py-2 px-3 small border-0 mb-0 d-flex align-items-center gap-2 flex-shrink-0"
                style={{
                  borderRadius: 0,
                  backgroundColor: 'rgba(35, 165, 90, 0.15)',
                  borderBottom: '1px solid rgba(35, 165, 90, 0.3)',
                  color: '#57f287',
                }}
                role="alert"
              >
                <Check size={16} className="flex-shrink-0" />
                <span className="flex-grow-1 fw-medium">{successMessage}</span>
              </div>
            )}

            {/* Scrollable Modal Body */}
            <div
              className="modal-body p-3 d-flex flex-column gap-3"
              style={{
                overflowY: 'auto',
                flex: '1 1 auto',
                minHeight: 0,
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
              }}
            >

              {/* TAB 1: Profile Details */}
              {activeTab === 'profile' && (
                <>
                  {/* Avatar Section */}
                  <div
                    className="p-3 rounded-3"
                    style={{
                      backgroundColor: 'var(--pc-bg-sidebar)',
                      border: '1px solid var(--pc-border)',
                    }}
                  >
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <div className="position-relative flex-shrink-0">
                        <img
                          src={previewAvatarSrc}
                          alt={username || user.username}
                          className="rounded-circle"
                          style={{
                            width: '68px',
                            height: '68px',
                            objectFit: 'cover',
                            border: '2px solid var(--pc-primary)',
                            backgroundColor: '#2b2d31',
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username || user.username)}&backgroundColor=5865f2`;
                          }}
                        />
                        <span
                          className="status-indicator status-online"
                          style={{
                            position: 'absolute',
                            bottom: '2px',
                            right: '2px',
                            width: '13px',
                            height: '13px',
                            borderWidth: '2px',
                          }}
                        />
                      </div>

                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-bold text-white fs-6 text-truncate mb-1">
                          {username.trim() || user.username}
                        </div>
                        <div className="text-secondary small d-flex align-items-center gap-1 mb-2">
                          <Calendar size={13} />
                          <span>Joined: {formattedJoinedDate}</span>
                        </div>

                        <div className="d-flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 px-2 py-1"
                            style={{ fontSize: '0.78rem', borderRadius: '6px' }}
                            onClick={handleRandomizeAvatar}
                            title="Generate a random avatar"
                          >
                            <Sparkles size={13} />
                            Randomize
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 px-2 py-1 text-light"
                            style={{ fontSize: '0.78rem', borderRadius: '6px', borderColor: 'var(--pc-border)' }}
                            onClick={handleResetToInitials}
                            title="Reset to default initials avatar"
                          >
                            <RotateCcw size={13} />
                            Initials
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Preset Avatars */}
                    <div className="mb-3">
                      <div className="text-secondary small fw-semibold mb-2" style={{ fontSize: '0.78rem' }}>
                        Preset Avatars:
                      </div>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        {AVATAR_PRESETS.map((preset) => {
                          const isSelected = avatarUrl === preset.url;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              className="btn p-0 rounded-circle position-relative"
                              style={{
                                width: '36px',
                                height: '36px',
                                border: isSelected ? '2px solid var(--pc-primary)' : '2px solid transparent',
                                transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                                transition: 'all 0.15s ease',
                              }}
                              onClick={() => handleSelectPreset(preset.url)}
                              title={preset.name}
                            >
                              <img
                                src={preset.url}
                                alt={preset.name}
                                className="rounded-circle w-100 h-100"
                                style={{ objectFit: 'cover' }}
                              />
                              {isSelected && (
                                <span
                                  className="position-absolute bg-primary text-white rounded-circle d-flex align-items-center justify-content-center"
                                  style={{
                                    bottom: '-3px',
                                    right: '-3px',
                                    width: '14px',
                                    height: '14px',
                                    fontSize: '9px',
                                  }}
                                >
                                  <Check size={9} strokeWidth={3} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Avatar URL Input */}
                    <div>
                      <label htmlFor="custom-avatar-url" className="text-secondary small fw-semibold mb-1" style={{ fontSize: '0.78rem' }}>
                        Custom Avatar Image URL:
                      </label>
                      <input
                        id="custom-avatar-url"
                        type="url"
                        className="form-control pc-input"
                        placeholder="https://example.com/avatar.png"
                        value={customAvatarInput}
                        onChange={(e) => handleCustomAvatarChange(e.target.value)}
                        style={{ height: '38px', fontSize: '0.88rem' }}
                      />
                    </div>
                  </div>

                  {/* Username Input */}
                  <div>
                    <label htmlFor="profile-username" className="form-label text-light small fw-semibold mb-1">
                      Username <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span
                        className="input-group-text bg-transparent text-secondary border-end-0"
                        style={{ borderColor: 'var(--pc-border)', backgroundColor: 'var(--pc-bg-sidebar)' }}
                      >
                        @
                      </span>
                      <input
                        id="profile-username"
                        type="text"
                        className="form-control pc-input border-start-0 ps-1"
                        placeholder="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        minLength={3}
                        maxLength={30}
                        required
                        style={{ height: '40px' }}
                      />
                    </div>
                    <div className="text-secondary mt-1" style={{ fontSize: '0.72rem' }}>
                      This is your public display and mention name (3-30 characters).
                    </div>
                  </div>

                  {/* Readonly Account Details */}
                  <div>
                    <label htmlFor="profile-email" className="form-label text-light small fw-semibold mb-1">Email Address</label>
                    <div className="input-group">
                      <span
                        className="input-group-text text-secondary border-end-0"
                        style={{ borderColor: 'var(--pc-border)', backgroundColor: 'var(--pc-bg-sidebar)' }}
                      >
                        <Mail size={15} />
                      </span>
                      <input
                        id="profile-email"
                        type="email"
                        className="form-control pc-input border-start-0 ps-1"
                        value={user.email}
                        disabled
                        style={{ opacity: 0.7, cursor: 'not-allowed', height: '40px' }}
                      />
                    </div>
                    <div className="text-secondary mt-1" style={{ fontSize: '0.72rem' }}>
                      Email address cannot be changed for account security.
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: Change Password */}
              {activeTab === 'password' && (
                <div className="d-flex flex-column gap-3">
                  {/* Info Header Card */}
                  <div
                    className="p-3 rounded-3 d-flex align-items-center gap-3"
                    style={{
                      backgroundColor: 'var(--pc-bg-sidebar)',
                      border: '1px solid var(--pc-border)',
                    }}
                  >
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: '42px',
                        height: '42px',
                        backgroundColor: 'rgba(88, 101, 242, 0.15)',
                        color: 'var(--pc-primary)',
                      }}
                    >
                      <Shield size={20} />
                    </div>
                    <div>
                      <div className="fw-semibold text-white small">Account Security</div>
                      <div className="text-secondary small" style={{ fontSize: '0.78rem' }}>
                        To update your password, enter your current password followed by your new password.
                      </div>
                    </div>
                  </div>

                  {/* Current Password */}
                  <div>
                    <label htmlFor="profile-current-password" className="form-label text-light small fw-semibold mb-1">
                      Current Password <span className="text-danger">*</span>
                    </label>
                    <div className="position-relative">
                      <input
                        id="profile-current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        className={`form-control pc-input pe-5 ${
                          currentPasswordError ? 'border-danger' : ''
                        }`}
                        placeholder="Enter current password"
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          if (currentPasswordError) setCurrentPasswordError(null);
                          if (error) setError(null);
                        }}
                        style={{ height: '40px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-secondary position-absolute top-50 end-0 translate-middle-y me-2 p-1"
                        style={{ zIndex: 5 }}
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                      >
                        {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {currentPasswordError ? (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                        <AlertCircle size={13} className="flex-shrink-0" />
                        <span>{currentPasswordError}</span>
                      </div>
                    ) : isCurrentPasswordMissing ? (
                      <div className="text-warning small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                        <AlertCircle size={13} className="flex-shrink-0" />
                        <span>Current password is required to change your password.</span>
                      </div>
                    ) : (
                      <div className="text-secondary mt-1" style={{ fontSize: '0.72rem' }}>
                        Enter your existing password to authorize this change.
                      </div>
                    )}
                  </div>

                  {/* New Password */}
                  <div>
                    <label htmlFor="profile-new-password" className="form-label text-light small fw-semibold mb-1">
                      New Password (min. 6 characters) <span className="text-danger">*</span>
                    </label>
                    <div className="position-relative">
                      <input
                        id="profile-new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        className="form-control pc-input pe-5"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        style={{ height: '40px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-secondary position-absolute top-50 end-0 translate-middle-y me-2 p-1"
                        style={{ zIndex: 5 }}
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {newPassword.length > 0 && newPassword.length < 6 ? (
                      <div className="text-warning small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                        <AlertCircle size={12} className="flex-shrink-0" />
                        <span>Must be at least 6 characters ({newPassword.length}/6).</span>
                      </div>
                    ) : newPassword.length >= 6 ? (
                      <div className="text-success small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                        <Check size={12} className="flex-shrink-0" />
                        <span>Password meets minimum length.</span>
                      </div>
                    ) : (
                      <div className="text-secondary mt-1" style={{ fontSize: '0.72rem' }}>
                        Must be at least 6 characters long.
                      </div>
                    )}
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label htmlFor="profile-confirm-password" className="form-label text-light small fw-semibold mb-1">
                      Confirm New Password <span className="text-danger">*</span>
                    </label>
                    <div className="position-relative">
                      <input
                        id="profile-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        className={`form-control pc-input pe-5 ${
                          confirmPassword && newPassword !== confirmPassword ? 'border-danger' : ''
                        }`}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        style={{ height: '40px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-secondary position-absolute top-50 end-0 translate-middle-y me-2 p-1"
                        style={{ zIndex: 5 }}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && newPassword !== confirmPassword ? (
                      <div className="text-danger small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                        <AlertCircle size={12} className="flex-shrink-0" />
                        <span>Passwords do not match.</span>
                      </div>
                    ) : confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length >= 6 ? (
                      <div className="text-success small mt-1 d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                        <Check size={12} className="flex-shrink-0" />
                        <span>Passwords match.</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer (Always pinned and visible on all screens) */}
            <div
              className="modal-footer pc-modal-footer d-flex align-items-center justify-content-between p-3 border-top flex-shrink-0"
              style={{
                borderColor: 'var(--pc-border)',
                backgroundColor: 'var(--pc-bg-subnav)',
                zIndex: 5,
              }}
            >
              <div className="text-secondary small" style={{ fontSize: '0.75rem' }}>
                {activeTab === 'profile' ? (
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-secondary p-0 text-decoration-none d-flex align-items-center gap-1"
                    onClick={() => setActiveTab('password')}
                  >
                    <Key size={13} />
                    <span>Change password?</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-secondary p-0 text-decoration-none d-flex align-items-center gap-1"
                    onClick={() => setActiveTab('profile')}
                  >
                    <UserIcon size={13} />
                    <span>Back to profile</span>
                  </button>
                )}
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary px-3"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm pc-btn-primary px-4 d-inline-flex align-items-center gap-2 fw-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
