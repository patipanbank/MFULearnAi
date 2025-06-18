import React from 'react';
import useUIStore from '../../stores/uiStore';

const Loading: React.FC = () => {
  const { isLoading } = useUIStore();

  if (!isLoading) return null;

  return (
    <div className="modal-overlay">
      <div className="card p-6 max-w-sm mx-4 flex items-center space-x-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <div>
          <h3 className="text-lg font-medium text-primary">Loading...</h3>
          <p className="text-sm text-muted">Please wait while we process your request.</p>
        </div>
      </div>
    </div>
  );
};

export default Loading; 