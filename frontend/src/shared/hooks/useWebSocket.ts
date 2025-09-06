// Main WebSocket hook
export { useWebSocket } from './useWebSocket/index';

// Sub-hooks (exported for potential reuse)
export { useWebSocketConnection } from './useWebSocket/useWebSocketConnection';
export { useWebSocketMessages } from './useWebSocket/useWebSocketMessages';
export { useWebSocketEvents } from './useWebSocket/useWebSocketEvents';
export { useWebSocketRoom } from './useWebSocket/useWebSocketRoom';

// Types
export type * from './useWebSocket/types/websocket.types';