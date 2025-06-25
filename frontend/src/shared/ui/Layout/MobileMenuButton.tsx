import React from 'react';
import { FiMenu, FiMoon, FiSun } from 'react-icons/fi';
import useLayoutStore from '../../stores/layoutStore';
import { useSettingsStore } from '../../stores/settingsStore';
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
  const { preferences, setPreferences, getCurrentTheme } = useSettingsStore();
  
  const currentTheme = getCurrentTheme();

  const getThemeIcon = () => {
    return preferences.theme === 'light' 
      ? <FiSun className={cn("h-4 w-4", iconBaseStyle, iconColors.sun)} /> 
      : <FiMoon className={cn("h-4 w-4", iconBaseStyle, iconColors.moon)} />;
  };

  const handleThemeToggle = () => {
    const nextTheme = preferences.theme === 'light' ? 'dark' : 'light';
    setPreferences({ theme: nextTheme });
  };

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

      {/* Theme Toggle Button */}
      <button
        onClick={handleThemeToggle}
        className="btn-ghost p-3 bg-primary/90 backdrop-blur-sm rounded-xl shadow-lg border border-border hover:bg-secondary transition-all duration-200 group"
        aria-label={`Switch to ${preferences.theme === 'light' ? 'dark' : 'light'} theme`}
        title={`Current: ${currentTheme} mode`}
      >
        <div className="text-primary group-hover:scale-110 transition-transform">
          {getThemeIcon()}
        </div>
      </button>
    </div>
  );
};

export default MobileMenuButton; 