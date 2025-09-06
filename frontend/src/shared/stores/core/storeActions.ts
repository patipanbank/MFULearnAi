/**
 * Store Actions - Centralized action creators สำหรับ complex operations
 */

export interface StoreAction<T = any> {
  type: string;
  payload?: T;
  meta?: {
    timestamp: Date;
    source: string;
    version: string;
  };
}

export class StoreActionCreator {
  private actionHistory: StoreAction[] = [];
  private maxHistorySize = 100;

  /**
   * สร้าง action object
   */
  createAction<T>(type: string, payload?: T, source = 'unknown'): StoreAction<T> {
    const action: StoreAction<T> = {
      type,
      payload,
      meta: {
        timestamp: new Date(),
        source,
        version: '1.0'
      }
    };

    // เก็บ history
    this.actionHistory.push(action);
    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory.shift();
    }

    return action;
  }

  /**
   * Batch actions for atomic updates
   */
  batchActions(actions: StoreAction[], source = 'batch'): StoreAction {
    return this.createAction('BATCH_UPDATE', actions, source);
  }

  /**
   * ดู action history
   */
  getActionHistory(limit?: number): StoreAction[] {
    if (limit) {
      return this.actionHistory.slice(-limit);
    }
    return [...this.actionHistory];
  }

  /**
   * Clear action history
   */
  clearHistory(): void {
    this.actionHistory = [];
  }

  /**
   * Find actions by type
   */
  findActionsByType(type: string): StoreAction[] {
    return this.actionHistory.filter(action => action.type === type);
  }

  /**
   * Get action statistics
   */
  getStats() {
    const typeCount = this.actionHistory.reduce((acc, action) => {
      acc[action.type] = (acc[action.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalActions: this.actionHistory.length,
      uniqueTypes: Object.keys(typeCount).length,
      typeDistribution: typeCount,
      recentActions: this.actionHistory.slice(-5).map(a => ({
        type: a.type,
        timestamp: a.meta?.timestamp,
        source: a.meta?.source
      }))
    };
  }
}

// Global action creator instance
export const storeActionCreator = new StoreActionCreator();

// Common action types
export const STORE_ACTIONS = {
  // Chat actions
  CHAT_MESSAGE_ADD: 'CHAT_MESSAGE_ADD',
  CHAT_MESSAGE_UPDATE: 'CHAT_MESSAGE_UPDATE',
  CHAT_SESSION_CREATE: 'CHAT_SESSION_CREATE',
  CHAT_HISTORY_LOAD: 'CHAT_HISTORY_LOAD',
  
  // Agent actions
  AGENT_SELECT: 'AGENT_SELECT',
  AGENT_CONFIG_UPDATE: 'AGENT_CONFIG_UPDATE',
  AGENT_LIST_REFRESH: 'AGENT_LIST_REFRESH',
  
  // UI actions
  MODAL_OPEN: 'MODAL_OPEN',
  MODAL_CLOSE: 'MODAL_CLOSE',
  TOAST_SHOW: 'TOAST_SHOW',
  LOADING_SET: 'LOADING_SET',
  
  // WebSocket actions
  WS_CONNECT: 'WS_CONNECT',
  WS_DISCONNECT: 'WS_DISCONNECT',
  WS_MESSAGE_RECEIVED: 'WS_MESSAGE_RECEIVED',
  
  // Batch operations
  BATCH_UPDATE: 'BATCH_UPDATE',
  STATE_RESET: 'STATE_RESET'
} as const;

export type StoreActionType = typeof STORE_ACTIONS[keyof typeof STORE_ACTIONS];