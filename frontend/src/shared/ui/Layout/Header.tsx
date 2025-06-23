import React from 'react';
import { useLocation } from 'react-router-dom';
import { FiMenu, FiUser } from 'react-icons/fi';
import { useAuthStore, useUIStore } from '../../stores';
import useLayoutStore from '../../stores/layoutStore';
import AgentSelector from '../AgentSelector';
import UserProfile from '../UserProfile';

const Header: React.FC = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const { toggleMobileMenu } = useLayoutStore();
  const { toggleDropdown } = useUIStore();
  
  // Show AgentSelector only on chat routes
  const showAgentSelector = location.pathname.startsWith('/chat');

  return (
    <header className="h-16 bg-primary border-b border-border flex items-center justify-between px-6 z-[10]">
      {/* Left side */}
      <div className="flex items-center space-x-3 flex-1">
        {/* Mobile Menu Button */}
        <button
          onClick={toggleMobileMenu}
          className="p-2 md:hidden hover:bg-secondary rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <FiMenu className="h-5 w-5 text-primary" />
        </button>

        {/* Agent Selector (chat routes) */}
        {showAgentSelector && <AgentSelector />}
      </div>

      {/* Right side - User controls */}
      <div className="flex items-center space-x-4">
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