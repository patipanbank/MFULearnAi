import { config } from '../../config/config';

export interface WebSocketMessage {
  type: string;
  data?: any;
  chatId?: string;
  agent_id?: string;
  text?: string;
  images?: Array<{ url: string; mediaType: string }>;
}

export interface WebSocketOptions {
  token: string;
  onOpen?: () => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onReconnect?: () => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private options: WebSocketOptions;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private messageQueue: WebSocketMessage[] = [];
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

  constructor(options: WebSocketOptions) {
    this.options = options;
  }

  connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    this.setConnectionState('connecting');

    try {
      // Clear any existing connection
      this.cleanup();

      const wsUrl = this.buildWebSocketURL();
      console.log('🔌 Connecting to WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);
      this.setupEventListeners();
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.handleConnectionError();
    }
  }

  private buildWebSocketURL(): string {
    let wsUrl = `${config.wsUrl}?token=${this.options.token}`;

    // Handle localhost development
    if (window.location.hostname === 'localhost') {
      wsUrl = `ws://localhost/ws?token=${this.options.token}`;
    }

    return wsUrl;
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');

      // Send queued messages
      this.flushMessageQueue();

      this.options.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.options.onMessage?.(message);
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.handleConnectionError();
      this.options.onError?.(error);
    };

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket closed:', event.code, event.reason);
      this.isConnecting = false;
      this.setConnectionState('disconnected');

      this.options.onClose?.(event);

      // Auto-reconnect on abnormal closure
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };
  }

  private handleConnectionError(): void {
    this.isConnecting = false;
    this.setConnectionState('error');

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`🔄 Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.options.onReconnect?.();
      this.connect();
    }, delay);
  }

  send(message: WebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('⏳ WebSocket not ready, queuing message');
      this.messageQueue.push(message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('❌ Failed to send WebSocket message:', error);
      this.messageQueue.push(message);
      return false;
    }
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`📤 Sending ${this.messageQueue.length} queued messages`);
    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(message => {
      if (!this.send(message)) {
        // If send fails, message will be re-queued
        console.error('❌ Failed to send queued message');
      }
    });
  }

  disconnect(): void {
    console.log('🔌 Manually disconnecting WebSocket');

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.cleanup();
    this.setConnectionState('disconnected');
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }

      this.ws = null;
    }
  }

  private setConnectionState(state: typeof this.connectionState): void {
    this.connectionState = state;
  }

  // Getters
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get state(): typeof this.connectionState {
    return this.connectionState;
  }

  get queueSize(): number {
    return this.messageQueue.length;
  }

  // Update token for reconnection
  updateToken(newToken: string): void {
    this.options.token = newToken;
  }

  // Force reconnect
  reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }
}