import React from 'react';

interface WelcomeMessageProps {
  onNewChat?: () => void;
}

const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ onNewChat }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="flex flex-col items-center justify-center mb-1">
        <img
          src="/mfu_logo_chatbot.PNG"
          alt="MFU Logo"
          className="w-24 h-24 mb-2 object-contain"
        />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-0">
            Welcome to
          </h1>
          <div className="text-2xl font-bold -mt-1 mb-0">
            <span style={{
              background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              DIN
            </span>{''}
            <span className="text-gray-800 dark:text-white">DIN{' '}</span>
            <span style={{
              background: 'linear-gradient(to right, #00FFFF, #0099FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              AI
            </span>
          </div>
        </div>
      </div>
      <p className="text-gray-600 dark:text-gray-300 -mt-1">How can I help you today?</p>
      <button 
        onClick={onNewChat}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        Start New Chat
      </button>
    </div>
  );
};

export default WelcomeMessage; 