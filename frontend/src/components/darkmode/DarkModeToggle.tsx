import useUIStore from '../../store/uiStore';

const DarkModeToggle = () => {
  const { isDarkMode, toggleDarkMode } = useUIStore();

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
    >
      {isDarkMode ? 'Light' : 'Dark'}
    </button>
  );
};

export default DarkModeToggle; 