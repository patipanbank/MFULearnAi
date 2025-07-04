import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorCount: number;
}

class LayoutErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorCount: 1 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Layout Error Boundary caught an error:', error, errorInfo);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Increment error count
    this.setState(prevState => ({ 
      errorCount: prevState.errorCount + 1 
    }));
    
    // If too many errors, force reload
    if (this.state.errorCount > 5) {
      console.error('Too many errors detected, forcing page reload');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  handleReset = () => {
    // Clear any problematic state
    try {
      // Clear localStorage if needed
      localStorage.removeItem('chat-session');
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    
    this.setState({ hasError: false, error: undefined, errorCount: 0 });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-primary flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-primary mb-2">Something went wrong</h1>
            <p className="text-secondary mb-4">
              {this.state.errorCount > 3 
                ? 'Multiple errors detected. This might be due to an infinite loop.'
                : 'We\'re sorry, but something unexpected happened.'
              }
            </p>
            <div className="space-x-4">
              <button
                onClick={this.handleReset}
                className="btn-secondary"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                Reload Page
              </button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left max-w-md mx-auto">
                <summary className="cursor-pointer text-sm text-secondary">
                  Error Details
                </summary>
                <pre className="text-xs bg-gray-800 p-2 rounded mt-2 overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default LayoutErrorBoundary; 