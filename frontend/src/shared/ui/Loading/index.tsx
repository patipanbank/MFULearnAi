import React from 'react';
import useUIStore from '../../stores/uiStore';
import { FiLoader } from 'react-icons/fi';

interface LoadingProps {
  isFullScreen?: boolean;
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const Loading: React.FC<LoadingProps> = ({ 
  isFullScreen = false,
  message = 'Loading...',
  size = 'medium'
}) => {
  const { isLoading } = useUIStore();

  // If this is a global loading indicator controlled by the UI store
  if (isFullScreen && !isLoading) return null;

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return {
          container: 'h-5 w-5',
          spinner: 'h-5 w-5'
        };
      case 'large':
        return {
          container: 'h-12 w-12',
          spinner: 'h-12 w-12' 
        };
      default:
        return {
          container: 'h-8 w-8',
          spinner: 'h-8 w-8'
        };
    }
  };

  const sizeClasses = getSizeClasses();

  // Full screen overlay loading
  if (isFullScreen) {
    return (
      <div className="modal-overlay z-50 fixed inset-0 bg-black bg-opacity-30 dark:bg-opacity-50 backdrop-blur-sm transition-all">
        <div className="card p-6 max-w-sm mx-auto mt-[30vh] flex items-center space-x-4 shadow-lg">
          <div className={`animate-spin ${sizeClasses.container} text-primary`}>
            <FiLoader className={`${sizeClasses.spinner} text-primary`} />
          </div>
          <div>
            <h3 className="text-lg font-medium text-primary">{message}</h3>
            <p className="text-sm text-secondary">Please wait while we process your request.</p>
          </div>
        </div>
      </div>
    );
  }

  // Inline loading
  return (
    <div className="flex items-center justify-center py-4">
      <div className={`animate-spin ${sizeClasses.container} text-primary`}>
        <FiLoader className={`${sizeClasses.spinner} text-primary`} />
      </div>
      {message && (
        <span className="ml-3 text-secondary">{message}</span>
      )}
    </div>
  );
};

export default Loading; 