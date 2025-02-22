// import { Link, useLocation } from 'react-router-dom';
// import { FaComments, FaBars, FaCog, FaHistory, FaSignOutAlt } from 'react-icons/fa';
import { FaComments, FaBars, FaSignOutAlt } from 'react-icons/fa';
import DarkModeToggle from '../darkmode/DarkModeToggle';
import { useState, useEffect } from 'react';
import { config } from '../../config/config';

interface SidebarProps {
  onClose?: () => void;
  onSelectChat: (chatId: string) => void;
}

interface ChatHistory {
  id: string;
  chatName: string;
  updatedAt: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose, onSelectChat }) => {
  // const location = useLocation();
  // const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  // const isStaff = userData.groups?.includes('Staffs');
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);

  useEffect(() => {
    fetchChatHistories();
  }, []);

  const fetchChatHistories = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const histories = await response.json();
        setChatHistories(histories);
      }
    } catch (error) {
      console.error('Error fetching chat histories:', error);
    }
  };

  const handleNewChat = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/new`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const newChat = await response.json();
        onSelectChat(newChat.id);
        fetchChatHistories();
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
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
        <button
          onClick={handleNewChat}
          className="w-full mb-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          New Chat
        </button>

        <nav className="space-y-2">
          {chatHistories.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className="w-full flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <FaComments className="w-5 h-5 mr-3" />
              <div className="flex-1 text-left">
                <div className="truncate">{chat.chatName}</div>
                <div className="text-xs text-gray-500">
                  {new Date(chat.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </button>
          ))}
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
