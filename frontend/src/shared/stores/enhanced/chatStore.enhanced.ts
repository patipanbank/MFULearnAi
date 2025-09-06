import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { withDevMiddleware } from '../core/storeMiddleware';
import { storeActionCreator, STORE_ACTIONS } from '../core/storeActions';
import { StoreSync, LocalStorageAdapter } from '../core/storeSync';
import type { ChatMessage, ChatSession } from '../chatStore';

/**
 * Enhanced Chat Store - ปรับปรุงด้วย middleware และ sync
 */
interface EnhancedChatState {
  // Core state (same as original)
  currentSession: ChatSession | null;
  chatHistory: ChatSession[];
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  isTyping: boolean;
  
  // Enhanced features
  searchQuery: string;
  filteredHistory: ChatSession[];
  messageCache: Map<string, ChatMessage>;
  syncStatus: 'idle' | 'syncing' | 'error';
  
  // Actions
  setCurrentSession: (session: ChatSession | null) => void;
  setChatHistory: (history: ChatSession[]) => void;
  addChatToHistory: (chat: ChatSession) => void;
  removeChatFromHistory: (chatId: string) => void;
  
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  
  setWsStatus: (status: EnhancedChatState['wsStatus']) => void;
  setIsTyping: (typing: boolean) => void;
  
  // Enhanced actions
  searchChats: (query: string) => void;
  pinChat: (chatId: string) => void;
  archiveChat: (chatId: string) => void;
  duplicateChat: (chatId: string) => void;
  exportChat: (chatId: string) => void;
  
  // Batch operations
  batchUpdateMessages: (updates: Array<{ id: string; updates: Partial<ChatMessage> }>) => void;
  clearAllChats: () => void;
  
  // Sync operations
  syncWithServer: () => Promise<void>;
  forceSyncNow: () => Promise<void>;
}

