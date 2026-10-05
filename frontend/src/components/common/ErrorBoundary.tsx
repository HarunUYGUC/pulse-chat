import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="d-flex flex-column align-items-center justify-content-center vh-100 p-4"
          style={{ backgroundColor: '#1e1f22', color: '#dbdee1' }}
        >
          <div
            className="p-4 rounded-4 shadow-lg text-center"
            style={{
              backgroundColor: '#2b2d31',
              border: '1px solid #3f4147',
              maxWidth: '480px',
              width: '100%',
            }}
          >
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 p-3"
              style={{ backgroundColor: 'rgba(237, 66, 69, 0.15)', color: '#ed4245' }}
            >
              <AlertTriangle size={36} />
            </div>

            <h4 className="fw-bold mb-2 text-white">
              {this.props.fallbackTitle || 'Bir şeyler ters gitti'}
            </h4>

            <p className="small text-secondary mb-3">
              Uygulama çalışırken beklenmedik bir arayüz hatası oluştu. Sayfayı yenileyerek tekrar deneyebilirsiniz.
            </p>

            {this.state.error && (
              <div
                className="text-start p-2 mb-3 rounded font-monospace small"
                style={{
                  backgroundColor: '#1e1f22',
                  color: '#ed4245',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  fontSize: '12px',
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="btn btn-primary d-inline-flex align-items-center gap-2 px-4 py-2 rounded-3 fw-semibold shadow-sm"
              style={{ backgroundColor: '#5865f2', border: 'none' }}
            >
              <RefreshCw size={16} />
              <span>Sayfayı Yenile</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
