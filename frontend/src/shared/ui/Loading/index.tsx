import React from 'react';
import { useUIStore } from '../../stores';

const Loading: React.FC = () => {
  const { isLoading } = useUIStore();

  if (!isLoading) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="card p-2 flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      </div>
    </div>
  );
};

export default Loading; 