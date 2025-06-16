import useUIStore from '../../store/uiStore';
import { FiSun, FiMoon } from 'react-icons/fi';

const DarkModeToggle = () => {
  const { isDarkMode, toggleDarkMode } = useUIStore();

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-full text-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
    >
      {isDarkMode ? <FiSun /> : <FiMoon />}
    </button>
  );
};

export default DarkModeToggle; 