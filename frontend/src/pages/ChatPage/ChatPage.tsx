/**
 * ChatPage - Simple and Clean Chat Interface
 *
 * Using new LangGraph WebSocket hook
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChatStore, useAgentStore, useUIStore, useAuthStore } from '../../shared/stores';
import { useLangGraphWebSocket } from '../../shared/hooks/useLangGraphWebSocket';
import Loading from '../../shared/ui/Loading';
import WelcomeScreen from './components/WelcomeScreen';

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();

  // Auth
  const token = useAuthStore((state) => state.token);

  // Chat state
  const currentSession = useChatStore((state) => state.currentSession);
  const loadChat = useChatStore((state) => state.loadChat);
  const createNewChat = useChatStore((state) => state.createNewChat);
  const fetchChatHistory = useChatStore((state) => state.fetchChatHistory);
  const wsStatus = useChatStore((state) => state.wsStatus);
  const isLoading = useChatStore((state) => state.isLoading);

  // Agent state
  const selectedAgent = useAgentStore((state) => state.selectedAgent);
  const fetchAgents = useAgentStore((state) => state.fetchAgents);

  // UI state
  const addToast = useUIStore((state) => state.addToast);

  // Local state
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<Array<{ url: string; mediaType: string }>>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // WebSocket connection
  const { isConnected, isConnectedToRoom, sendChatMessage } = useLangGraphWebSocket({
    chatId,
    enabled: !!token
  });

  // Initialize data
  useEffect(() => {
    if (!token || isInitialized) return;

    const initialize = async () => {
      try {
        // Fetch agents
        await fetchAgents();

        // Fetch chat history
        await fetchChatHistory();

        // Load specific chat if chatId provided
        if (chatId) {
          const success = await loadChat(chatId);
          if (!success) {
            addToast({
              type: 'error',
              title: 'Chat Not Found',
              message: 'The requested chat could not be loaded',
              duration: 5000
            });
            navigate('/chat');
            return;
          }
        } else {
          // Create new chat if no chatId
          createNewChat();
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize chat page:', error);
        addToast({
          type: 'error',
          title: 'Initialization Error',
          message: 'Failed to load chat data',
          duration: 5000
        });
      }
    };

    initialize();
  }, [token, chatId, isInitialized, fetchAgents, fetchChatHistory, loadChat, createNewChat, addToast, navigate]);

  // Handle send message
  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || !selectedAgent) {
      addToast({
        type: 'warning',
        title: 'Invalid Input',
        message: 'Please enter a message and select an agent',
        duration: 3000
      });
      return;
    }

    if (!isConnected) {
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Not connected to chat service',
        duration: 3000
      });
      return;
    }

    // If no chatId, we need to create a new chat first
    if (!chatId) {
      // For new chats, navigate to a new chat URL
      const newChatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      navigate(`/chat/${newChatId}`, { replace: true });

      // The message will be sent after navigation and room join
      // Store it temporarily
      setTimeout(() => {
        sendChatMessage(message, images, selectedAgent.id);
        setMessage('');
        setImages([]);
      }, 500);
      return;
    }

    // Send message to existing chat
    const success = sendChatMessage(message, images, selectedAgent.id);
    if (success) {
      setMessage('');
      setImages([]);
    }
  }, [message, images, selectedAgent, isConnected, chatId, sendChatMessage, addToast, navigate]);

  // Handle enter key
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Show loading if not initialized
  if (!isInitialized) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  // Check if we have messages
  const hasMessages = (currentSession?.messages.length || 0) > 0;

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {currentSession?.name || 'New Chat'}
            </h1>
            {selectedAgent && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Agent: {selectedAgent.name}
              </p>
            )}
          </div>

          {/* Connection status */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              wsStatus === 'connected' ? 'bg-green-500' :
              wsStatus === 'connecting' ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {wsStatus === 'connected' && isConnectedToRoom ? 'Connected' :
               wsStatus === 'connected' ? 'Joining...' :
               wsStatus === 'connecting' ? 'Connecting...' :
               'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {hasMessages ? (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {currentSession?.messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.isStreaming && (
                    <div className="mt-2 text-xs opacity-70">Typing...</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <WelcomeScreen />
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                !selectedAgent ? "Please select an agent first..." :
                !isConnected ? "Connecting..." :
                "Type your message..."
              }
              disabled={!isConnected || !selectedAgent || isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                        focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              rows={1}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || !isConnected || !selectedAgent || isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors duration-200"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;