import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys, optimisticUpdates, cacheManager } from '../lib/queryClient';
import { ChatSession, ChatMessage } from '../stores/chatStore';
import { chatCache, cacheUtils } from '../lib/stateCache';

// Types
interface ChatListResponse {
  chats: ChatSession[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

interface SendMessageRequest {
  content: string;
  chatId: string;
  agentId?: string;
  files?: File[];
}

/**
 * Hook for fetching chat list with caching and pagination
 */
export const useChatList = (userId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.chats.list(userId),
    queryFn: async (): Promise<ChatSession[]> => {
      // Check cache first
      const cached = cacheUtils.getCachedChats(userId);
      if (cached && !options?.enabled) {
        return cached;
      }

      const response = await api.get<ChatSession[]>('/chat/history');

      // Cache the response
      cacheUtils.cacheChats(response, userId);

      return response;
    },
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000, // 2 minutes
    select: (data: ChatSession[]) => {
      // Sort: pinned first, then by updatedAt
      return data.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    },
  });
};

/**
 * Hook for fetching single chat with messages
 */
export const useChat = (chatId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.chats.detail(chatId),
    queryFn: async (): Promise<ChatSession> => {
      const response = await api.get<ChatSession>(`/chat/history/${chatId}`);

      // Cache messages individually for quick access
      if (response.messages) {
        cacheUtils.cacheMessages(response.messages);
      }

      return response;
    },
    enabled: (options?.enabled ?? true) && !!chatId,
    staleTime: 30 * 1000, // 30 seconds for active chat
    select: (data: ChatSession) => ({
      ...data,
      messages: data.messages?.map((msg, index) => ({
        ...msg,
        isLast: index === data.messages.length - 1,
        timestamp: new Date(msg.timestamp),
      })) || [],
    }),
  });
};

/**
 * Hook for infinite loading of chat messages (for long conversations)
 */
export const useChatMessages = (chatId: string, pageSize = 50) => {
  return useInfiniteQuery({
    queryKey: [...queryKeys.chats.detail(chatId), 'messages'],
    queryFn: async ({ pageParam = 0 }): Promise<{ messages: ChatMessage[]; nextCursor?: number }> => {
      const response = await api.get<{ messages: ChatMessage[]; total: number }>(
        `/chat/${chatId}/messages?offset=${pageParam}&limit=${pageSize}`
      );

      const hasMore = response.messages.length === pageSize;
      const nextCursor = hasMore ? pageParam + pageSize : undefined;

      return {
        messages: response.messages,
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!chatId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for creating new chat
 */
export const useCreateChat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name?: string; agentId?: string }): Promise<ChatSession> => {
      return api.post('/chat', data);
    },
    onSuccess: (newChat, variables) => {
      // Add to cache optimistically
      optimisticUpdates.addChatOptimistic('current-user', newChat);

      // Invalidate chat list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.lists() });
    },
    onError: (error, variables) => {
      console.error('Failed to create chat:', error);
      // Could add toast notification here
    },
  });
};

/**
 * Hook for sending messages
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SendMessageRequest): Promise<ChatMessage> => {
      const formData = new FormData();
      formData.append('content', data.content);
      formData.append('chatId', data.chatId);

      if (data.agentId) {
        formData.append('agentId', data.agentId);
      }

      if (data.files) {
        data.files.forEach((file, index) => {
          formData.append(`file_${index}`, file);
        });
      }

      return api.post('/chat/message', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
    onMutate: async (variables) => {
      // Create optimistic message
      const optimisticMessage: ChatMessage = {
        id: `temp_${Date.now()}`,
        role: 'user',
        content: variables.content,
        timestamp: new Date(),
        isStreaming: false,
        isComplete: false,
      };

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.chats.detail(variables.chatId) });

      // Snapshot previous value
      const previousChat = queryClient.getQueryData(queryKeys.chats.detail(variables.chatId));

      // Optimistically update
      queryClient.setQueryData(queryKeys.chats.detail(variables.chatId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          messages: [...(old.messages || []), optimisticMessage],
          updatedAt: new Date(),
        };
      });

      return { previousChat, optimisticMessage };
    },
    onError: (error, variables, context) => {
      // Revert optimistic update
      if (context?.previousChat) {
        queryClient.setQueryData(queryKeys.chats.detail(variables.chatId), context.previousChat);
      }
    },
    onSuccess: (data, variables) => {
      // Update chat list to reflect new message
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.lists() });
    },
    onSettled: (data, error, variables) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.detail(variables.chatId) });
    },
  });
};

/**
 * Hook for deleting chat
 */