const createEnhancedChatStore = () => {
  let syncManager: StoreSync<{ history: ChatSession[] }> | null = null;

  return create<EnhancedChatState>()(
    persist(
      immer(
        withDevMiddleware<EnhancedChatState>((set, get) => {
          // Initialize sync
          const initSync = () => {
            if (!syncManager) {
              const adapter = new LocalStorageAdapter('chat-backup', { history: [] });
              syncManager = new StoreSync(adapter, {
                key: 'chat-history',
                interval: 30000, // 30 seconds
                onError: (error) => {
                  console.error('Chat sync error:', error);
                  set((state) => {
                    state.syncStatus = 'error';
                  });
                }
              });

              syncManager.start((data) => {
                set((state) => {
                  state.chatHistory = data.history;
                  state.syncStatus = 'idle';
                });
              });
            }
          };

          initSync();

          return {
            // Initial state
            currentSession: null,
            chatHistory: [],
            wsStatus: 'disconnected',
            isTyping: false,
            searchQuery: '',
            filteredHistory: [],
            messageCache: new Map(),
            syncStatus: 'idle',

            // Core actions
            setCurrentSession: (session) => {
              set((state) => {
                state.currentSession = session;
              });
              
              storeActionCreator.createAction(
                STORE_ACTIONS.CHAT_SESSION_CREATE,
                { sessionId: session?.id },
                'chatStore'
              );
            },

            setChatHistory: (history) => {
              set((state) => {
                state.chatHistory = history;
                state.filteredHistory = history;
              });

              storeActionCreator.createAction(
                STORE_ACTIONS.CHAT_HISTORY_LOAD,
                { count: history.length },
                'chatStore'
              );
            },

            addChatToHistory: (chat) => {
              set((state) => {
                const existingIndex = state.chatHistory.findIndex(c => c.id === chat.id);
                if (existingIndex >= 0) {
                  state.chatHistory[existingIndex] = chat;
                } else {
                  state.chatHistory.unshift(chat);
                }
                state.filteredHistory = state.chatHistory;
              });

              // Auto-sync to backup
              const history = get().chatHistory;
              syncManager?.saveToSource({ history });
            },

            removeChatFromHistory: (chatId) => {
              set((state) => {
                state.chatHistory = state.chatHistory.filter(c => c.id !== chatId);
                state.filteredHistory = state.chatHistory;
                
                if (state.currentSession?.id === chatId) {
                  state.currentSession = null;
                }
              });
            },

            addMessage: (message) => {
              set((state) => {
                if (state.currentSession) {
                  state.currentSession.messages.push(message);
                  state.messageCache.set(message.id, message);
                }
              });

              storeActionCreator.createAction(
                STORE_ACTIONS.CHAT_MESSAGE_ADD,
                { messageId: message.id, type: message.role },
                'chatStore'
              );
            },

            updateMessage: (messageId, updates) => {
              set((state) => {
                if (state.currentSession) {
                  const messageIndex = state.currentSession.messages.findIndex(m => m.id === messageId);
                  if (messageIndex >= 0) {
                    Object.assign(state.currentSession.messages[messageIndex], updates);
                    state.messageCache.set(messageId, state.currentSession.messages[messageIndex]);
                  }
                }
              });

              storeActionCreator.createAction(
                STORE_ACTIONS.CHAT_MESSAGE_UPDATE,
                { messageId, updates },
                'chatStore'
              );
            },

            clearMessages: () => {
              set((state) => {
                if (state.currentSession) {
                  state.currentSession.messages = [];
                  state.messageCache.clear();
                }
              });
            },

            setWsStatus: (status) => {
              set((state) => {
                state.wsStatus = status;
              });

              storeActionCreator.createAction(
                status === 'connected' ? STORE_ACTIONS.WS_CONNECT : STORE_ACTIONS.WS_DISCONNECT,
                { status },
                'chatStore'
              );
            },

            setIsTyping: (typing) => {
              set((state) => {
                state.isTyping = typing;
              });
            },

            // Enhanced actions
            searchChats: (query) => {
              set((state) => {
                state.searchQuery = query;
                if (!query) {
                  state.filteredHistory = state.chatHistory;
                } else {
                  state.filteredHistory = state.chatHistory.filter(chat => 
                    chat.name.toLowerCase().includes(query.toLowerCase()) ||
                    chat.messages.some(msg => 
                      msg.content.toLowerCase().includes(query.toLowerCase())
                    )
                  );
                }
              });
            },

            pinChat: (chatId) => {
              set((state) => {
                const chat = state.chatHistory.find(c => c.id === chatId);
                if (chat) {
                  chat.isPinned = !chat.isPinned;
                }
              });
            },

            archiveChat: (chatId) => {
              // Implementation for archiving
              console.log(`Archiving chat ${chatId}`);
            },

            duplicateChat: (chatId) => {
              set((state) => {
                const originalChat = state.chatHistory.find(c => c.id === chatId);
                if (originalChat) {
                  const duplicatedChat: ChatSession = {
                    ...originalChat,
                    id: `${originalChat.id}-copy-${Date.now()}`,
                    name: `${originalChat.name} (Copy)`,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  };
                  state.chatHistory.unshift(duplicatedChat);
                  state.filteredHistory = state.chatHistory;
                }
              });
            },

            exportChat: (chatId) => {
              const chat = get().chatHistory.find(c => c.id === chatId);
              if (chat) {
                const dataStr = JSON.stringify(chat, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
                
                const exportFileDefaultName = `chat-${chat.name}-${new Date().toISOString().split('T')[0]}.json`;
                
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();
              }
            },

            batchUpdateMessages: (updates) => {
              set((state) => {
                if (state.currentSession) {
                  updates.forEach(({ id, updates: msgUpdates }) => {
                    const messageIndex = state.currentSession!.messages.findIndex(m => m.id === id);
                    if (messageIndex >= 0) {
                      Object.assign(state.currentSession!.messages[messageIndex], msgUpdates);
                      state.messageCache.set(id, state.currentSession!.messages[messageIndex]);
                    }
                  });
                }
              });
            },

            clearAllChats: () => {
              set((state) => {
                state.chatHistory = [];
                state.filteredHistory = [];
                state.currentSession = null;
                state.messageCache.clear();
              });
            },

            syncWithServer: async () => {
              set((state) => {
                state.syncStatus = 'syncing';
              });

              try {
                // Implementation for server sync
                await new Promise(resolve => setTimeout(resolve, 1000)); // Mock
                
                set((state) => {
                  state.syncStatus = 'idle';
                });
              } catch (error) {
                set((state) => {
                  state.syncStatus = 'error';
                });
                throw error;
              }
            },

            forceSyncNow: async () => {
              if (syncManager) {
                const history = get().chatHistory;
                await syncManager.saveToSource({ history });
              }
            }
          };
        }, 'enhancedChatStore')
      ),
      {
        name: 'enhanced-chat-storage',
        partialize: (state) => ({
          chatHistory: state.chatHistory,
          currentSession: state.currentSession
        })
      }
    )
  );
};

export const useEnhancedChatStore = createEnhancedChatStore();