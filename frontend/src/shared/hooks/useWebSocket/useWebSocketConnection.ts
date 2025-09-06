import { useRef, useCallback, useEffect } from 'react';
import { useAuthStore, useChatStore, useUIStore } from '../../stores';
import { config } from '../../../config/config';

export const useWebSocketConnection = (_: { chatId?: string; isInChatRoom: boolean }) => {
  const token = useAuthStore((state) => state.token);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const wsRef = useRef<WebSocket | null>(null);
  
  const setWsStatus = useChatStore((state) => state.setWsStatus);
  const setIsConnectedToRoom = useChatStore((state) => state.setIsConnectedToRoom);
  const addToast = useUIStore((state) => state.addToast);

  // Helper function to check if token is expired
  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp && payload.exp < currentTime;
    } catch {
      return true;
    }
  }, []);

  // Helper function to try token refresh
  const tryRefreshToken = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Attempting to refresh token...');
      const newToken = await refreshToken();
      if (newToken) {
        console.log('Token refreshed successfully');
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    return false;
  }, [refreshToken]);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    console.log('connectWebSocket called', { token: !!token, wsRef: !!wsRef.current });
    
    if (
      !token ||
      (wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
         wsRef.current.readyState === WebSocket.CONNECTING))
    ) {
      console.log('connectWebSocket: Skipping connection', { 
        noToken: !token, 
        wsOpen: wsRef.current?.readyState === WebSocket.OPEN,
        wsConnecting: wsRef.current?.readyState === WebSocket.CONNECTING 
      });
      return;
    }
    
    if (isTokenExpired(token)) {
      console.log('Token expired, attempting refresh...');
      tryRefreshToken().then((success) => {
        if (success) {
          // Close existing connection and let parent handle reconnection
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
        }
      });
      return;
    }
    
    console.log('connectWebSocket: Starting connection to', config.wsUrl);
    setWsStatus('connecting');
    setIsConnectedToRoom(false);
    
    let wsUrl = `${config.wsUrl}?token=${token}`;
    if (window.location.hostname === 'localhost') {
      wsUrl = `ws://localhost/ws?token=${token}`;
    }
    
    console.log('connectWebSocket: Final WebSocket URL', wsUrl);
    
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch (error) {
      console.error('connectWebSocket: Failed to create WebSocket', error);
      setWsStatus('error');
      setIsConnectedToRoom(false);
      addToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to create WebSocket connection',
        duration: 5000
      });
      return;
    }
    
    return ws; // Return WebSocket instance for event handling
  }, [token, setWsStatus, setIsConnectedToRoom, addToast, isTokenExpired, tryRefreshToken]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    wsRef,
    connectWebSocket,
    isTokenExpired,
    tryRefreshToken
  };
};