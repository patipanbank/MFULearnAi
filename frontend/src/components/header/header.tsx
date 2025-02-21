import React from 'react';
import { FaBars } from 'react-icons/fa';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  // Get user data from localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  return (
    <header className="w-full bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-6 py-3 max-w-[90rem] mx-auto">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <FaBars className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        </button>
        {userData && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {userData.firstName} {userData.lastName}
          </span>
        )}
      </div>
    </header>
  );
};

export default Header;
