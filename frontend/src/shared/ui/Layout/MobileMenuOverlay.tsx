import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiX,
  FiPlus, 
  FiSettings,
  FiUser,
  FiDatabase,
  FiBookmark,
  FiTrash2,
  FiSearch
} from 'react-icons/fi';
import { cn } from '../../lib/utils';
import useLayoutStore from '../../stores/layoutStore';
import { useChatStore } from '../../stores/chatStore';
import PreferencesModal from '../PreferencesModal';
import AccountModal from '../AccountModal';
import AdvancedModal from '../AdvancedModal';

// Mobile Settings Modal Component
const MobileSettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onOpenModal: (modal: string) => void;
}> = ({ isOpen, onClose, onNavigate, onOpenModal }) => {
  const settingsItems = [
    { id: 'knowledge', label: 'Knowledge Base', icon: FiDatabase, description: 'Manage your collections', type: 'route', path: '/knowledgebase' },
    { id: 'agents', label: 'AI Agents', icon: FiUser, description: 'Create and manage agents', type: 'route', path: '/agent' },
    { id: 'preferences', label: 'Preferences', icon: FiSettings, description: 'App settings and theme', type: 'modal' }
  ];

  const handleItemClick = (item: typeof settingsItems[0]) => {
    if (item.type === 'route' && item.path) {
      onNavigate(item.path);
    } else if (item.type === 'modal') {
      onOpenModal(item.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="fixed bottom-0 left-0 right-0 bg-primary z-70 overflow-hidden
                   rounded-t-2xl animate-slide-up-from-bottom
                   max-h-[75vh] sm:max-h-[60vh] md:max-h-[50vh]
                   md:left-1/2 md:transform md:-translate-x-1/2 
                   md:bottom-8 md:rounded-2xl md:max-w-md md:w-full
                   lg:max-w-lg xl:max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle (Mobile Only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-8 h-1 bg-muted rounded-full opacity-50"></div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-primary">
          <h3 className="text-lg sm:text-xl font-semibold text-primary">Settings</h3>
          <button
            onClick={onClose}
            className="btn-ghost p-2 hover:bg-secondary rounded-lg transition-colors"
            aria-label="Close settings"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Settings Items */}
        <div className="p-4 sm:p-6 space-y-2 sm:space-y-3 overflow-y-auto 
                        max-h-[calc(75vh-80px)] sm:max-h-[calc(60vh-80px)] md:max-h-[calc(50vh-80px)]">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="w-full flex items-center space-x-3 sm:space-x-4 
                          p-3 sm:p-4 text-left card-hover transition-all duration-200 
                          rounded-xl hover:scale-[1.02] active:scale-[0.98]
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 
                               bg-secondary rounded-xl flex items-center justify-center">
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-base font-medium text-primary truncate">
                    {item.label}
                  </div>
                  <div className="text-xs sm:text-sm text-muted truncate mt-0.5">
                    {item.description}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-500 rounded-full opacity-0 
                                 group-hover:opacity-100 transition-opacity"></div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer (Optional) */}
        <div className="border-t border-primary p-4 sm:p-6 bg-tertiary rounded-b-2xl md:rounded-b-2xl">
          <p className="text-xs sm:text-sm text-muted text-center">
            Swipe down or tap outside to close
          </p>
        </div>
      </div>
    </div>
  );
};

const MobileMenuOverlay: React.FC = () => {
  const { mobileMenuOpen, setMobileMenuOpen } = useLayoutStore();
  const { 
    chatHistory, 
    currentSession, 
    fetchChatHistory, 
    loadChat, 
    deleteChat, 
    pinChat,
    createNewChat 
  } = useChatStore();
  const navigate = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Modal states
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [preferencesModalOpen, setPreferencesModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);

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
    setSettingsModalOpen(false);
  };

  const handleOpenModal = (modal: string) => {
    setMobileMenuOpen(false);
    setSettingsModalOpen(false);
    
    switch (modal) {
      case 'preferences':
        setPreferencesModalOpen(true);
        break;
      case 'account':
        setAccountModalOpen(true);
        break;
      case 'advanced':
        setAdvancedModalOpen(true);
        break;
      default:
        console.log(`Open ${modal} modal`);
    }
  };

  // Sort chats: pinned first, then by updatedAt
  const sortedChats = [...chatHistory].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Add function to format date with Thailand timezone
  const formatThaiDate = (date: Date | string) => {
    const d = new Date(date);
    d.setHours(d.getHours() + 7); // Add 7 hours for Thailand timezone
    return d.toLocaleDateString('th-TH');
  };

  if (!mobileMenuOpen) return null;

  return (
    <>
      {/* Backdrop - Clickable area to close menu */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in md:hidden"
        onClick={handleBackdropClick}
      >
        {/* Slide-in Menu (80% width) */}
        <div 
          ref={overlayRef}
          className="fixed top-0 left-0 bottom-0 w-[80%] bg-primary z-50 flex flex-col animate-slide-in-from-left shadow-2xl"
          onClick={(e) => e.stopPropagation()} // Prevent backdrop click when clicking on menu
        >
        {/* Header */}
        <div className="flex items-center justify-end p-6 border-b border-primary">
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="btn-ghost p-2"
            aria-label="Close menu"
          >
            <FiX className="h-6 w-6 text-primary" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="p-6 space-y-4 border-b border-primary">
          <button
            onClick={handleNewChat}
            className="btn-primary w-full flex items-center justify-center space-x-3 py-3"
          >
            <FiPlus className="h-5 w-5" />
            <span>New Chat</span>
          </button>
          
          <button
            onClick={handleSearch}
            className="btn-secondary w-full flex items-center justify-center space-x-3 py-3"
          >
            <FiSearch className="h-5 w-5" />
            <span>Search</span>
          </button>
        </div>

        {/* Recent Chats */}
        <div className="flex-1 overflow-y-auto p-6">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            --- Latest chat ---
          </h3>
          <div className="space-y-2">
            {sortedChats.length === 0 ? (
              <div className="text-sm text-muted text-center py-8">
                No chats yet. Start a new conversation!
              </div>
            ) : (
              sortedChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleChatClick(chat.id)}
                  className={cn(
                    'group relative flex items-center justify-between p-4 rounded-xl transition-colors cursor-pointer',
                    currentSession?.id === chat.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                      : 'text-secondary card-hover'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      {chat.isPinned && (
                        <FiBookmark className="h-4 w-4 text-muted flex-shrink-0" />
                      )}
                      <span className="truncate font-medium text-base">
                        {chat.name}
                      </span>
                    </div>
                    <div className="text-sm text-muted mt-1">
                      {formatThaiDate(chat.updatedAt)}
                    </div>
                  </div>
                  
                  {/* Chat Actions */}
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
              ))
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="border-t border-primary p-6">
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="btn-ghost w-full flex items-center justify-center space-x-3 py-3 mb-4"
          >
            <FiSettings className="h-5 w-5" />
            <span>Settings</span>
          </button>
        </div>
        </div>
      </div>

      {/* Modals */}
      <PreferencesModal 
        isOpen={preferencesModalOpen} 
        onClose={() => setPreferencesModalOpen(false)} 
      />
      <AccountModal 
        isOpen={accountModalOpen} 
        onClose={() => setAccountModalOpen(false)} 
      />
      <AdvancedModal 
        isOpen={advancedModalOpen} 
        onClose={() => setAdvancedModalOpen(false)} 
      />
      <MobileSettingsModal 
        isOpen={settingsModalOpen} 
        onClose={() => setSettingsModalOpen(false)} 
        onNavigate={handleNavigate} 
        onOpenModal={handleOpenModal} 
      />
    </>
  );
};

export default MobileMenuOverlay; 