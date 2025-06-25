import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiX,
  FiPlus, 
  FiUser,
  FiDatabase,
  FiBookmark,
  FiTrash2,
  FiSearch,
  FiSliders
} from 'react-icons/fi';
import { cn } from '../../lib/utils';
import useLayoutStore from '../../stores/layoutStore';
import { useChatStore } from '../../stores/chatStore';
import PreferencesModal from '../PreferencesModal';

const MobileMenuOverlay: React.FC = () => {
  const { mobileMenuOpen, setMobileMenuOpen } = useLayoutStore();
  const { 
    chatHistory, 
    fetchChatHistory, 
    loadChat, 
    deleteChat, 
    pinChat,
    createNewChat 
  } = useChatStore();
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Modal states
  const [preferencesModalOpen, setPreferencesModalOpen] = useState(false);

  // Fetch chat history on mount
  useEffect(() => {
    if (mobileMenuOpen) {
      fetchChatHistory();
    }
  }, [mobileMenuOpen, fetchChatHistory]);

  // Close menu when clicking outside (on backdrop)
  const handleBackdropClick = (event: React.MouseEvent) => {
    // Only close if clicking on the backdrop itself, not the menu content
    if (event.target === event.currentTarget) {
      setMobileMenuOpen(false);
    }
  };

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const handleChatClick = async (chatId: string) => {
    await loadChat(chatId);
    navigate('/chat');
    setMobileMenuOpen(false);
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
    setMobileMenuOpen(false);
  };

  const handleSearch = () => {
    navigate('/search');
    setMobileMenuOpen(false);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  // Sort chats: pinned first, then by updatedAt
  const sortedChats = [...chatHistory].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  if (!mobileMenuOpen) return null;

  return (
    <>
      {/* Backdrop - Clickable area to close menu */}
      <div 
        ref={overlayRef}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={handleBackdropClick}
      >
        {/* Menu Content */}
        <div 
          className="fixed inset-y-0 left-0 w-full sm:w-80 bg-primary shadow-xl flex flex-col animate-slide-in-from-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-primary">Menu</h2>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="btn-ghost p-2"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleNewChat}
                className="btn-ghost flex items-center justify-center space-x-2 py-3"
              >
                <FiPlus className="h-5 w-5" />
                <span>New Chat</span>
              </button>
              <button
                onClick={handleSearch}
                className="btn-ghost flex items-center justify-center space-x-2 py-3"
              >
                <FiSearch className="h-5 w-5" />
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {sortedChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleChatClick(chat.id)}
                  className="flex items-center justify-between p-3 rounded-lg card-hover cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      {chat.isPinned && (
                        <FiBookmark className="h-3 w-3 text-blue-500 fill-current flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-primary truncate">
                        {chat.name || 'New Chat'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => handlePinChat(e, chat.id, chat.isPinned)}
                      className="p-2 text-muted hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title={chat.isPinned ? 'Unpin chat' : 'Pin chat'}
                    >
                      <FiBookmark className={cn(
                        'h-4 w-4',
                        chat.isPinned && 'fill-current'
                      )} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      className="p-2 text-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete chat"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="border-t border-border p-4 space-y-2">
            <button
              onClick={() => handleNavigate('/knowledgebase')}
              className="w-full flex items-center space-x-3 p-3 rounded-lg card-hover"
            >
              <FiDatabase className="h-5 w-5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Knowledge Base</div>
                <div className="text-xs text-muted">Manage your collections</div>
              </div>
            </button>

            <button
              onClick={() => handleNavigate('/agent')}
              className="w-full flex items-center space-x-3 p-3 rounded-lg card-hover"
            >
              <FiUser className="h-5 w-5" />
              <div className="flex-1">
                <div className="text-sm font-medium">AI Agents</div>
                <div className="text-xs text-muted">Create and manage agents</div>
              </div>
            </button>

            <button
              onClick={() => setPreferencesModalOpen(true)}
              className="w-full flex items-center space-x-3 p-3 rounded-lg card-hover"
            >
              <FiSliders className="h-5 w-5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Preferences</div>
                <div className="text-xs text-muted">App settings and theme</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PreferencesModal 
        isOpen={preferencesModalOpen} 
        onClose={() => {
          setPreferencesModalOpen(false);
          setMobileMenuOpen(false);
        }} 
      />
    </>
  );
};

export default MobileMenuOverlay; 