import React from 'react';
import { FiMenu, FiMoon, FiSun } from 'react-icons/fi';
import useLayoutStore from '../../stores/layoutStore';
import { useSettingsStore } from '../../stores/settingsStore';

const MobileMenuButton: React.FC = () => {
  const { toggleMobileMenu } = useLayoutStore();
  const { preferences, setPreferences, getCurrentTheme } = useSettingsStore();
  
  const currentTheme = getCurrentTheme();

  const getThemeIcon = () => {
    return preferences.theme === 'light' ? <FiSun className="h-4 w-4" /> : <FiMoon className="h-4 w-4" />;
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
        <FiMenu className="h-6 w-6 text-primary" />
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