import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { MessageSquare, LogIn, UserPlus } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { login, register, isLoading, error, clearError } = useAuthStore();

  const handleToggle = () => {
    setIsLogin(!isLogin);
    clearError();
    setLocalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    try {
      if (isLogin) {
        if (!username) {
          setLocalError('Please enter your username or email.');
          return;
        }
        if (!password) {
          setLocalError('Please enter your password.');
          return;
        }
        await login({ usernameOrEmail: username, password });
      } else {
        if (!username || username.length < 3) {
          setLocalError('Username must be at least 3 characters.');
          return;
        }
        if (!email || !email.includes('@')) {
          setLocalError('Please enter a valid email address.');
          return;
        }
        if (!password || password.length < 6) {
          setLocalError('Password must be at least 6 characters.');
          return;
        }
        await register({
          username,
          email,
          password,
          avatarUrl: avatarUrl || undefined,
          inviteCode: inviteCode.trim().toUpperCase() || undefined,
        });
      }
    } catch {
      // Error handled by store
    }
  };

  return (
    <div
      className="w-100 vh-100 overflow-y-auto"
      style={{
        backgroundColor: '#1e1f22',
        backgroundImage:
          'radial-gradient(circle at 50% 30%, rgba(88, 101, 242, 0.15), transparent 60%)',
      }}
    >
      <div className="min-vh-100 d-flex align-items-center justify-content-center p-3 py-sm-4">
        <div
          className="card shadow-lg border-0"
          style={{
            width: '100%',
            maxWidth: '460px',
            backgroundColor: '#2b2d31',
            color: '#dbdee1',
            borderRadius: '12px',
          }}
        >
          <div className="card-body p-4">
          {/* Brand Header */}
          <div className="text-center mb-4">
            <div
              className="d-inline-flex align-items-center justify-content-center mb-3 rounded-circle"
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'var(--pc-primary)',
                color: '#fff',
              }}
            >
              <MessageSquare size={32} />
            </div>
            <h3 className="fw-bold text-white mb-1">PulseChat</h3>
            <p className="text-secondary small mb-0">
              {isLogin
                ? 'Welcome back! Sign in to join the conversation.'
                : 'Create your account and start collaborating.'}
            </p>
          </div>

          {(error || localError) && (
            <div className="alert alert-danger py-2 px-3 small border-0 mb-3" role="alert">
              {error || localError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="pc-form-label">
                {isLogin ? 'Username or Email' : 'Username'}
              </label>
              <input
                type="text"
                className="form-control pc-input"
                placeholder={isLogin ? 'Enter your username or email' : 'Choose a username (min 3 chars)'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>

            {!isLogin && (
              <div className="mb-3">
                <label className="pc-form-label">
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-control pc-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="mb-3">
              <label className="pc-form-label">
                Password
              </label>
              <input
                type="password"
                className="form-control pc-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {!isLogin && (
              <>
                <div className="mb-3">
                  <label className="pc-form-label">
                    Avatar Image URL <span className="text-secondary fw-normal font-monospace" style={{ textTransform: 'none', fontSize: '0.75rem' }}>(Optional)</span>
                  </label>
                  <input
                    type="url"
                    className="form-control pc-input"
                    placeholder="https://example.com/avatar.png"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                  />
                </div>

                <div className="mb-4">
                  <label className="pc-form-label">
                    Workspace Invite Code <span className="text-secondary fw-normal font-monospace" style={{ textTransform: 'none', fontSize: '0.75rem' }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-control pc-input font-monospace"
                    placeholder="e.g. PULSE-8X92"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="btn pc-btn-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              ) : isLogin ? (
                <>
                  <LogIn size={18} />
                  <span>Log In</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          {/* Switch toggle */}
          <div className="text-center pt-2 border-top" style={{ borderColor: '#383a40' }}>
            <span className="text-secondary small me-2">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
            </span>
            <button
              type="button"
              className="btn btn-link p-0 text-decoration-none small fw-semibold"
              style={{ color: 'var(--pc-primary)' }}
              onClick={handleToggle}
            >
              {isLogin ? 'Register here' : 'Sign in here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
