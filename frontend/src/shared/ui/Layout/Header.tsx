import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiMenu, FiUser } from 'react-icons/fi';
import { useAuthStore, useUIStore, useLayoutStore, useChatStore } from '../../stores';
import { config } from '../../../config/config';
import AgentSelector from '../AgentSelector';
import CompactTokenUsage from '../TokenUsageDisplay/CompactTokenUsage';
import UserProfile from '../UserProfile';

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const { toggleMobileMenu } = useLayoutStore();
  const { toggleDropdown } = useUIStore();
  const { createNewChat } = useChatStore();

  // Ensure mock user is set in development mode
  useEffect(() => {
    if (config.isDevelopment && !user) {
      console.log('Header: Development mode - ensuring mock user is set');
      const currentState = useAuthStore.getState();
      if (!currentState.user) {
        const mockToken = 'dev-mock-token';
        localStorage.setItem('auth_token', mockToken);
        useAuthStore.setState({
          token: mockToken,
          status: 'authenticated',
          user: {
            _id: { $oid: 'dev-user-id' },
            id: 'dev-user-id',
            nameID: 'dev-user',
            username: 'dev-user',
            email: 'dev@localhost.local',
            firstName: 'Development',
            lastName: 'User',
            department: 'Development',
            role: 'Students',
            groups: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          },
        });
      }
    }
  }, [user]);
   
  // Show AgentSelector only on chat routes
  const showAgentSelector = location.pathname.startsWith('/chat');

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
        
        {/* Token Usage Display (chat routes) */}
        {showAgentSelector && (
          <div className="ml-4">
            <CompactTokenUsage />
          </div>
        )}
      </div>

      {/* Right side - User controls */}
      <div className="flex items-center space-x-2">
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