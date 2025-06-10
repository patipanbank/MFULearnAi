import { useState, useEffect } from 'react';
import { FaMoon, FaSun } from 'react-icons/fa';

const DarkModeToggle = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode === 'true';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className="flex items-center px-4 py-3 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200">
      {/* Clickable Icon with consistent spacing */}
      <button 
        onClick={toggleDarkMode}
        className="p-0 hover:opacity-75 transition-opacity"
        aria-label="Toggle dark mode"
      >
        {isDarkMode ? (
          <FaSun className="w-5 h-5 mr-3 flex-shrink-0 text-yellow-500" />
        ) : (
          <FaMoon className="w-5 h-5 mr-3 flex-shrink-0 text-gray-600 dark:text-gray-400" />
        )}
      </button>
      
      {/* Clickable text */}
      <button
        onClick={toggleDarkMode}
        className="font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        aria-label="Toggle dark mode"
      >
        Change Theme
      </button>
    </div>
  );
};

export default DarkModeToggle; 