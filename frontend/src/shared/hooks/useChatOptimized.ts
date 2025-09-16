import { useMemo, useCallback } from 'react';
import { shallow } from 'zustand/shallow';
import { useChatStore, ChatSession, ChatMessage } from '../stores/chatStore';

/**
 * Simple hook for chat history
 */
export const useChatHistory = () => {
  return useChatStore(useCallback((state) => state.chatHistory, []), shallow);
};

/**
 * Simple hook for current chat messages
 */
export const useChatMessages = () => {
  return useChatStore(useCallback((state) => state.currentSession?.messages || [], []), shallow);
};

/**
 * Simple hook for chat actions
 */
export const useChatActions = () => {
  return useChatStore(
    useCallback((state) => ({
      addMessage: state.addMessage,
      updateMessage: state.updateMessage,
      setIsTyping: state.setIsTyping,
      setChatHistory: state.setChatHistory,
    }), []),
    shallow
  );
};

/**
 * Optimized chat hook with memoized selectors to prevent unnecessary re-renders
 */
export const useChatOptimized = () => {
  // Memoized selectors for better performance
  const currentSession = useChatStore(useCallback((state) => state.currentSession, []));
  const wsStatus = useChatStore(useCallback((state) => state.wsStatus, []));
  const isTyping = useChatStore(useCallback((state) => state.isTyping, []));
  const isConnectedToRoom = useChatStore(useCallback((state) => state.isConnectedToRoom, []));

  // Actions (stable references)
  const actions = useChatStore(
    useCallback((state) => ({
      addMessage: state.addMessage,
      updateMessage: state.updateMessage,
      clearMessages: state.clearMessages,
      setIsTyping: state.setIsTyping,
      setWsStatus: state.setWsStatus,
      setIsConnectedToRoom: state.setIsConnectedToRoom,
      createNewChat: state.createNewChat,
      loadChat: state.loadChat,
      saveChat: state.saveChat,
    }), []),
    shallow
  );

  // Memoized derived state
  const derivedState = useMemo(() => ({
    hasMessages: (currentSession?.messages.length ?? 0) > 0,
    lastMessage: currentSession?.messages[currentSession.messages.length - 1] || null,
    isConnected: wsStatus === 'connected',
    canSendMessage: wsStatus === 'connected' && isConnectedToRoom && !isTyping,
  }), [currentSession, wsStatus, isConnectedToRoom, isTyping]);

  return {
    currentSession,
    wsStatus,
    isTyping,
    isConnectedToRoom,
    ...derivedState,
    ...actions,
  };
};

/**
 * Optimized chat history hook with pagination and filtering
 */
export const useChatHistoryOptimized = (filters?: {
  search?: string;
  isPinned?: boolean;
  limit?: number;
}) => {
  const chatHistory = useChatStore(useCallback((state) => state.chatHistory, []));
  const loadingStates = useChatStore(useCallback((state) => state.loadingStates, []));
  const errors = useChatStore(useCallback((state) => state.errors, []));

  // Actions
  const actions = useChatStore(
    useCallback((state) => ({
      fetchChatHistory: state.fetchChatHistory,
      deleteChat: state.deleteChat,
      pinChat: state.pinChat,
      preloadChat: state.preloadChat,
    }), []),
    shallow
  );

  // Memoized filtered and sorted chat history
  const filteredHistory = useMemo(() => {
    let filtered = [...chatHistory];

    // Apply filters
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(chat =>
        chat.name.toLowerCase().includes(searchLower) ||
        chat.messages.some(msg =>
          msg.content.toLowerCase().includes(searchLower)
        )
      );
    }

    if (filters?.isPinned !== undefined) {
      filtered = filtered.filter(chat =>
        Boolean(chat.isPinned) === filters.isPinned
      );
    }

    // Sort: pinned first, then by updatedAt
    filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // Apply limit
    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }, [chatHistory, filters]);

  // Memoized stats
  const stats = useMemo(() => ({
    total: chatHistory.length,
    pinned: chatHistory.filter(chat => chat.isPinned).length,
    withMessages: chatHistory.filter(chat => chat.messages.length > 0).length,
    filtered: filteredHistory.length,
  }), [chatHistory, filteredHistory]);

  return {
    chatHistory: filteredHistory,
    stats,
    isLoading: loadingStates.fetchingHistory,
    error: errors.fetchHistory,
    ...actions,
  };
};

/**
 * Chat messages hook with virtual scrolling support
 */
