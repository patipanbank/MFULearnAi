import React from 'react';
import useUIStore from '../../stores/uiStore';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  message?: string;
  description?: string;
}

const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  fullScreen = false,
  message = 'Loading...',
  description = 'Please wait while we process your request.'
}) => {
  const { isLoading } = useUIStore();
  const showGlobal = isLoading && fullScreen;

  const sizeClasses = {
    sm: 'h-4 w-4 border',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-2'
  };

  const spinnerClass = `
    animate-spin rounded-full
    ${sizeClasses[size]}
    border-b-primary dark:border-b-primary-dark
    border-r-transparent border-l-transparent border-t-transparent
  `;

  if (showGlobal) {
    return (
      <div className="fixed inset-0 bg-background/50 dark:bg-background-dark/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="card dark:bg-card-dark p-6 max-w-sm mx-4 flex items-center space-x-4 shadow-lg">
          <div className={spinnerClass}></div>
          <div>
            <h3 className="text-lg font-medium text-foreground dark:text-foreground-dark">
              {message}
            </h3>
            <p className="text-sm text-muted dark:text-muted-dark">
              {description}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <div className={spinnerClass}></div>
    </div>
  );
};

export default Loading; 