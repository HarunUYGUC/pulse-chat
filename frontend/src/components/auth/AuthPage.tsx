import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { MessageSquare, LogIn, UserPlus, Zap } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
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
        await register({ username, email, password, avatarUrl: avatarUrl || undefined });
      }
    } catch {
      // Error handled by store
    }
  };

  // Quick Demo Login Helper for rapid dual-browser / dual-user testing
  const handleQuickDemo = async (demoUsername: string) => {
    clearError();
    setLocalError(null);
    const demoPassword = 'Password123!';
    const demoEmail = `${demoUsername.toLowerCase()}@pulsechat.local`;

    try {
      // Try login first
      await login({ usernameOrEmail: demoUsername, password: demoPassword });
    } catch {
      // If login fails, auto-register demo user
      try {
        await register({
          username: demoUsername,
          email: demoEmail,
          password: demoPassword,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${demoUsername}&backgroundColor=5865f2`,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Demo account creation failed.';
        setLocalError(message);
      }
    }
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center w-100 vh-100"
      style={{
        backgroundColor: '#1e1f22',
        backgroundImage:
          'radial-gradient(circle at 50% 30%, rgba(88, 101, 242, 0.15), transparent 60%)',
      }}
    >
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
        <div className="card-body p-4 p-md-5">
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

          {/* Quick Demo Login Buttons */}
          <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#1e1f22', border: '1px solid #383a40' }}>
            <div className="d-flex align-items-center gap-1 text-secondary small mb-2 fw-semibold">
              <Zap size={14} className="text-warning" />
              <span>Quick Demo Accounts (1-Click Login):</span>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-light flex-grow-1"
                onClick={() => handleQuickDemo('Alice')}
                disabled={isLoading}
              >
                Sign in as Alice
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-light flex-grow-1"
                onClick={() => handleQuickDemo('Bob')}
                disabled={isLoading}
              >
                Sign in as Bob
              </button>
            </div>
          </div>

          {(error || localError) && (
            <div className="alert alert-danger py-2 px-3 small border-0 mb-3" role="alert">
              {error || localError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-uppercase text-secondary">
                {isLogin ? 'Username or Email' : 'Username'}
              </label>
              <input
                type="text"
                className="form-control pc-input py-2"
                placeholder={isLogin ? 'e.g. Alice or alice@pulsechat.local' : 'Choose a username (min 3 chars)'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>

            {!isLogin && (
              <div className="mb-3">
                <label className="form-label small fw-semibold text-uppercase text-secondary">
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-control pc-input py-2"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="mb-3">
              <label className="form-label small fw-semibold text-uppercase text-secondary">
                Password
              </label>
              <input
                type="password"
                className="form-control pc-input py-2"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {!isLogin && (
              <div className="mb-4">
                <label className="form-label small fw-semibold text-uppercase text-secondary">
                  Avatar Image URL (Optional)
                </label>
                <input
                  type="url"
                  className="form-control pc-input py-2"
                  placeholder="https://example.com/avatar.png"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </div>
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
  );
};