export const useChatMessagesOptimized = (chatId?: string) => {
  const currentSession = useChatStore(useCallback((state) =>
    chatId ? state.chatHistory.find(c => c.id === chatId) : state.currentSession
  , [chatId]));

  const actions = useChatStore(
    useCallback((state) => ({
      addMessage: state.addMessage,
      updateMessage: state.updateMessage,
      clearMessages: state.clearMessages,
    }), []),
    shallow
  );

  // Memoized message processing
  const processedMessages = useMemo(() => {
    if (!currentSession?.messages) return [];

    return currentSession.messages.map((message, index) => ({
      ...message,
      isLast: index === currentSession.messages.length - 1,
      isFirst: index === 0,
      groupedWithNext: index < currentSession.messages.length - 1 &&
        currentSession.messages[index + 1].role === message.role &&
        new Date(currentSession.messages[index + 1].timestamp).getTime() -
        new Date(message.timestamp).getTime() < 5 * 60 * 1000, // 5 minutes
    }));
  }, [currentSession?.messages]);

  // Pagination for virtual scrolling
  const useMessagePagination = useCallback((pageSize: number = 50) => {
    return useMemo(() => {
      const totalPages = Math.ceil(processedMessages.length / pageSize);

      return {
        totalPages,
        totalMessages: processedMessages.length,
        getPage: (page: number) => {
          const start = page * pageSize;
          const end = start + pageSize;
          return processedMessages.slice(start, end);
        }
      };
    }, [processedMessages, pageSize]);
  }, [processedMessages]);

  return {
    messages: processedMessages,
    messageCount: processedMessages.length,
    hasMessages: processedMessages.length > 0,
    lastMessage: processedMessages[processedMessages.length - 1] || null,
    useMessagePagination,
    ...actions,
  };
};

/**
 * Loading states hook for granular loading management
 */
export const useLoadingStates = () => {
  const loadingStates = useChatStore(useCallback((state) => state.loadingStates, []));
  const isLoading = useChatStore(useCallback((state) => state.isLoading, []));

  const setLoadingState = useChatStore(useCallback((state) => state.setLoadingState, []));

  const combinedLoading = useMemo(() => ({
    ...loadingStates,
    global: isLoading,
    any: Object.values(loadingStates).some(Boolean) || isLoading,
  }), [loadingStates, isLoading]);

  return {
    loading: combinedLoading,
    setLoadingState,
  };
};

/**
 * Error handling hook with auto-clear functionality
 */
export const useErrorHandling = () => {
  const errors = useChatStore(useCallback((state) => state.errors, []));
  const setError = useChatStore(useCallback((state) => state.setError, []));
  const clearErrors = useChatStore(useCallback((state) => state.clearErrors, []));

  // Auto-clear errors after timeout
  const setErrorWithTimeout = useCallback((
    key: keyof typeof errors,
    error: string | null,
    timeout = 5000
  ) => {
    setError(key, error);

    if (error && timeout > 0) {
      setTimeout(() => {
        setError(key, null);
      }, timeout);
    }
  }, [setError]);

  const hasErrors = useMemo(() =>
    Object.values(errors).some(error => error !== null)
  , [errors]);

  return {
    errors,
    hasErrors,
    setError,
    setErrorWithTimeout,
    clearErrors,
  };
};

/**
 * WebSocket connection hook with auto-reconnect
 */
export const useWebSocketOptimized = () => {
  const wsStatus = useChatStore(useCallback((state) => state.wsStatus, []));
  const isConnectedToRoom = useChatStore(useCallback((state) => state.isConnectedToRoom, []));
  const isRoomCreating = useChatStore(useCallback((state) => state.isRoomCreating, []));

  const actions = useChatStore(
    useCallback((state) => ({
      setWsStatus: state.setWsStatus,
      setIsConnectedToRoom: state.setIsConnectedToRoom,
      setIsRoomCreating: state.setIsRoomCreating,
    }), []),
    shallow
  );

  const connectionState = useMemo(() => ({
    isConnected: wsStatus === 'connected',
    isConnecting: wsStatus === 'connecting',
    isDisconnected: wsStatus === 'disconnected',
    hasError: wsStatus === 'error',
    canSendMessages: wsStatus === 'connected' && isConnectedToRoom,
    isReady: wsStatus === 'connected' && isConnectedToRoom && !isRoomCreating,
  }), [wsStatus, isConnectedToRoom, isRoomCreating]);

  return {
    wsStatus,
    isConnectedToRoom,
    isRoomCreating,
    ...connectionState,
    ...actions,
  };
};