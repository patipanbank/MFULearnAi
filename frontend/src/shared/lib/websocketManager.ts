/**
 * WebSocket Manager with Best Practices
 * - Exponential backoff reconnection
 * - Message queueing
 * - Heartbeat mechanism
 * - Error handling
 */

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnect?: {
    enabled: boolean;
    initialDelay: number;
    maxDelay: number;
    multiplier: number;
    maxAttempts: number;
  };
  heartbeat?: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  [key: string]: any;
}

type MessageHandler = (message: any) => void;
type ErrorHandler = (error: Event | Error) => void;
type ConnectionHandler = () => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: {
    url: string;
    protocols?: string | string[];
    reconnect: Required<WebSocketConfig['reconnect']>;
    heartbeat: Required<WebSocketConfig['heartbeat']>;
  };
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private heartbeatTimeoutTimer: number | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isIntentionallyClosed = false;

  // Event handlers
  private onMessageHandlers: Set<MessageHandler> = new Set();
  private onOpenHandlers: Set<ConnectionHandler> = new Set();
  private onCloseHandlers: Set<ConnectionHandler> = new Set();
  private onErrorHandlers: Set<ErrorHandler> = new Set();

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      protocols: config.protocols,
      reconnect: {
        enabled: config.reconnect?.enabled ?? true,
        initialDelay: config.reconnect?.initialDelay ?? 1000,
        maxDelay: config.reconnect?.maxDelay ?? 30000,
        multiplier: config.reconnect?.multiplier ?? 1.5,
        maxAttempts: config.reconnect?.maxAttempts ?? 10,
      },
      heartbeat: {
        enabled: config.heartbeat?.enabled ?? true,
        interval: config.heartbeat?.interval ?? 30000,
        timeout: config.heartbeat?.timeout ?? 5000,
      },
    };
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    this.isIntentionallyClosed = false;

    try {
      console.log('WebSocketManager: Connecting to', this.config.url);
      this.ws = new WebSocket(this.config.url, this.config.protocols);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error('WebSocketManager: Failed to create WebSocket', error);
      this.triggerErrorHandlers(error as Error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.isIntentionallyClosed = true;
    this.cleanup();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }

  /**
   * Send message to WebSocket server
   */
  public send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('WebSocketManager: WebSocket not connected, queuing message');
      this.messageQueue.push(message);
      return;
    }

    try {
      const payload = JSON.stringify(message);
      this.ws.send(payload);
      console.log('WebSocketManager: Sent message', message.type);
    } catch (error) {
      console.error('WebSocketManager: Failed to send message', error);
      this.messageQueue.push(message);
      this.triggerErrorHandlers(error as Error);
    }
  }

  /**
   * Register message handler
   */
  public onMessage(handler: MessageHandler): () => void {
    this.onMessageHandlers.add(handler);
    return () => this.onMessageHandlers.delete(handler);
  }

  /**
   * Register open handler
   */
  public onOpen(handler: ConnectionHandler): () => void {
    this.onOpenHandlers.add(handler);
    return () => this.onOpenHandlers.delete(handler);
  }

  /**
   * Register close handler
   */
  public onClose(handler: ConnectionHandler): () => void {
    this.onCloseHandlers.add(handler);
    return () => this.onCloseHandlers.delete(handler);
  }

  /**
   * Register error handler
   */
  public onError(handler: ErrorHandler): () => void {
    this.onErrorHandlers.add(handler);
    return () => this.onErrorHandlers.delete(handler);
  }

  /**
   * Get connection state
   */
  public getState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get queued messages count
   */
  public getQueuedMessagesCount(): number {
    return this.messageQueue.length;
  }

  // Private methods

  private handleOpen(): void {
    console.log('WebSocketManager: Connected');
    this.reconnectAttempts = 0;

    // Start heartbeat
    if (this.config?.heartbeat?.enabled) {
      this.startHeartbeat();
    }

    // Send queued messages
    this.flushMessageQueue();

    // Trigger open handlers
    this.triggerOpenHandlers();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);

      // Handle pong messages (heartbeat response)
      if (message.type === 'pong') {
        this.handleHeartbeatResponse();
        return;
      }

      // Trigger message handlers
      this.triggerMessageHandlers(message);
    } catch (error) {
      console.error('WebSocketManager: Failed to parse message', error);
      this.triggerErrorHandlers(error as Error);
    }
  }

  private handleError(event: Event): void {
    console.error('WebSocketManager: WebSocket error', event);
    this.triggerErrorHandlers(event);
  }

  private handleClose(event: CloseEvent): void {
    console.log('WebSocketManager: Connection closed', event.code, event.reason);

    this.cleanup();

    // Trigger close handlers
    this.triggerCloseHandlers();

    // Attempt reconnection if not intentionally closed
    if (!this.isIntentionallyClosed && this.config?.reconnect?.enabled) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    const maxAttempts = this.config?.reconnect?.maxAttempts ?? 10;
    if (this.reconnectAttempts >= maxAttempts) {
      console.error('WebSocketManager: Max reconnection attempts reached');
      return;
    }

    // Calculate delay with exponential backoff
    const initialDelay = this.config?.reconnect?.initialDelay ?? 1000;
    const multiplier = this.config?.reconnect?.multiplier ?? 1.5;
    const maxDelay = this.config?.reconnect?.maxDelay ?? 30000;

    const delay = Math.min(
      initialDelay * Math.pow(multiplier, this.reconnectAttempts),
      maxDelay
    );

    console.log(`WebSocketManager: Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${maxAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    const interval = this.config?.heartbeat?.interval ?? 30000;
    const timeout = this.config?.heartbeat?.timeout ?? 5000;

    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send ping
        this.send({ type: 'ping' });

        // Set timeout for pong response
        this.heartbeatTimeoutTimer = window.setTimeout(() => {
          console.warn('WebSocketManager: Heartbeat timeout, reconnecting...');
          this.ws?.close();
        }, timeout);
      }
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.heartbeatTimeoutTimer !== null) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private handleHeartbeatResponse(): void {
    // Clear heartbeat timeout
    if (this.heartbeatTimeoutTimer !== null) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private flushMessageQueue(): void {
    console.log(`WebSocketManager: Flushing ${this.messageQueue.length} queued messages`);

    while (this.messageQueue.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private triggerMessageHandlers(message: any): void {
    this.onMessageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('WebSocketManager: Error in message handler', error);
      }
    });
  }

  private triggerOpenHandlers(): void {
    this.onOpenHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('WebSocketManager: Error in open handler', error);
      }
    });
  }

  private triggerCloseHandlers(): void {
    this.onCloseHandlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error('WebSocketManager: Error in close handler', error);
      }
    });
  }

  private triggerErrorHandlers(error: Event | Error): void {
    this.onErrorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        console.error('WebSocketManager: Error in error handler', err);
      }
    });
  }
}
