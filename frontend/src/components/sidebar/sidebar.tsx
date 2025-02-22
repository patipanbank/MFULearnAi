import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaComments, FaBars, FaCog, FaSignOutAlt, FaTrash, FaEdit, FaAndroid } from 'react-icons/fa';
import { config } from '../../config/config';
import DarkModeToggle from '../darkmode/DarkModeToggle';

interface SidebarProps {
  onClose?: () => void;
}

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  images?: {
    data: string;
    mediaType: string;
  }[];
  sources?: {
    modelId: string;
    collectionName: string;
    filename: string;
    similarity: number;
  }[];
}

interface ChatHistory {
  _id: string;
  chatname: string;
  modelId: string;
  collectionName: string;
  messages: Message[];
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const isStaff = userData.groups?.includes('Staffs') || userData.groups?.includes('Admin');
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const searchParams = new URLSearchParams(location.search);
  const currentChatId = searchParams.get('chat');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [newChatName, setNewChatName] = useState('');

  const handleTokenExpired = () => {
    localStorage.clear();
    navigate('/login');
  };

  const fetchChatHistories = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        handleTokenExpired();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setChatHistories(data);
        } else if (data.messages) {
          setChatHistories([data]);
        } else {
          setChatHistories([]);
        }
      }
    } catch (error) {
      console.error('Error fetching chat histories:', error);
      setChatHistories([]);
    }
  };

  useEffect(() => {
    fetchChatHistories();
    
    // เพิ่ม event listener สำหรับอัพเดทแบบ realtime
    const handleChatUpdate = () => {
      fetchChatHistories();
    };
    
    window.addEventListener('chatUpdated', handleChatUpdate);
    return () => {
      window.removeEventListener('chatUpdated', handleChatUpdate);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDelete = async (chatId: string) => {
    if (!confirm('คุณต้องการลบแชทนี้ใช่หรือไม่?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        handleTokenExpired();
        return;
      }

      if (response.ok) {
        // ถ้าลบแชทที่กำลังดูอยู่ ให้กลับไปหน้า New Chat
        if (currentChatId === chatId) {
          navigate('/mfuchatbot');
        }
        fetchChatHistories();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleEdit = (chatId: string, currentName: string) => {
    setEditingChatId(chatId);
    setNewChatName(currentName);
  };

  const handleSaveEdit = async (chatId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history/${chatId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ chatname: newChatName })
      });

      if (response.status === 401) {
        handleTokenExpired();
        return;
      }

      if (response.ok) {
        setEditingChatId(null);
        fetchChatHistories();
      }
    } catch (error) {
      console.error('Error updating chat name:', error);
    }
  };

  // เพิ่มฟังก์ชันสำหรับตัดข้อความที่ยาวเกินไป
  const truncateText = (text: string, maxLength: number = 10) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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

          {isStaff && (
            <Link
              to="/modelCreation"
              className={`flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                ${location.pathname === '/modelCreation' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
              onClick={onClose}
            >
              <FaAndroid className="w-5 h-5 mr-3" />
              <span>Model Creation</span>
            </Link>
          )}

          {/* แสดงรายการ Chat Histories */}
          <div className="mt-4">
            <h3 className="px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Chat History</h3>
            <div className="mt-2 space-y-1">
              {Array.isArray(chatHistories) && chatHistories.map((chat) => (
                <div key={chat._id} className="flex items-center group">
                  {editingChatId === chat._id ? (
                    <div className="flex-1 flex items-center px-4 py-2">
                      <input
                        type="text"
                        value={newChatName}
                        onChange={(e) => setNewChatName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(chat._id);
                          if (e.key === 'Escape') setEditingChatId(null);
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(chat._id)}
                        className="ml-2 text-green-500 hover:text-green-600"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingChatId(null)}
                        className="ml-2 text-red-500 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <Link
                        to={`/mfuchatbot?chat=${chat._id}`}
                        className={`flex-1 flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                          ${currentChatId === chat._id ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                        title={chat.chatname || 'Untitled Chat'}
                      >
                        <span className="truncate">
                          {truncateText(chat.chatname || 'Untitled Chat')}
                        </span>
                      </Link>
                      <div className="hidden group-hover:flex items-center pr-2">
                        <button
                          onClick={() => handleEdit(chat._id, chat.chatname)}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(chat._id)}
                          className="p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
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
