import React from 'react';
import { FiMenu } from 'react-icons/fi';
import useLayoutStore from '../../stores/layoutStore';

const MobileMenuButton: React.FC = () => {
  const { toggleMobileMenu } = useLayoutStore();

  return (
    <div className="fixed top-4 left-4 z-50 md:hidden">
      <button
        onClick={toggleMobileMenu}
        className="btn-ghost p-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl shadow-lg"
        aria-label="Open menu"
      >
        <FiMenu className="h-6 w-6 text-primary" />
      </button>
    </div>
  );
};

export default MobileMenuButton; 