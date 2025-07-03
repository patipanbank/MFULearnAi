import React, { useMemo, useCallback } from 'react';
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
   
  // Memoize computed values to prevent unnecessary re-renders
  const showAgentSelector = useMemo(() => 
    location.pathname.startsWith('/chat'), 
    [location.pathname]
  );
  
  console.log('Header - RENDER:', {
    user: user?.username,
    showAgentSelector,
    timestamp: new Date().toISOString()
  });

  // Memoize event handlers
  const handleLogoClick = useCallback(async () => {
    await createNewChat();
    navigate('/chat');
  }, [createNewChat, navigate]);

  const handleMobileMenuClick = useCallback(() => {
    toggleMobileMenu();
  }, [toggleMobileMenu]);

  const handleSignInClick = useCallback(() => {
    toggleDropdown('user-menu');
  }, [toggleDropdown]);

  // Memoize mobile menu button
  const mobileMenuButton = useMemo(() => (
    <button
      onClick={handleMobileMenuClick}
      className="p-2 md:hidden hover:bg-secondary rounded-lg transition-colors"
      aria-label="Open menu"
    >
      <FiMenu className="h-5 w-5 text-primary" />
    </button>
  ), [handleMobileMenuClick]);

  // Memoize logo button
  const logoButton = useMemo(() => (
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
  ), [handleLogoClick]);

  // Memoize agent selector
  const agentSelector = useMemo(() => {
    if (showAgentSelector) {
      return <AgentSelector />;
    }
    return null;
  }, [showAgentSelector]);

  // Memoize user controls
  const userControls = useMemo(() => {
    if (user) {
      return <UserProfile />;
    } else {
      return (
        <button
          onClick={handleSignInClick}
          className="flex items-center space-x-2 p-2 hover:bg-secondary rounded-lg transition-colors"
        >
          <FiUser className="h-5 w-5 text-muted" />
          <span className="text-sm text-muted">Sign In</span>
        </button>
      );
    }
  }, [user, handleSignInClick]);

  return (
    <header className="h-16 bg-primary border-b border-border flex items-center justify-between px-6 z-[10]">
      {/* Left side */}
      <div className="flex items-center space-x-3 flex-1">
        {/* Mobile Menu Button */}
        {mobileMenuButton}

        {/* DINDIN AI Logo */}
        {logoButton}

        {/* Agent Selector (chat routes) */}
        {agentSelector}
      </div>

      {/* Right side - User controls */}
      <div className="flex items-center space-x-4">
        {/* User Profile */}
        {userControls}
      </div>
    </header>
  );
});

export default Header; 