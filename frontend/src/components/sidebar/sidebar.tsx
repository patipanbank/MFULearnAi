import { Link, useLocation } from 'react-router-dom';
import { FaRobot } from 'react-icons/fa';

const Sidebar = () => {
  const location = useLocation();

  const handleLogout = async () => {
    try {
      localStorage.removeItem('auth_token');
      await Promise.resolve();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <aside className="bg-white h-screen flex flex-col border-r border-gray-200">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800">MFU</h2>
      </div>

      <nav className="mt-2 flex-1">
        <ul className="space-y-1">
          <li>
            <Link
              to="/chatbot"
              className={`flex items-center px-6 py-3 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors ${
                location.pathname === '/chatbot' ? 'bg-blue-50 text-blue-600' : ''
              }`}
            >
              <FaRobot className="mr-3" />
              Chatbot
            </Link>
          </li>
        </ul>
      </nav>

      <div className="mt-auto border-t border-gray-200">
        <button 
          onClick={handleLogout}
          className="flex items-center w-full px-6 py-4 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg" 
            className="mr-3"
          >
            <path 
              d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M16 17L21 12L16 7" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M21 12H9" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
