import React from 'react';
import { FiMessageCircle, FiBell } from 'react-icons/fi';
import UserProfile from '../UserProfile';
import ModelSelector from '../ModelSelector';

const Header: React.FC = () => {
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

      {/* Right side - Notifications & User Profile */}
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <button className="btn-ghost p-2">
          <FiBell className="h-5 w-5" />
        </button>

        {/* User Profile */}
        <UserProfile />
      </div>
    </header>
  );
};

export default Header; 