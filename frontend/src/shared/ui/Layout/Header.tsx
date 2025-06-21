import React from 'react';
import { FiMessageCircle, FiBell, FiMoon, FiSun, FiMonitor } from 'react-icons/fi';
import UserProfile from '../UserProfile';
import ModelSelector from '../ModelSelector';
import { useSettingsStore } from '../../stores/settingsStore';

const Header: React.FC = () => {
  const { preferences, setPreferences, getCurrentTheme } = useSettingsStore();
  const currentTheme = getCurrentTheme();

  const getThemeIcon = () => {
    switch (preferences.theme) {
      case 'light':
        return <FiSun className="h-5 w-5" />;
      case 'dark':
        return <FiMoon className="h-5 w-5" />;
      case 'auto':
        return <FiMonitor className="h-5 w-5" />;
      default:
        return <FiSun className="h-5 w-5" />;
    }
  };

  const handleThemeToggle = () => {
    const nextTheme = preferences.theme === 'light' ? 'dark' : preferences.theme === 'dark' ? 'auto' : 'light';
    setPreferences({ theme: nextTheme });
  };

  return (
    <header className="header px-6 py-4 flex items-center justify-between">
      {/* Left side - Logo, Title & Model Selector */}
      <div className="flex items-center space-x-6">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
              <FiMessageCircle className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-primary">
              <span style={{ 
                background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>DIN</span>DIN <span style={{
                background: 'linear-gradient(to right, #00FFFF, #0099FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>AI</span>
            </h1>
          </div>
          <ModelSelector />
        </div>
      </div>

      {/* Right side - Theme Toggle, Notifications & User Profile */}
      <div className="flex items-center space-x-4">
        {/* Theme Toggle (Desktop only) */}
        <button
          onClick={handleThemeToggle}
          className="hidden md:flex btn-ghost p-2 hover:bg-secondary transition-colors group"
          aria-label={`Switch to ${preferences.theme === 'light' ? 'dark' : preferences.theme === 'dark' ? 'auto' : 'light'} theme`}
          title={`Current: ${currentTheme} mode`}
        >
          <div className="text-muted group-hover:text-primary group-hover:scale-110 transition-all">
            {getThemeIcon()}
          </div>
        </button>

        {/* Notifications */}
        <button className="btn-ghost p-2 hover:bg-secondary transition-colors group">
          <FiBell className="h-5 w-5 text-muted group-hover:text-primary transition-colors" />
        </button>

        {/* User Profile */}
        <UserProfile />
      </div>
    </header>
  );
};

export default Header; 