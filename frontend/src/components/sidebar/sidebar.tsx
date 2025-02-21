import { Link, useLocation, useNavigate } from 'react-router-dom';
// import { FaComments, FaBars, FaCog, FaHistory, FaSignOutAlt } from 'react-icons/fa';
import { FaComments, FaBars, FaCog, FaSignOutAlt, FaPlus, FaComment } from 'react-icons/fa';
import DarkModeToggle from '../darkmode/DarkModeToggle';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../../config/config';
import { ChatSession } from '../../types/chat';

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const isStaff = userData.groups?.includes('Staffs');
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  
  useEffect(() => {
    fetchChatSessions();
  }, []);

  const fetchChatSessions = async () => {
    try {
      const response = await axios.get(`${config.apiUrl}/api/chat/sessions`);
      setChatSessions(response.data);
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
    }
  };

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

  const handleNewChat = async () => {
    try {
      const response = await axios.post(`${config.apiUrl}/api/chat/sessions/new`);
      navigate(`/chat/${response.data._id}`);
    } catch (error) {
      console.error('Error creating new chat:', error);
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

      <div className="flex-1 px-4 py-2">
        <nav>
          <Link
            to="/mfuchatbot"
            className={`flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 
              ${location.pathname === '/mfuchatbot' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
          >
            <FaComments className="w-5 h-5 mr-3" />
            <span>
              Chat{' '}
              <span style={{ 
                background: 'linear-gradient(to right, #00FFFF, #0099FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>AI</span>
            </span>
          </Link>

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

        <button 
          onClick={handleNewChat}
          className="w-full flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FaPlus className="w-5 h-5 mr-3" />
          <span>New Chat</span>
        </button>

        <div className="flex-1 overflow-y-auto">
          {chatSessions.map((session) => (
            <Link
              key={session._id}
              to={`/chat/${session._id}`}
              className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <FaComment className="w-5 h-5 mr-3" />
              <div className="flex-1">
                <div className="text-sm font-medium">{session.title}</div>
                <div className="text-xs text-gray-500">
                  {new Date(session.lastUpdated).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
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
