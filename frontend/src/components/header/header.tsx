import React from 'react';
import { useLocation } from 'react-router-dom';

interface Model {
  id: string;
  name: string;
  collections: string[];
}

interface HeaderProps {
  selectedModel?: Model | null;
  models?: Model[];
  onModelSelect?: (model: Model) => void;
  showModelSelector?: boolean;
}

const Header: React.FC<HeaderProps> = ({ selectedModel, models = [], onModelSelect, showModelSelector = false }) => {
  // Get current location to determine if we're on the chatbot page
  const location = useLocation();
  const isChatbotPage = location.pathname === '/chat';

  // Get user data from localStorage
  const userDataString = localStorage.getItem('user_data');
  const userData = userDataString ? JSON.parse(userDataString) : null;

  console.log('User data from localStorage:', userData); // เพิ่ม log เพื่อตรวจสอบข้อมูล

  return (
    <header className="w-full bg-white dark:bg-gray-800 border-b dark:border-gray-700">
      <nav className="flex items-center justify-between px-6 py-3 max-w-[90rem] mx-auto">
        {/* Left Side: Model Selector (only shown on chatbot page) */}
        <div className="flex-1">
          {showModelSelector && isChatbotPage && (
            <div className="relative inline-block">
              <select
                value={selectedModel?.id || ''}
                onChange={(e) => {
                  const modelId = e.target.value;
                  const model = models.find((m) => m.id === modelId);
                  if (model && onModelSelect) {
                    onModelSelect(model);
                  }
                }}
                className="px-4 py-2 text-sm rounded-xl border-0 bg-white dark:bg-gray-700 
                text-gray-900 dark:text-gray-100 hover:border hover:border-gray-300 dark:hover:border-gray-600
                focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200 
                shadow-sm hover:shadow-md appearance-none cursor-pointer pr-10"
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
              >
                <option value="">Select Model</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              {/* Custom arrow */}
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: User Name */}
        <div className="flex items-center">
          {userData && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {userData.firstName} {userData.lastName}
            </span>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
