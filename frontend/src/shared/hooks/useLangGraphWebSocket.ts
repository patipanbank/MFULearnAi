/**
 * LangGraph WebSocket Hook
 *
 * Simple and clean WebSocket hook for LangGraph backend
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useAuthStore, useChatStore, useUIStore } from '../stores';
import { config } from '../../config/config';

interface UseLangGraphWebSocketProps {
  chatId?: string;
  enabled?: boolean;
}

interface LangGraphMessage {
  type: string;
  chatId?: string;
  text?: string;
  images?: Array<{ url: string; mediaType: string }>;
  agent_id?: string;
  [key: string]: any;
}

export const useLangGraphWebSocket = ({ chatId, enabled = true }: UseLangGraphWebSocketProps) => {
  const token = useAuthStore((state) => state.token);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const setWsStatus = useChatStore((state) => state.setWsStatus);
  const addToast = useUIStore((state) => state.addToast);

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnectedToRoom, setIsConnectedToRoom] = useState(false);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!token || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('🔌 Connecting to LangGraph WebSocket...');
    setWsStatus('connecting');

    let wsUrl = `${config.wsUrl}?token=${token}`;
    if (window.location.hostname === 'localhost') {
      wsUrl = `ws://localhost/ws?token=${token}`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ LangGraph WebSocket connected');
        setWsStatus('connected');
        setIsConnected(true);

        // Auto-join room if chatId provided
        if (chatId) {
          joinRoom(chatId);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 LangGraph message:', data);
          handleMessage(data);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ LangGraph WebSocket error:', error);
        setWsStatus('error');
        setIsConnected(false);
        setIsConnectedToRoom(false);
      };

      ws.onclose = (event) => {
        console.log('👋 LangGraph WebSocket closed:', event.code);
        setWsStatus('disconnected');
        setIsConnected(false);
        setIsConnectedToRoom(false);

        // Auto-reconnect after 3 seconds if not normal closure
        if (event.code !== 1000 && enabled) {
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connect();
          }, 3000);
        }
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      setWsStatus('error');
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to connect to chat service',
        duration: 5000
      });
    }
  }, [token, enabled, chatId, setWsStatus, addToast]);

  // Handle incoming messages
  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'connected':
        console.log('🎉 Connected to LangGraph service');
        break;

      case 'accepted':
        console.log('✅ Message accepted:', data.data);
        break;

      case 'room_joined':
        console.log('🚪 Joined room:', data.data.chatId);
        setIsConnectedToRoom(true);
        break;

      case 'message_added':
        console.log('➕ Message added:', data.data.message);
        const newMessage = {
          id: data.data.message.id,
          role: data.data.message.role as 'user' | 'assistant',
          content: data.data.message.content,
          timestamp: new Date(data.data.message.timestamp),
          images: data.data.message.images,
          isStreaming: data.data.message.isStreaming || false,
          isComplete: data.data.message.isComplete || false
        };
        addMessage(newMessage);
        break;

      case 'message_updated':
        console.log('🔄 Message updated:', data.data);
        updateMessage(data.data.messageId, {
          content: data.data.content,
          isStreaming: data.data.isStreaming || false
        });
        break;

      case 'message_completed':
        console.log('✅ Message completed:', data.data);
        updateMessage(data.data.messageId, {
          content: data.data.content,
          isStreaming: false,
          isComplete: true
        });
        break;

      case 'message_error':
        console.error('❌ Message error:', data.data);
        updateMessage(data.data.messageId, {
          content: `[Error: ${data.data.error}]`,
          isStreaming: false,
          isComplete: true
        });
        addToast({
          type: 'error',
          title: 'Message Error',
          message: data.data.error,
          duration: 5000
        });
        break;

      case 'error':
        console.error('❌ Server error:', data.data);
        addToast({
          type: 'error',
          title: 'Server Error',
          message: data.data,
          duration: 5000
        });
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.warn('⚠️ Unknown message type:', data.type);
    }
  }, [addMessage, updateMessage, addToast]);

  // Send message to WebSocket
  const sendMessage = useCallback((message: LangGraphMessage) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket not connected');
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Not connected to chat service. Trying to reconnect...',
        duration: 3000
      });
      connect();
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify(message));
      console.log('📤 Sent message:', message);
      return true;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      addToast({
        type: 'error',
        title: 'Send Error',
        message: 'Failed to send message',
        duration: 3000
      });
      return false;
    }
  }, [connect, addToast]);

  // Join a chat room
  const joinRoom = useCallback((roomId: string) => {
    return sendMessage({
      type: 'join_room',
      chatId: roomId
    });
  }, [sendMessage]);

  // Send a chat message
  const sendChatMessage = useCallback((
    text: string,
    images?: Array<{ url: string; mediaType: string }>,
    agentId?: string
  ) => {
    if (!chatId) {
      console.error('❌ No chat ID provided');
      return false;
    }

    return sendMessage({
      type: 'message',
      chatId,
      text,
      images,
      agent_id: agentId
    });
  }, [chatId, sendMessage]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnectedToRoom(false);
  }, []);

  // Auto-connect when token and enabled change
  useEffect(() => {
    if (enabled && token) {
      connect();
    } else {
      disconnect();
    }

    return () => disconnect();
  }, [enabled, token, connect, disconnect]);

  // Auto-join room when chatId changes
  useEffect(() => {
    if (isConnected && chatId && !isConnectedToRoom) {
      joinRoom(chatId);
    }
  }, [isConnected, chatId, isConnectedToRoom, joinRoom]);

  return {
    isConnected,
    isConnectedToRoom,
    connect,
    disconnect,
    sendMessage,
    sendChatMessage,
    joinRoom
  };
};