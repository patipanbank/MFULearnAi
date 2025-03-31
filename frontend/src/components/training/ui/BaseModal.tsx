import React from 'react';
import { FaTimes } from 'react-icons/fa';

interface BaseModalProps {
  onClose: () => void;
  containerClasses?: string;
  children: React.ReactNode;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  onClose,
  containerClasses = '',
  children,
}) => (
  <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
    <div className={`relative bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 ${containerClasses}`}>
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 
          p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200"
        title="Close"
      >
        <FaTimes size={20} />
      </button>
      {children}
    </div>
  </div>
); 