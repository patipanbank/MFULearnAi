import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class UserProfileErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('UserProfile Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-gray-600 text-sm">U</span>
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-600">User Profile</p>
            <p className="text-xs text-gray-500">Error loading profile</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default UserProfileErrorBoundary; 