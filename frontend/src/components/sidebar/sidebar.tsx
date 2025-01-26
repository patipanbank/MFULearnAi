import { Link, useLocation } from 'react-router-dom';
import { FaRobot, FaBars, FaCog } from 'react-icons/fa';

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const location = useLocation();
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const isStaff = userData.groups?.includes('Staffs');

  const handleLogout = async () => {
    try {
      localStorage.clear();
      // for development
      // window.location.href = 'http://localhost:5173/login';
      window.location.href = 'https://authsso.mfu.ac.th/adfs/ls/?wa=wsignout1.0';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  return (
    <aside className="flex flex-col h-full">
      <div className="flex-none p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">MFU LEARN AI</h2>
          <button 
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <FaBars className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 py-2">
        <nav>
          <Link
            to="/mfuchatbot"
            className={`flex items-center px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100 
              ${location.pathname === '/mfuchatbot' ? 'bg-gray-100' : ''}`}
          >
            <FaRobot className="w-5 h-5 mr-3" />
            <span>Chatbot</span>
          </Link>

          {isStaff && (
            <Link
              to="/training"
              className={`flex items-center px-4 py-2 mt-2 text-gray-700 rounded-lg hover:bg-gray-100 
                ${location.pathname === '/training' ? 'bg-gray-100' : ''}`}
            >
              <FaCog className="w-5 h-5 mr-3" />
              <span>AI Training</span>
            </Link>
          )}
        </nav>
      </div>

      <div className="flex-none border-t">
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
