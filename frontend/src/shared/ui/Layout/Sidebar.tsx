import React, { useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  FiSearch, 
  FiUser, 
  FiSettings,
  FiMenu,
  FiPlus,
  FiDatabase,
  FiSliders,
  FiBookmark,
  FiTrash2
} from 'react-icons/fi';
import { useLayoutStore, useUIStore, useChatStore } from '../../stores';
import { cn, formatDate } from '../../lib/utils';
import PreferencesModal from '../PreferencesModal';

// Add custom icon styles
const iconBaseStyle = "transition-colors duration-200";
const iconColors = {
  menu: "text-purple-500 hover:text-purple-600",
  search: "text-blue-500 hover:text-blue-600",
  plus: "text-white", // For the new chat button which has a primary background
  settings: "text-blue-500 hover:text-blue-600",
  preferences: "text-emerald-500 hover:text-emerald-600",
  database: "text-amber-500 hover:text-amber-600",
  user: "text-indigo-500 hover:text-indigo-600",
  bookmark: "text-rose-500 hover:text-rose-600",
  trash: "text-red-500 hover:text-red-600"
};

const Sidebar: React.FC = () => {
  const { 
    sidebarCollapsed, 
    sidebarHovered, 
    toggleSidebar, 
    setSidebarHovered
  } = useLayoutStore();
  const { openDropdowns, toggleDropdown, closeDropdown } = useUIStore();
  const { 
    chatHistory, 
    fetchChatHistory, 
    loadChat, 
    deleteChat, 
    pinChat,
    createNewChat 
  } = useChatStore();
  const navigate = useNavigate();
  const location = useLocation();
  const settingsRef = useRef<HTMLDivElement>(null);

  // Modal states
  const [preferencesModalOpen, setPreferencesModalOpen] = useState(false);

  const settingsDropdownId = 'settings-dropdown';
  const isSettingsOpen = openDropdowns.includes(settingsDropdownId);

  // Fetch chat history on mount
  useEffect(() => {
    fetchChatHistory();
  }, [fetchChatHistory]);

  // Close settings dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        closeDropdown(settingsDropdownId);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown, settingsDropdownId]);

  const settingsItems = [
    { 
      id: 'knowledge', 
      label: 'Knowledge Base', 
      icon: FiDatabase, 
      description: 'Manage your collections', 
      type: 'route', 
      path: '/knowledgebase',
      iconColor: iconColors.database
    },
    { 
      id: 'agents', 
      label: 'AI Agents', 
      icon: FiUser, 
      description: 'Create and manage agents', 
      type: 'route', 
      path: '/agent',
      iconColor: iconColors.user
    },
    { 
      id: 'preferences', 
      label: 'Preferences', 
      icon: FiSliders, 
      description: 'App settings and theme', 
      type: 'modal',
      iconColor: iconColors.preferences
    }
  ];

  const handleSettingsItemClick = (item: typeof settingsItems[0]) => {
    if (item.type === 'route' && item.path) {
      navigate(item.path);
      closeDropdown(settingsDropdownId);
    } else if (item.type === 'modal') {
      closeDropdown(settingsDropdownId);
      
      // Open appropriate modal
      switch (item.id) {
        case 'preferences':
          setPreferencesModalOpen(true);
          break;
        default:
          // Handle other modals if needed
          break;
      }
    }
  };

  const handleChatClick = async (chatId: string | undefined) => {
    if (!chatId || chatId === 'undefined') return;
    
    // Check if we're already on this chat page
    if (location.pathname === `/chat/${chatId}`) return;
    
    // Find the chat in history first
    const chatFromHistory = chatHistory.find(chat => chat.id === chatId);
    if (chatFromHistory) {
      // Use the name from history to prevent flashing "New Chat"
      const ok = await loadChat(chatId);
      if (ok) {
        navigate(`/chat/${chatId}`, { replace: true });
      }
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this chat?')) {
      await deleteChat(chatId);
    }
  };

  const handlePinChat = async (e: React.MouseEvent, chatId: string, isPinned: boolean | undefined) => {
    e.stopPropagation();
    pinChat(chatId, !isPinned);
  };

  const handleNewChat = () => {
    createNewChat();
    navigate('/chat');
  };

  // Handle hover events for expand on hover
  const handleMouseEnter = () => {
    if (sidebarCollapsed) {
      setSidebarHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (sidebarHovered) {
      setSidebarHovered(false);
    }
  };

  // Sort chats: pinned first, then by updatedAt
  const sortedChats = [...chatHistory].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Determine if sidebar should show expanded content
  const showExpandedContent = !sidebarCollapsed || sidebarHovered;
  const sidebarWidth = sidebarCollapsed && !sidebarHovered ? 'w-16' : 'w-64';

  return (
    <>
      <div 
        className={cn(
          'sidebar flex flex-col transition-all duration-300 ease-in-out relative z-20',
          sidebarWidth,
          sidebarCollapsed && 'hover:shadow-2xl'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="p-4 sidebar-section-divider">
          <div className="flex items-center justify-between">
            <button
              onClick={toggleSidebar}
              className="btn-ghost p-2"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <FiMenu className={cn("h-5 w-5", iconBaseStyle, iconColors.menu)} />
            </button>
            
            {showExpandedContent && (
              <button
                onClick={() => navigate('/search')}
                className={cn(
                  "btn-ghost px-3 py-1 flex items-center space-x-2 transition-all duration-200",
                  sidebarHovered && "animate-fade-in"
                )}
              >
                <FiSearch className={cn("h-4 w-4", iconBaseStyle, iconColors.search)} />
                <span className="text-sm font-medium">Search</span>
              </button>
            )}
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            onClick={handleNewChat}
            className={cn(
              'btn-primary w-full flex items-center justify-center space-x-2 transition-all duration-200',
              (sidebarCollapsed && !sidebarHovered) && 'px-2'
            )}
            title={sidebarCollapsed && !sidebarHovered ? 'New Chat' : undefined}
          >
            <FiPlus className={cn("h-5 w-5", iconBaseStyle, iconColors.plus)} />
            {showExpandedContent && (
              <span className={cn(
                "transition-all duration-200",
                sidebarHovered && "animate-fade-in"
              )}>
                New Chat
              </span>
            )}
          </button>
        </div>

        {/* Recent Chats - Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Collapsed Chat Icons */}
          {(sidebarCollapsed && !sidebarHovered) && (
            <div className="px-2 py-4 space-y-2">
              {sortedChats.slice(0, 5).map((chat) => {
                const isCurrentChat = location.pathname === `/chat/${chat.id}`;
                return (
                  <button
                    key={chat.id}
                    onClick={() => handleChatClick(chat.id)}
                    className={cn(
                      'w-full h-10 rounded-lg flex items-center justify-center transition-colors relative',
                      isCurrentChat
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 cursor-default'
                        : 'text-muted hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary'
                    )}
                    title={chat.name}
                    disabled={isCurrentChat}
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                      {chat.name.charAt(0).toUpperCase()}
                    </div>
                    {chat.isPinned && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-gray-900">
                        <FiBookmark className="w-2 h-2 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          
          {showExpandedContent && (
            <div className={cn(
              "px-4 pb-4 transition-all duration-200",
              sidebarHovered && "animate-fade-in"
            )}>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                --- Latest chat ---
              </h3>
              <div className="space-y-1">
                {sortedChats.length === 0 ? (
                  <div className="text-sm text-muted text-center py-4">
                    No chats yet. Start a new conversation!
                  </div>
                ) : (
                  sortedChats.map((chat) => {
                    const isCurrentChat = location.pathname === `/chat/${chat.id}`;
                    return (
                      <div
                        key={chat.id}
                        onClick={() => handleChatClick(chat.id)}
                        className={cn(
                          'group relative flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors',
                          isCurrentChat
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 cursor-default'
                            : 'text-secondary card-hover cursor-pointer'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            {chat.isPinned && (
                              <FiBookmark className="h-3 w-3 text-muted flex-shrink-0" />
                            )}
                            <span className="truncate font-medium">
                              {chat.name}
                            </span>
                          </div>
                          <div className="text-xs text-muted mt-1">
                            {formatDate(chat.updatedAt)}
                          </div>
                        </div>
                        
                        {/* Chat Actions */}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handlePinChat(e, chat.id, chat.isPinned)}
                            className="p-1 text-muted hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title={chat.isPinned ? 'Unpin chat' : 'Pin chat'}
                          >
                            <FiBookmark className={cn(
                              'h-3 w-3',
                              chat.isPinned && 'fill-current'
                            )} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteChat(e, chat.id)}
                            className="p-1 text-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete chat"
                          >
                            <FiTrash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings Button - Fixed at Bottom */}
        <div className="p-4 relative">
          {/* Subtle top divider */}
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent"></div>
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => toggleDropdown(settingsDropdownId)}
              className={cn(
                'btn-ghost w-full flex items-center justify-center space-x-2 transition-all duration-200',
                (sidebarCollapsed && !sidebarHovered) && 'px-2'
              )}
              title={sidebarCollapsed && !sidebarHovered ? 'Settings' : undefined}
            >
              <FiSettings className={cn("h-5 w-5", iconBaseStyle, iconColors.settings)} />
              {showExpandedContent && (
                <span className={cn(
                  "transition-all duration-200",
                  sidebarHovered && "animate-fade-in"
                )}>
                  Settings
                </span>
              )}
            </button>

            {/* Settings Dropdown */}
            {isSettingsOpen && (
              <div className={cn(
                'absolute bottom-full mb-2 dropdown-menu py-2 animate-slide-in-from-bottom-2',
                (sidebarCollapsed && !sidebarHovered)
                  ? 'left-full ml-2 w-64' 
                  : 'left-0 right-0'
              )}>
                {settingsItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSettingsItemClick(item)}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-left card-hover transition-colors"
                    >
                      <Icon className={cn("h-4 w-4", iconBaseStyle, item.iconColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-primary">{item.label}</div>
                        <div className="text-xs text-muted truncate">{item.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <PreferencesModal 
        isOpen={preferencesModalOpen} 
        onClose={() => setPreferencesModalOpen(false)} 
      />
    </>
  );
};

export default Sidebar; 