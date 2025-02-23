import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaComments, FaBars, FaCog, FaSignOutAlt, FaTrash, FaEdit, FaAndroid, FaSearch, FaStar } from 'react-icons/fa';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedChats, setPinnedChats] = useState<string[]>([]);

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
      const response = await fetch(`${config.apiUrl}/api/chat/history/${chatId}/rename`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newName: newChatName })
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

  const handlePinChat = async (chatId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiUrl}/api/chat/history/${chatId}/pin`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        handleTokenExpired();
        return;
      }

      if (response.ok) {
        setPinnedChats(prev => 
          prev.includes(chatId) 
            ? prev.filter(id => id !== chatId)
            : [...prev, chatId]
        );
        fetchChatHistories();
      }
    } catch (error) {
      console.error('Error pinning chat:', error);
    }
  };

  const filteredChats = chatHistories.filter(chat => 
    chat.chatname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedChats = [...filteredChats].sort((a, b) => {
    // First sort by pinned status
    const isPinnedA = pinnedChats.includes(a._id);
    const isPinnedB = pinnedChats.includes(b._id);
    if (isPinnedA !== isPinnedB) return isPinnedB ? 1 : -1;
    
    // Then sort by most recent
    return new Date(b.messages[b.messages.length - 1]?.timestamp || 0).getTime() -
           new Date(a.messages[a.messages.length - 1]?.timestamp || 0).getTime();
  });

  return (
    <aside className="flex flex-col h-full">
      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700">
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
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
            >
              <FaBars className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2 pb-[calc(72px+env(safe-area-inset-bottom))]">
        <nav className="space-y-4">
          <Link
            to="/mfuchatbot"
            className={`flex items-center px-4 py-3 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200
              ${location.pathname === '/mfuchatbot' && !currentChatId ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''}`}
          >
            <FaComments className="w-5 h-5 mr-3" />
            <span className="font-medium">New Chat</span>
          </Link>

          {isStaff && (
            <>
              <Link
                to="/modelCreation"
                className={`flex items-center px-4 py-3 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200
                  ${location.pathname === '/modelCreation' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''}`}
                onClick={onClose}
              >
                <FaAndroid className="w-5 h-5 mr-3" />
                <span className="font-medium">Model Creation</span>
              </Link>

              <Link
                to="/training"
                className={`flex items-center px-4 py-3 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200
                  ${location.pathname === '/training' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''}`}
              >
                <FaCog className="w-5 h-5 mr-3" />
                <span className="font-medium">AI Training</span>
              </Link>
            </>
          )}
        </nav>

        {sortedChats.length > 0 && (
          <div className="mt-6">
            <h3 className="px-4 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Chat History</h3>
            <div className="space-y-1">
              {sortedChats.map((chat) => (
                <div key={chat._id} className="flex items-center group">
                  {editingChatId === chat._id ? (
                    <div className="flex-1 flex items-center px-4 py-2">
                      <input
                        type="text"
                        value={newChatName}
                        onChange={(e) => setNewChatName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(chat._id);
                          if (e.key === 'Escape') setEditingChatId(null);
                        }}
                        className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(chat._id)}
                        className="ml-2 p-2 text-green-500 hover:text-green-600"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingChatId(null)}
                        className="p-2 text-red-500 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <Link
                        to={`/mfuchatbot?chat=${chat._id}`}
                        className={`flex-1 flex items-center px-4 py-3 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200
                          ${currentChatId === chat._id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''}`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handlePinChat(chat._id);
                            }}
                            className={`p-1 rounded-full transition-colors ${
                              pinnedChats.includes(chat._id)
                                ? 'text-yellow-500 hover:text-yellow-600'
                                : 'text-gray-400 hover:text-gray-500'
                            }`}
                          >
                            <FaStar className="w-4 h-4" />
                          </button>
                          <div className="truncate">
                            <div className="font-medium truncate">
                              {chat.chatname || 'Untitled Chat'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {chat.messages[chat.messages.length - 1]?.content || 'No messages'}
                            </div>
                          </div>
                        </div>
                      </Link>
                      <div className="hidden group-hover:flex items-center pr-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleEdit(chat._id, chat.chatname);
                          }}
                          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(chat._id);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
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
        )}
      </div>

      <div className="fixed bottom-0 left-0 w-64 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-[env(safe-area-inset-bottom)] lg:w-64">
        <div className="p-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200"
          >
            <FaSignOutAlt className="w-5 h-5 mr-3" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
