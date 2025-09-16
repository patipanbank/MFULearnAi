import { QueryClient, DefaultOptions } from '@tanstack/react-query';
import { api } from './api';

// Default query options for consistent behavior
const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors except 408 (timeout)
      if (error?.status >= 400 && error?.status < 500 && error?.status !== 408) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  },
  mutations: {
    retry: 1,
    onError: (error: any) => {
      console.error('Mutation error:', error);
      // Could add toast notification here
    },
  },
};

// Create query client with optimized settings
export const queryClient = new QueryClient({
  defaultOptions,
});

// Query keys factory for consistent key management
export const queryKeys = {
  // Chat related
  chats: {
    all: ['chats'] as const,
    lists: () => [...queryKeys.chats.all, 'list'] as const,
    list: (userId: string) => [...queryKeys.chats.lists(), userId] as const,
    details: () => [...queryKeys.chats.all, 'detail'] as const,
    detail: (chatId: string) => [...queryKeys.chats.details(), chatId] as const,
    history: (chatId: string) => [...queryKeys.chats.detail(chatId), 'history'] as const,
  },

  // Agent related
  agents: {
    all: ['agents'] as const,
    lists: () => [...queryKeys.agents.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.agents.lists(), filters] as const,
    details: () => [...queryKeys.agents.all, 'detail'] as const,
    detail: (agentId: string) => [...queryKeys.agents.details(), agentId] as const,
  },

  // User related
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    settings: () => [...queryKeys.user.all, 'settings'] as const,
  },

  // Collections related
  collections: {
    all: ['collections'] as const,
    lists: () => [...queryKeys.collections.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.collections.lists(), filters] as const,
    details: () => [...queryKeys.collections.all, 'detail'] as const,
    detail: (collectionId: string) => [...queryKeys.collections.details(), collectionId] as const,
  },
};

// Optimistic update helpers
export const optimisticUpdates = {
  // Update chat list optimistically
  updateChatList: (userId: string, updateFn: (oldData: any) => any) => {
    queryClient.setQueryData(queryKeys.chats.list(userId), updateFn);
  },

  // Revert optimistic update
  revertChatList: (userId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.chats.list(userId) });
  },

  // Add new chat optimistically
  addChatOptimistic: (userId: string, newChat: any) => {
    queryClient.setQueryData(queryKeys.chats.list(userId), (oldData: any) => {
      if (!oldData) return [newChat];
      return [newChat, ...oldData];
    });
  },

  // Update single chat optimistically
  updateChatOptimistic: (chatId: string, updates: any) => {
    queryClient.setQueryData(queryKeys.chats.detail(chatId), (oldData: any) => {
      if (!oldData) return null;
      return { ...oldData, ...updates };
    });

    // Also update in list if present
    queryClient.setQueriesData(
      { queryKey: queryKeys.chats.lists(), exact: false },
      (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((chat: any) =>
          chat.id === chatId ? { ...chat, ...updates } : chat
        );
      }
    );
  },

  // Remove chat optimistically
  removeChatOptimistic: (userId: string, chatId: string) => {
    queryClient.setQueryData(queryKeys.chats.list(userId), (oldData: any) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData.filter((chat: any) => chat.id !== chatId);
    });

    // Remove from cache
    queryClient.removeQueries({ queryKey: queryKeys.chats.detail(chatId) });
  },
};

// Cache management utilities
export const cacheManager = {
  // Prefetch chat list for better UX
  prefetchChatList: async (userId: string) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.chats.list(userId),
      queryFn: () => api.get('/chat/history'),
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  },

  // Prefetch single chat
  prefetchChat: async (chatId: string) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.chats.detail(chatId),
      queryFn: () => api.get(`/chat/history/${chatId}`),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  },

  // Invalidate all chat data
  invalidateChats: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
  },

  // Clear specific chat from cache
  removeChatFromCache: (chatId: string) => {
    queryClient.removeQueries({ queryKey: queryKeys.chats.detail(chatId) });
  },

  // Get cache status
  getCacheStatus: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    return {
      totalQueries: queries.length,
      fresh: queries.filter(q => q.state.dataUpdatedAt > Date.now() - (q.options.staleTime || 0)).length,
      stale: queries.filter(q => q.state.dataUpdatedAt <= Date.now() - (q.options.staleTime || 0)).length,
      error: queries.filter(q => q.state.status === 'error').length,
      loading: queries.filter(q => q.state.status === 'pending').length,
      memoryUsage: cache.getAll().reduce((acc, query) => {
        return acc + (JSON.stringify(query.state.data).length || 0);
      }, 0),
    };
  },

  // Cleanup stale data
  cleanup: () => {
    queryClient.clear();
  },

  // Background refetch for active queries
  refetchActive: () => {
    queryClient.refetchQueries({ type: 'active' });
  },
};

// Error handling
export const errorHandler = {
  isNetworkError: (error: any) => {
    return !error?.status || error?.name === 'NetworkError';
  },

  isAuthError: (error: any) => {
    return error?.status === 401 || error?.status === 403;
  },

  shouldRetry: (error: any, failureCount: number) => {
    if (errorHandler.isAuthError(error)) return false;
    if (failureCount >= 3) return false;
    if (errorHandler.isNetworkError(error)) return true;
    return error?.status >= 500;
  },

  getErrorMessage: (error: any) => {
    if (errorHandler.isNetworkError(error)) {
      return 'Network connection error. Please check your internet connection.';
    }

    if (errorHandler.isAuthError(error)) {
      return 'Authentication error. Please sign in again.';
    }

    return error?.message || 'An unexpected error occurred.';
  },
};

// Performance monitoring for queries
export const queryPerformance = {
  logSlowQueries: (threshold = 1000) => {
    queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event.query.state.dataUpdatedAt) {
        const duration = Date.now() - event.query.state.dataUpdateCount;
        if (duration > threshold) {
          console.warn(`🐌 Slow query detected: ${JSON.stringify(event.query.queryKey)} took ${duration}ms`);
        }
      }
    });
  },

  getSlowQueries: (threshold = 1000) => {
    return queryClient.getQueryCache().getAll()
      .filter(query => {
        const lastFetch = query.state.dataUpdatedAt;
        const fetchDuration = query.state.fetchStatus === 'fetching'
          ? Date.now() - (lastFetch || 0)
          : 0;
        return fetchDuration > threshold;
      })
      .map(query => ({
        key: query.queryKey,
        duration: Date.now() - (query.state.dataUpdatedAt || 0),
        status: query.state.status,
      }));
  },
};

// Initialize performance monitoring in development
if (process.env.NODE_ENV === 'development') {
  queryPerformance.logSlowQueries(500); // 500ms threshold in dev
}

export default queryClient;