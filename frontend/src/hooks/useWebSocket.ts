import { useState, useEffect } from 'react';
import { config } from '../config/config';

export const useWebSocket = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const websocket = new WebSocket(config.wsUrl);
    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  return ws;
}; 