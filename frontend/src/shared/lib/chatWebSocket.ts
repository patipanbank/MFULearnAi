import { config } from '../../config/config';

export type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Generic payload from backend
export interface WSEventPayload {
  type: string;
  data?: any;
}

type Listener = (payload: WSEventPayload) => void;

class ChatWebSocket {
  private static _instance: ChatWebSocket;
  private ws: WebSocket | null = null;
  private status: WSStatus = 'disconnected';
  private token: string | null = null;
  private listeners: Set<Listener> = new Set();
  private pendingQueue: any[] = [];

  private constructor() {}

  static get instance() {
    if (!this._instance) this._instance = new ChatWebSocket();
    return this._instance;
  }

  /** Connect (or reconnect) with a JWT token */
  connect(token: string) {
    if (!token) return;
    console.debug('[ChatWS] connect called');
    if (this.status === 'connecting' || this.status === 'connected') {
      // already connected with same token
      if (this.token === token) return;
      // token changed – close and reopen
      this.disconnect();
    }

    this.token = token;
    this.status = 'connecting';
    this.emit({ type: 'status', data: this.status });

    let wsUrl = `${config.wsUrl}?token=${token}`;
    if (window.location.hostname === 'localhost') {
      wsUrl = `ws://localhost/ws?token=${token}`;
    }

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('[ChatWS] Failed to construct WebSocket', err);
      this.status = 'error';
      this.emit({ type: 'status', data: this.status });
      return;
    }

    this.ws.onopen = () => {
      console.debug('[ChatWS] onopen - flushing', this.pendingQueue.length, 'items');
      this.status = 'connected';
      this.emit({ type: 'status', data: this.status });
      // flush queue
      this.pendingQueue.forEach((p) => this.safeSend(p));
      this.pendingQueue = [];
    };

    this.ws.onmessage = (e) => {
      console.debug('[ChatWS] onmessage raw', e.data);
      try {
        const payload = JSON.parse(e.data);
        this.emit(payload);
      } catch (err) {
        console.error('[ChatWS] Failed to parse message', err);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[ChatWS] error', err);
      this.status = 'error';
      this.emit({ type: 'status', data: this.status });
    };

    this.ws.onclose = (e) => {
      console.warn('[ChatWS] closed', e);
      this.status = 'disconnected';
      this.emit({ type: 'status', data: this.status });
      this.ws = null;
    };
  }

  disconnect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.close();
    }
    this.ws = null;
    this.status = 'disconnected';
    this.emit({ type: 'status', data: this.status });
  }

  /** Send JSON payload or queue if not yet open */
  send(payload: any) {
    console.debug('[ChatWS] send called', payload, 'status', this.status);
    if (this.status === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.safeSend(payload);
    } else {
      this.pendingQueue.push(payload);
    }
  }

  private safeSend(payload: any) {
    try {
      this.ws?.send(JSON.stringify(payload));
    } catch (err) {
      console.error('[ChatWS] send failed', err);
    }
  }

  /** Subscribe to any event (including status) */
  on(cb: Listener) {
    this.listeners.add(cb);
  }

  off(cb: Listener) {
    this.listeners.delete(cb);
  }

  private emit(payload: WSEventPayload) {
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('[ChatWS] listener error', err);
      }
    });
  }

  getStatus() {
    return this.status;
  }
}

// Export singleton
export const chatWebSocket = ChatWebSocket.instance; 