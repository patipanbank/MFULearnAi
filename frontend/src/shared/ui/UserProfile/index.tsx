import React, { useRef, useEffect } from 'react';
import { FiLogOut, FiChevronDown, FiUser, FiMail, FiHome, FiMoon, FiSun } from 'react-icons/fi';
import useAuthStore from '../../../entities/user/store';
import useUIStore from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';

const UserProfile: React.FC = () => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, logoutSAML } = useAuthStore();
  const { openDropdowns, toggleDropdown, closeDropdown } = useUIStore();
  const { preferences, setPreferences, getCurrentTheme } = useSettingsStore();
  
  const dropdownId = 'user-profile';
  const isOpen = openDropdowns.has(dropdownId);
  const currentTheme = getCurrentTheme();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown(dropdownId);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown, dropdownId]);

  const handleCompleteLogout = () => {
    logoutSAML();
    closeDropdown(dropdownId);
  };

  const handleThemeChange = (theme: 'light' | 'dark') => {
    setPreferences({ theme });
  };

  if (!user) {
    return null;
  }

  // Extract first letter for avatar
  const avatarLetter = user.first_name?.charAt(0) || user.email?.charAt(0) || 'U';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => toggleDropdown(dropdownId)}
        className="btn-ghost flex items-center space-x-2 hover:bg-secondary transition-colors duration-200"
      >
        {/* Avatar */}
        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
          {avatarLetter.toUpperCase()}
        </div>
        
        {/* User Info */}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-primary">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-xs text-muted truncate max-w-32">
            {user.email}
          </p>
        </div>
        
        {/* Dropdown Icon */}
        <FiChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu with Animation */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-primary border border-border rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {/* User Profile Header */}
          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-border">
            <div className="flex items-center space-x-4">
              <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold shadow-md">
                {avatarLetter.toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-primary">
                  {user.first_name} {user.last_name}
                </h3>
                <div className="space-y-1 mt-2">
                  <div className="flex items-center space-x-2 text-sm text-secondary">
                    <FiMail className="h-3 w-3" />
                    <span>{user.email}</span>
                  </div>
                  {user.department_id && (
                    <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
                      <FiHome className="h-3 w-3" />
                      <span>Computer Engineering</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 text-sm text-muted">
                    <FiUser className="h-3 w-3" />
                    <span>Role: {user.role || 'Student'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* User Stats */}
          <div className="p-4 bg-secondary border-b border-border">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-primary">12</div>
                <div className="text-xs text-muted">Chats</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-primary">3</div>
                <div className="text-xs text-muted">Agents</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-primary">5</div>
                <div className="text-xs text-muted">Collections</div>
              </div>
            </div>
          </div>

          {/* Theme Selector */}
          <div className="p-4 border-b border-border">
            <div className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Appearance</div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  preferences.theme === 'light'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'hover:bg-secondary text-muted hover:text-primary'
                }`}
              >
                <FiSun className="h-4 w-4" />
                <span className="text-sm">Light</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  preferences.theme === 'dark'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'hover:bg-secondary text-muted hover:text-primary'
                }`}
              >
                <FiMoon className="h-4 w-4" />
                <span className="text-sm">Dark</span>
              </button>
            </div>
            <div className="text-xs text-muted mt-2">
              Current: {currentTheme === 'light' ? 'Light mode' : 'Dark mode'}
            </div>
          </div>

          {/* Complete Logout */}
          <div className="p-4">
            <button
              onClick={handleCompleteLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium group"
            >
              <FiLogOut className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span>Complete Logout</span>
            </button>
            <div className="text-xs text-muted text-center mt-2">
              This will log you out from all active sessions
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile; 