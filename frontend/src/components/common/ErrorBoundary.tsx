import React from 'react';

interface State { hasError: boolean; }
interface Props { children: React.ReactNode; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div className="p-8 text-center text-red-600">Something went wrong.</div>;
    }
    return this.props.children;
  }
} 