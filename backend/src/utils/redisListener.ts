import { createClient } from 'redis';
import { config } from '../config/config';

export class RedisListener {
  private subscriber: any;
  private publisher: any;
  private listeners: Map<string, (message: any) => void> = new Map();

  constructor() {
    this.subscriber = createClient({ url: config.redisUrl });
    this.publisher = createClient({ url: config.redisUrl });
    
    this.setupSubscriber();
  }

  private async setupSubscriber() {
    try {
      await this.subscriber.connect();
      await this.publisher.connect();
      
      console.log('✅ Redis listener connected');
      
      // Subscribe to chat channels
      await this.subscriber.subscribe('chat:*', (message: string, channel: string) => {
        try {
          const data = JSON.parse(message);
          const sessionId = channel.replace('chat:', '');
          
          // Notify listeners
          const listener = this.listeners.get(sessionId);
          if (listener) {
            listener(data);
          }
        } catch (error) {
          console.error('❌ Error parsing Redis message:', error);
        }
      });
      
    } catch (error) {
      console.error('❌ Redis listener connection error:', error);
    }
  }

  // Subscribe to a specific chat session
  subscribeToChat(sessionId: string, callback: (message: any) => void) {
    this.listeners.set(sessionId, callback);
    console.log(`📡 Subscribed to chat:${sessionId}`);
  }

  // Unsubscribe from a specific chat session
  unsubscribeFromChat(sessionId: string) {
    this.listeners.delete(sessionId);
    console.log(`📡 Unsubscribed from chat:${sessionId}`);
  }

  // Publish message to Redis
  async publish(channel: string, message: any) {
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error('❌ Redis publish error:', error);
    }
  }

  // Close connections
  async close() {
    try {
      await this.subscriber.disconnect();
      await this.publisher.disconnect();
      console.log('🔌 Redis listener disconnected');
    } catch (error) {
      console.error('❌ Error closing Redis listener:', error);
    }
  }
}

export const redisListener = new RedisListener(); 