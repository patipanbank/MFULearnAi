import React from 'react';
import { useLocation } from 'react-router-dom';
import { FiSettings, FiUser } from 'react-icons/fi';
import { useAuthStore, useUIStore } from '../../stores';
import AgentSelector from '../AgentSelector';
import UserProfile from '../UserProfile';

const Header: React.FC = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const { toggleDropdown } = useUIStore();
  
  // Show AgentSelector only on chat routes
  const showAgentSelector = location.pathname.startsWith('/chat');

  return (
    <header className="h-16 bg-primary border-b border-border flex items-center justify-between px-6">
      {/* Left side - Agent Selector (only on chat routes) */}
      <div className="flex-1">
        {showAgentSelector && <AgentSelector />}
      </div>

      {/* Right side - User controls */}
      <div className="flex items-center space-x-4">
        {/* Settings Button */}
        <button
          onClick={() => toggleDropdown('settings')}
          className="p-2 hover:bg-secondary rounded-lg transition-colors"
          title="Settings"
        >
          <FiSettings className="h-5 w-5 text-muted" />
        </button>

        {/* User Profile */}
        {user ? (
          <UserProfile />
        ) : (
          <button
            onClick={() => toggleDropdown('user-menu')}
            className="flex items-center space-x-2 p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <FiUser className="h-5 w-5 text-muted" />
            <span className="text-sm text-muted">Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header; 