import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
// import { FaComments, FaBars, FaCog, FaHistory, FaSignOutAlt } from 'react-icons/fa';
import { FaComments, FaBars, FaCog, FaSignOutAlt, FaPlus, FaPen } from 'react-icons/fa';
import DarkModeToggle from '../darkmode/DarkModeToggle';
import { config } from '../../config/config';

interface SidebarProps {
  onClose?: () => void;
}

interface ChatHistoryItem {
  _id: string;
  title: string;
  createdAt: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const location = useLocation();
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const isStaff = userData.groups?.includes('Staffs');
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const navigate = useNavigate();

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

  const fetchChatHistory = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/chat/history/all`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      setChatHistory(data);
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    }
  };

  const createNewChat = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/chat/new`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });
      const newChat = await response.json();
      await fetchChatHistory();
      navigate(`/chat/${newChat._id}`);
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    try {
      await fetch(`${config.apiUrl}/api/chat/rename/${chatId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: newTitle })
      });
      setEditingId(null);
      fetchChatHistory();
    } catch (error) {
      console.error('Failed to rename chat:', error);
    }
  };

  useEffect(() => {
    fetchChatHistory();
  }, []);

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
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
          >
            <FaPlus /> New Chat
          </button>
        </div>

        <div className="space-y-2 px-4">
          {chatHistory.map((chat) => (
            <div key={chat._id} className="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              {editingId === chat._id ? (
                <input
                  type="text"
                  defaultValue={chat.title}
                  onBlur={(e) => renameChat(chat._id, e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      renameChat(chat._id, e.currentTarget.value);
                    }
                  }}
                  className="flex-1 p-1 mr-2 border rounded"
                  autoFocus
                />
              ) : (
                <Link 
                  to={`/chat/${chat._id}`}
                  className="flex-1 truncate"
                  onClick={onClose}
                >
                  {chat.title}
                </Link>
              )}
              <button
                onClick={() => setEditingId(chat._id)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                <FaPen className="w-3 h-3" />
              </button>
            </div>
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
