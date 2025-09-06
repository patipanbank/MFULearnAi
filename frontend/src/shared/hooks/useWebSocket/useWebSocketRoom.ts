import React, { useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../stores';
import type { PendingFirstMessage } from './types/websocket.types';

export const useWebSocketRoom = ({ chatId, isInChatRoom }: { chatId?: string; isInChatRoom: boolean }) => {
  const navigate = useNavigate();
  const pendingFirstRef = useRef<PendingFirstMessage | null>(null);
  const currentSessionRef = useRef<any>(null);
  const chatHistoryRef = useRef<any[]>([]);

  const currentSession = useChatStore((state) => state.currentSession);
  const chatHistory = useChatStore((state) => state.chatHistory);
  const setCurrentSession = useChatStore((state) => state.setCurrentSession);
  const setChatHistory = useChatStore((state) => state.setChatHistory);
  const setIsRoomCreating = useChatStore((state) => state.setIsRoomCreating);
  const setIsConnectedToRoom = useChatStore((state) => state.setIsConnectedToRoom);

  // Update refs when state changes
  React.useLayoutEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  React.useLayoutEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  // Handle sending join_room when session is ready
  useEffect(() => {
    if (currentSession && isInChatRoom && chatId && currentSession.id === chatId && currentSession.messages.length > 0) {
      // This will be handled by the main WebSocket hook
    }
  }, [currentSession?.id, isInChatRoom, chatId]);

  // Handle room creation
  const handleRoomCreated = useCallback((roomId: string) => {
    console.log('Creating new chat room:', roomId);

    const session = currentSessionRef.current;
    if (session) {
      setCurrentSession({
        ...session,
        id: roomId,
      });

      if (roomId.length === 24) {
        setChatHistory([
          { ...session, id: roomId },
          ...chatHistoryRef.current.filter((chat: any) => chat.id !== session.id)
        ]);
      }
    }
    setIsRoomCreating(false);
  }, [setCurrentSession, setChatHistory, setIsRoomCreating]);

  // Handle room created WebSocket event
  const handleRoomCreatedEvent = useCallback((data: any, wsRef: React.MutableRefObject<WebSocket | null>) => {
    console.log('WebSocket: Room created', data.data.chatId);
    handleRoomCreated(data.data.chatId);
    
    // Send first message immediately before redirect
    if (pendingFirstRef.current) {
      const { text, images: pImages, agentId: pAgentId } = pendingFirstRef.current;
      const msgPayload = {
        type: 'message',
        chatId: data.data.chatId,
        text,
        images: pImages,
        agent_id: pAgentId
      };
      console.log('WebSocket: Sending first message', msgPayload);
      wsRef.current?.send(JSON.stringify(msgPayload));
      pendingFirstRef.current = null;
    }
    
    // Navigate to new chat room
    setTimeout(() => {
      navigate(`/chat/${data.data.chatId}`, { replace: true });
    }, 200);
  }, [handleRoomCreated, navigate]);

  // Handle room joined
  const handleRoomJoined = useCallback((data: any) => {
    console.log('WebSocket: Successfully joined room', data.data.chatId);
    setIsConnectedToRoom(true);
  }, [setIsConnectedToRoom]);

  // Handle join room request
  const handleJoinRoom = useCallback((wsRef: React.MutableRefObject<WebSocket | null>) => {
    if (isInChatRoom && chatId) {
      const session = currentSessionRef.current;
      if (session && session.id === chatId && session.messages.length > 0) {
        const hasJoined = useChatStore.getState().isConnectedToRoom;
        if (!hasJoined && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('WebSocket: Joining room', chatId);
          wsRef.current.send(JSON.stringify({ type: 'join_room', chatId }));
        }
      } else {
        console.log('WebSocket: Chat not loaded yet, waiting for loadChat to complete');
      }
    }
  }, [isInChatRoom, chatId]);

  return {
    pendingFirstRef,
    handleRoomCreatedEvent,
    handleRoomJoined,
    handleJoinRoom
  };
};