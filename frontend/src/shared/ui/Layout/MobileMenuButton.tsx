import React from 'react';
import { FiMenu } from 'react-icons/fi';
import useLayoutStore from '../../stores/layoutStore';
import { cn } from '../../lib/utils';

// Icon styles matching sidebar
const iconBaseStyle = "transition-colors duration-200";
const iconColors = {
  menu: "text-purple-500 hover:text-purple-600"
};

const MobileMenuButton: React.FC = () => {
  const { toggleMobileMenu } = useLayoutStore();

  return (
    <div className="fixed top-4 left-4 z-50 md:hidden">
      {/* Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="btn-ghost p-3 bg-primary/90 backdrop-blur-sm rounded-xl shadow-lg border border-border hover:bg-secondary transition-all duration-200"
        aria-label="Open menu"
      >
        <FiMenu className={cn("h-6 w-6", iconBaseStyle, iconColors.menu)} />
      </button>
    </div>
  );
};

export default MobileMenuButton; 