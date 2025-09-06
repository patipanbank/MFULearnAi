import { useState, useCallback, useEffect } from 'react';
import { useAuthStore, useChatStore, useUIStore } from '../../stores';
import { useWebSocketConnection } from './useWebSocketConnection';
import { useWebSocketMessages } from './useWebSocketMessages';
import { useWebSocketEvents } from './useWebSocketEvents';
import { useWebSocketRoom } from './useWebSocketRoom';
import type { UseWebSocketOptions } from './types/websocket.types';

export const useWebSocket = ({ chatId, isInChatRoom }: UseWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  
  const token = useAuthStore((state) => state.token);
  const wsStatus = useChatStore((state) => state.wsStatus);
  const currentSession = useChatStore((state) => state.currentSession);
  const setWsStatus = useChatStore((state) => state.setWsStatus);
  const setIsConnectedToRoom = useChatStore((state) => state.setIsConnectedToRoom);
  const addToast = useUIStore((state) => state.addToast);

  // Initialize sub-hooks
  const { wsRef, connectWebSocket, isTokenExpired, tryRefreshToken } = useWebSocketConnection({ chatId, isInChatRoom });
  const { pendingQueueRef, sendMessage, processPendingMessages, updateMessage } = useWebSocketMessages({ chatId });
  const { createEventHandlers } = useWebSocketEvents();
  const { pendingFirstRef, handleRoomCreatedEvent, handleRoomJoined, handleJoinRoom } = useWebSocketRoom({ chatId, isInChatRoom });

  // Helper to mark current streaming assistant as aborted
  const abortStreaming = useCallback((reason: string) => {
    const session = currentSession;
    if (!session) return;
    const lastMsg = session.messages[session.messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
      updateMessage(lastMsg.id, {
        content: lastMsg.content + `\n[${reason}]`,
        isStreaming: false,
        isComplete: true,
      });
    }
  }, [currentSession, updateMessage]);

  // Enhanced connectWebSocket that sets up event handlers
  const connectWithHandlers = useCallback(() => {
    const ws = connectWebSocket();
    if (!ws) return;

    const eventHandlers = createEventHandlers();

    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsStatus('connected');
      setIsConnected(true);
      setIsConnectedToRoom(false);
      
      // Handle room joining
      handleJoinRoom(wsRef);
      
      // Process pending messages
      processPendingMessages(wsRef);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket: Received message', data);
        
        // Handle upload progress separately
        if (data.type === 'upload-progress') {
          window.dispatchEvent(new CustomEvent('websocket-message', { 
            detail: event.data 
          }));
          return;
        }

        // Route to appropriate handlers
        switch (data.type) {
          case 'chunk':
            eventHandlers.onChunk?.(data);
            break;
          case 'error':
            console.error('WebSocket: Server error', data.data);
            addToast({
              type: 'error',
              title: 'Server Error',
              message: data.data || 'An error occurred on the server',
              duration: 5000
            });
            break;
          case 'accepted':
            console.log('WebSocket: Message accepted by server', data.data);
            break;
          case 'room_joined':
            handleRoomJoined(data);
            break;
          case 'room_created':
            handleRoomCreatedEvent(data, wsRef);
            break;
          case 'tool_start':
            eventHandlers.onToolStart?.(data);
            break;
          case 'tool_result':
            eventHandlers.onToolResult?.(data);
            break;
          case 'tool_error':
            eventHandlers.onToolError?.(data);
            break;
          case 'assistant_created':
            eventHandlers.onAssistantCreated?.(data);
            break;
          case 'end':
            eventHandlers.onEnd?.(data);
            break;
          default:
            console.debug('WS unhandled event', data);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsStatus('error');
      setIsConnectedToRoom(false);
      abortStreaming('CONNECTION LOST');
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to connect to chat service. Retrying...',
        duration: 5000
      });
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed', event.code, event.reason);
      setWsStatus('disconnected');
      setIsConnected(false);
      setIsConnectedToRoom(false);
      
      if (event.code === 1000) {
        console.log('WebSocket: Normal closure');
      } else if (event.code === 1006) {
        console.log('WebSocket: Abnormal closure - attempting reconnect');
        // Attempt reconnect for abnormal closures
        setTimeout(() => {
          if (token && !isTokenExpired(token)) {
            console.log('WebSocket: Attempting reconnect after abnormal closure');
            connectWithHandlers();
          }
        }, 1000);
      } else {
        console.log('WebSocket: Closure with code', event.code, event.reason);
      }
    };
  }, [
    connectWebSocket, 
    createEventHandlers, 
    handleJoinRoom, 
    processPendingMessages, 
    handleRoomJoined, 
    handleRoomCreatedEvent,
    setWsStatus,
    setIsConnectedToRoom,
    addToast,
    abortStreaming,
    token,
    isTokenExpired,
    wsRef
  ]);

  // Auto-reconnect when disconnected
  useEffect(() => {
    let reconnectTimer: number;
    
    const handleReconnect = async () => {
      if (wsStatus === 'disconnected' && token && currentSession && isInChatRoom) {
        if (isTokenExpired(token)) {
          console.log('Token expired, attempting refresh...');
          const refreshSuccess = await tryRefreshToken();
          if (!refreshSuccess) {
            addToast({
              type: 'warning',
              title: 'Session Expired',
              message: 'Your session has expired. Please log in again to continue chatting.',
              duration: 0
            });
            return;
          }
        }
        
        reconnectTimer = window.setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWithHandlers();
        }, 3000);
      }
    };
    
    handleReconnect();
    
    return () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [wsStatus, token, currentSession, isInChatRoom, isTokenExpired, addToast, connectWithHandlers, tryRefreshToken]);

  // Wrapper for sendMessage
  const wsSendMessage = useCallback((
    message: string, 
    images?: Array<{ url: string; mediaType: string }>, 
    agentId?: string
  ) => {
    sendMessage(wsRef, message, images, agentId);
  }, [sendMessage, wsRef]);

  return {
    wsRef,
    pendingFirstRef,
    pendingQueueRef,
    connectWebSocket: connectWithHandlers,
    abortStreaming,
    isTokenExpired,
    tryRefreshToken,
    sendMessage: wsSendMessage,
    isConnected
  };
};