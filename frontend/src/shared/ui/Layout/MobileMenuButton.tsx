import React from 'react';
import { FiMenu } from 'react-icons/fi';
import useLayoutStore from '../../stores/layoutStore';
import ThemeToggle from '../ThemeToggle';
import { cn } from '../../lib/utils';

// Icon styles matching sidebar
const iconBaseStyle = "transition-colors duration-200";
const iconColors = {
  menu: "text-purple-500 hover:text-purple-600",
  sun: "text-amber-500 hover:text-amber-600",
  moon: "text-indigo-500 hover:text-indigo-600"
};

const MobileMenuButton: React.FC = () => {
  const { toggleMobileMenu } = useLayoutStore();

  return (
    <div className="fixed top-4 left-4 z-50 md:hidden flex flex-col space-y-2">
      {/* Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="btn-ghost p-3 bg-primary/90 backdrop-blur-sm rounded-xl shadow-lg border border-border hover:bg-secondary transition-all duration-200"
        aria-label="Open menu"
      >
        <FiMenu className={cn("h-6 w-6", iconBaseStyle, iconColors.menu)} />
      </button>

      {/* Theme Toggle */}
      <div className="bg-primary/90 backdrop-blur-sm rounded-xl shadow-lg border border-border">
        <ThemeToggle 
          variant="icon-only"
          className="!p-3 !bg-transparent hover:!bg-secondary/20"
        />
      </div>
    </div>
  );
};

export default MobileMenuButton; 