export const useDeleteChat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatId: string): Promise<void> => {
      await api.delete(`/chat/${chatId}`);
    },
    onMutate: async (chatId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.chats.lists() });

      // Snapshot previous value
      const previousChats = queryClient.getQueryData(queryKeys.chats.list('current-user'));

      // Optimistically remove chat
      optimisticUpdates.removeChatOptimistic('current-user', chatId);

      return { previousChats };
    },
    onError: (error, chatId, context) => {
      // Revert optimistic update
      if (context?.previousChats) {
        queryClient.setQueryData(queryKeys.chats.list('current-user'), context.previousChats);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.lists() });
    },
  });
};

/**
 * Hook for pinning/unpinning chat
 */
export const usePinChat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId, isPinned }: { chatId: string; isPinned: boolean }): Promise<void> => {
      await api.post(`/chat/${chatId}/pin`, { isPinned });
    },
    onMutate: async ({ chatId, isPinned }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.chats.lists() });

      // Snapshot previous value
      const previousChats = queryClient.getQueryData(queryKeys.chats.list('current-user'));

      // Optimistically update
      optimisticUpdates.updateChatOptimistic(chatId, { isPinned });

      return { previousChats };
    },
    onError: (error, { chatId }, context) => {
      // Revert optimistic update
      if (context?.previousChats) {
        queryClient.setQueryData(queryKeys.chats.list('current-user'), context.previousChats);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.lists() });
    },
  });
};

/**
 * Hook for updating chat name
 */
export const useUpdateChatName = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId, name }: { chatId: string; name: string }): Promise<void> => {
      await api.put(`/chat/${chatId}/name`, { name });
    },
    onMutate: async ({ chatId, name }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.chats.detail(chatId) });

      // Snapshot previous value
      const previousChat = queryClient.getQueryData(queryKeys.chats.detail(chatId));

      // Optimistically update
      optimisticUpdates.updateChatOptimistic(chatId, { name });

      return { previousChat };
    },
    onError: (error, { chatId }, context) => {
      // Revert optimistic update
      if (context?.previousChat) {
        queryClient.setQueryData(queryKeys.chats.detail(chatId), context.previousChat);
      }
    },
    onSettled: (data, error, { chatId }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.detail(chatId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.lists() });
    },
  });
};

/**
 * Hook for prefetching chat data
 */
export const usePrefetchChat = () => {
  const queryClient = useQueryClient();

  return {
    prefetchChat: (chatId: string) => {
      return cacheManager.prefetchChat(chatId);
    },
    prefetchChatList: (userId: string) => {
      return cacheManager.prefetchChatList(userId);
    },
    invalidateChats: () => {
      return cacheManager.invalidateChats();
    },
  };
};

/**
 * Hook for chat search
 */
export const useChatSearch = (query: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['chat-search', query],
    queryFn: async (): Promise<ChatSession[]> => {
      if (!query.trim()) return [];

      const response = await api.get<ChatSession[]>(`/chat/search?q=${encodeURIComponent(query)}`);
      return response;
    },
    enabled: (options?.enabled ?? true) && query.length > 2,
    staleTime: 30 * 1000, // 30 seconds
    placeholderData: [],
  });
};

/**
 * Hook for real-time chat updates via WebSocket
 */
export const useChatRealtime = (chatId: string) => {
  const queryClient = useQueryClient();

  // This would integrate with WebSocket for real-time updates
  // For now, it's a placeholder that polls for updates
  return useQuery({
    queryKey: [...queryKeys.chats.detail(chatId), 'realtime'],
    queryFn: async () => {
      // In a real implementation, this would be handled by WebSocket
      return null;
    },
    enabled: false, // Disabled as WebSocket handles real-time updates
    refetchInterval: 30 * 1000, // Fallback polling every 30 seconds
  });
};