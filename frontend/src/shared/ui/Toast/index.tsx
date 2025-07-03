import React from 'react';
import { FiX, FiCheck, FiAlertTriangle, FiInfo, FiAlertCircle } from 'react-icons/fi';
import { useUIStore } from '../../stores';

const Toast: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <FiCheck className="h-5 w-5" style={{ color: 'rgb(var(--color-toast-success))' }} />;
      case 'error':
        return <FiAlertCircle className="h-5 w-5" style={{ color: 'rgb(var(--color-toast-error))' }} />;
      case 'warning':
        return <FiAlertTriangle className="h-5 w-5" style={{ color: 'rgb(var(--color-toast-warning))' }} />;
      case 'info':
        return <FiInfo className="h-5 w-5" style={{ color: 'rgb(var(--color-toast-info))' }} />;
      default:
        return <FiInfo className="h-5 w-5 text-muted" />;
    }
  };

  const getToastClasses = (type: string) => {
    switch (type) {
      case 'success':
        return 'toast-success';
      case 'error':
        return 'toast-error';
      case 'warning':
        return 'toast-warning';
      case 'info':
        return 'toast-info';
      default:
        return 'toast';
    }
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
          <div className="fixed top-4 right-4 z-30 space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`relative flex items-start space-x-3 p-4 transform transition-all duration-300 ease-in-out ${getToastClasses(toast.type)}`}
        >
          <div className="flex-shrink-0">
            {getToastIcon(toast.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-primary">{toast.title}</h4>
            {toast.message && (
              <p className="text-sm mt-1 text-secondary">{toast.message}</p>
            )}
          </div>
          
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-muted hover:text-primary"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast; 