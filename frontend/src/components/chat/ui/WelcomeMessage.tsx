import React from 'react';

const WelcomeMessage: React.FC = () => {
  // Get user data from localStorage
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const userName = userData.firstName || userData.username || 'User';

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-screen-sm mx-auto px-4">
      <div className="flex flex-col items-center justify-center mb-4 sm:mb-6">
        <img
          src="/mfu_logo_chatbot.PNG"
          alt="MFU Logo"
          className="w-16 h-16 sm:w-24 sm:h-24 mb-4 object-contain"
        />
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mb-1">
            Welcome
          </h1>
          <div className="text-xl sm:text-2xl font-bold">
            <span style={{
              background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {userName}
            </span>
          </div>
        </div>
      </div>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 text-center">
        How can I help you today?
      </p>
    </div>
  );
};

export default WelcomeMessage; 