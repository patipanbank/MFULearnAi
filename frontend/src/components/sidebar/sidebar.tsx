import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
// import { FaComments, FaBars, FaCog, FaHistory, FaSignOutAlt } from 'react-icons/fa';
import { FaComments, FaBars, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { config } from '../../config/config';
import DarkModeToggle from '../darkmode/DarkModeToggle';

interface SidebarProps {
  onClose?: () => void;
}

interface ChatHistory {
  chatname: string;
  modelId: string;
  collectionName: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const location = useLocation();
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const isStaff = userData.groups?.includes('Staffs');
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);

  useEffect(() => {
    const fetchChatHistories = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${config.apiUrl}/api/chat/history`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setChatHistories(data);
        }
      } catch (error) {
        console.error('Error fetching chat histories:', error);
      }
    };

    fetchChatHistories();
  }, []);

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
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            <span style={{ 
              background: 'linear-gradient(to right, rgb(186, 12, 47), rgb(212, 175, 55))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>MFU</span>{' '}
            <span>LEARN{' '}</span>
            <span style={{ 
              background: 'linear-gradient(to right, #00FFFF, #0099FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}> AI</span>
          </h2>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <button 
              onClick={onClose}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <FaBars className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-2 overflow-y-auto">
        <nav className="space-y-2">
          <Link
            to="/mfuchatbot"
            className={`flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 
              ${location.pathname === '/mfuchatbot' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
          >
            <FaComments className="w-5 h-5 mr-3" />
            <span>New Chat</span>
          </Link>

          {/* แสดงรายการ Chat Histories */}
          <div className="mt-4">
            <h3 className="px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Chat History</h3>
            <div className="mt-2 space-y-1">
              {chatHistories.map((chat) => (
                // <Link
                //   key={index}
                //   to={`/mfuchatbot?chat=${index}`}
                //   className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                // >
                // </Link>
                  <span className="truncate">{chat.chatname}</span>
              ))}
            </div>
          </div>

          {isStaff && (
            <Link
              to="/training"
              className={`flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                ${location.pathname === '/training' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
            >
              <FaCog className="w-5 h-5 mr-3" />
              <span>AI Training</span>
            </Link>
          )}

          {/* {isStaff && (
            <Link
              to="/training-history"
              className={`flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                ${location.pathname === '/training-history' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
              onClick={onClose}
            >
              <FaHistory className="w-5 h-5 mr-3" />
              <span>History Training</span>
            </Link>
          )} */}
        </nav>
      </div>

      <div className="flex-none p-4 border-t">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FaSignOutAlt className="w-5 h-5 mr-3" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
