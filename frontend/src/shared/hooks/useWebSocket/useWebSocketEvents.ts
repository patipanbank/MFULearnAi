import React, { useCallback, useRef } from 'react';
import { useChatStore } from '../../stores';
import type { ChatMessage } from '../../stores/chatStore';
import type { WebSocketEventHandlers } from './types/websocket.types';

export const useWebSocketEvents = () => {
  const currentSessionRef = useRef<any>(null);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const currentSession = useChatStore((state) => state.currentSession);

  // Keep current session ref updated
  React.useLayoutEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  const handleChunk = useCallback((data: any) => {
    const session = currentSessionRef.current;
    if (!session) return;

    // New format: { data: { messageId, delta } }
    if (data?.data && typeof data.data === 'object' && data.data.messageId) {
      const { messageId, delta } = data.data as { messageId: string; delta?: string };
      const target = session.messages.find((m: any) => m.id === messageId);
      if (target) {
        updateMessage(messageId, {
          content: (target.content || '') + (delta || '')
        });
      } else {
        console.log('Chunk received but target message not found, waiting assistant_created...');
      }
      return;
    }

    // Legacy fallback
    const lastMessage = session.messages[session.messages.length - 1];
    let chunkText = '';
    if (typeof data.data === 'string') {
      chunkText = data.data;
    } else if (typeof data.data === 'object' && data.data !== null) {
      chunkText = data.data.delta || data.data.chunk || data.data.fullContent || '';
    } else {
      chunkText = String(data.data ?? '');
    }

    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
      updateMessage(lastMessage.id, { content: lastMessage.content + chunkText });
    } else {
      console.log('Waiting for backend to create assistant message...');
    }
  }, [updateMessage]);

  const handleToolStart = useCallback((data: any) => {
    console.log('WebSocket: Tool started', data.data);
    const session = currentSessionRef.current;
    const lastMessage = session?.messages[session.messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      // Add tool usage to message
      let toolInput = '';
      if (typeof data.data.tool_input === 'string') {
        toolInput = data.data.tool_input;
      } else if (typeof data.data.tool_input === 'object') {
        toolInput = JSON.stringify(data.data.tool_input);
      }
      
      const toolInfo = {
        type: 'tool_start' as const,
        tool_name: data.data.tool_name as string,
        tool_input: toolInput,
        timestamp: new Date()
      };
      updateMessage(lastMessage.id, {
        toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
      });
    }
  }, [updateMessage]);

  const handleToolResult = useCallback((data: any) => {
    console.log('WebSocket: Tool result', data.data);
    const session = currentSessionRef.current;
    const lastMessage = session?.messages[session.messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      const toolInfo = {
        type: 'tool_result' as const,
        tool_name: data.data.tool_name as string,
        output: data.data.output as string,
        timestamp: new Date()
      };
      updateMessage(lastMessage.id, {
        toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
      });
    }
  }, [updateMessage]);

  const handleToolError = useCallback((data: any) => {
    console.log('WebSocket: Tool error', data.data);
    const session = currentSessionRef.current;
    const lastMessage = session?.messages[session.messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      const toolInfo = {
        type: 'tool_error' as const,
        tool_name: data.data.tool_name as string,
        error: data.data.error as string,
        timestamp: new Date()
      };
      updateMessage(lastMessage.id, {
        toolUsage: [...(lastMessage.toolUsage || []), toolInfo]
      });
    }
  }, [updateMessage]);

  const handleAssistantCreated = useCallback((data: any) => {
    console.log('WebSocket: Assistant message created', data.data);
    const assistantMsg: ChatMessage = {
      id: data.data.messageId,
      role: 'assistant',
      content: data.data.content,
      timestamp: new Date(),
      isStreaming: true,
      isComplete: false
    };
    addMessage(assistantMsg);
  }, [addMessage]);

  const handleEnd = useCallback((data: any) => {
    console.log('WebSocket: Message ended');
    const session = currentSessionRef.current;
    if (!session) return;
    
    const messageId = data?.data?.messageId as string | undefined;
    if (messageId) {
      updateMessage(messageId, { isComplete: true, isStreaming: false });
    } else {
      // Legacy fallback: mark last assistant as complete
      const lastMessage = session.messages[session.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        updateMessage(lastMessage.id, { isComplete: true, isStreaming: false });
      }
    }
    
    const setIsTyping = useChatStore.getState().setIsTyping;
    setIsTyping(false);
  }, [updateMessage]);

  const createEventHandlers = useCallback((): WebSocketEventHandlers => ({
    onChunk: handleChunk,
    onToolStart: handleToolStart,
    onToolResult: handleToolResult,
    onToolError: handleToolError,
    onAssistantCreated: handleAssistantCreated,
    onEnd: handleEnd,
  }), [handleChunk, handleToolStart, handleToolResult, handleToolError, handleAssistantCreated, handleEnd]);

  return {
    createEventHandlers
  };
};