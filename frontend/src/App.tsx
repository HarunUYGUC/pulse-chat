import React, { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { AuthPage } from './components/auth/AuthPage';
import { AppLayout } from './components/layout/AppLayout';
import { startSignalRConnection, stopSignalRConnection } from './services/signalr';
import { MessageSquare } from 'lucide-react';

export const App: React.FC = () => {
  const { user, token, isAuthenticated, isLoading, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Manage SignalR lifecycle tied to authenticated user & token
  useEffect(() => {
    if (isAuthenticated && token) {
      startSignalRConnection(token).catch((err) => {
        console.error('SignalR connection failed to start:', err);
      });

      return () => {
        stopSignalRConnection();
      };
    }
  }, [isAuthenticated, token, user]);

  if (isLoading) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center vh-100"
        style={{ backgroundColor: '#1e1f22', color: '#fff' }}
      >
        <div
          className="d-flex align-items-center justify-content-center rounded-circle mb-3 shadow"
          style={{
            width: '64px',
            height: '64px',
            backgroundColor: 'var(--pc-primary)',
          }}
        >
          <MessageSquare size={32} />
        </div>
        <h4 className="fw-bold mb-2">PulseChat</h4>
        <div className="d-flex align-items-center gap-2 text-secondary small">
          <div className="spinner-border spinner-border-sm" role="status" />
          <span>Connecting to PulseChat...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <AppLayout />;
};

export default App;
