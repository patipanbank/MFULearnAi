import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiMenu, FiUser } from 'react-icons/fi';
import { useAuthStore, useUIStore } from '../../stores';
import useLayoutStore from '../../stores/layoutStore';
import { useChatStore } from '../../stores/chatStore';
import AgentSelector from '../AgentSelector';
import UserProfile from '../UserProfile';

const Header: React.FC = React.memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toggleMobileMenu } = useLayoutStore();
  const { toggleDropdown } = useUIStore();
  const { createNewChat } = useChatStore();
   
  // Show AgentSelector only on chat routes
  const showAgentSelector = location.pathname.startsWith('/chat');
  
  console.log('Header - RENDER:', {
    user: user?.username,
    showAgentSelector,
    timestamp: new Date().toISOString()
  });

  const handleLogoClick = async () => {
    await createNewChat();
    navigate('/chat');
  };

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

        {/* DINDIN AI Logo */}
        <button
          onClick={handleLogoClick}
          className="hidden md:flex items-center mr-6 text-xl md:text-2xl font-bold hover:opacity-80 transition-opacity"
        >
          <span style={{
            background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>DIN</span>
          <span>DIN&nbsp;</span>
          <span style={{
            background: 'linear-gradient(to right, #00FFFF, #0099FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>AI</span>
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
});

export default Header; 