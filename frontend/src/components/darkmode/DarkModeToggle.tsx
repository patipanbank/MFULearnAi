import { useState, useEffect } from 'react';
import { FaMoon, FaSun } from 'react-icons/fa';
import './DarkModeToggle.css';

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
    <button
      onClick={toggleDarkMode}
      className="toggle-button"
      aria-label="Toggle dark mode"
    >
      {isDarkMode ? (
        <FaSun className="icon icon-sun" />
      ) : (
        <FaMoon className="icon icon-moon" />
      )}
    </button>
  );
};

export default DarkModeToggle; 