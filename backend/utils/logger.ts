/**
 * Logger utility for consistent logging throughout the backend
 */

const DEBUG_MODE = process.env.NODE_ENV !== 'production';

export const logger = {
  // Standard log methods
  log: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data !== undefined ? data : '');
  },
  
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error !== undefined ? error : '');
  },
  
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data !== undefined ? data : '');
  },
  
  // Component-specific logging
  chat: {
    log: (message: string, data?: any) => {
      console.log(`[CHAT] ${message}`, data !== undefined ? data : '');
    },
    error: (message: string, error?: any) => {
      console.error(`[CHAT] ${message}`, error !== undefined ? error : '');
    },
    warn: (message: string, data?: any) => {
      console.warn(`[CHAT] ${message}`, data !== undefined ? data : '');
    }
  },
  
  ws: {
    log: (message: string, data?: any) => {
      console.log(`[WS] ${message}`, data !== undefined ? data : '');
    },
    error: (message: string, error?: any) => {
      console.error(`[WS] ${message}`, error !== undefined ? error : '');
    },
    warn: (message: string, data?: any) => {
      console.warn(`[WS] ${message}`, data !== undefined ? data : '');
    },
    // Helper for debugging WebSocket readyState
    readyStateToString(readyState: number): string {
      switch (readyState) {
        case 0: return 'CONNECTING';
        case 1: return 'OPEN';
        case 2: return 'CLOSING';
        case 3: return 'CLOSED';
        default: return 'UNKNOWN';
      }
    },
    // Log details about a WebSocket's state
    connectionState(ws: WebSocket, userId?: string, context?: string): void {
      if (!DEBUG_MODE) return;
      
      const readyState = ws.readyState;
      const stateStr = this.readyStateToString(readyState);
      const contextStr = context ? ` (${context})` : '';
      const userStr = userId ? ` for user ${userId}` : '';
      
      console.log(`[WS] Connection state${contextStr}${userStr}: ${stateStr} (${readyState})`);
    }
  }
}; 