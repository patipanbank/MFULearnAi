import { createClient } from 'redis';
import { config } from '../config/config';
import { wsManager } from './websocketManager';

export class RedisListener {
  private subscriber: any;
  private publisher: any;

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
      await this.subscriber.pSubscribe('chat:*', async (message: string, channel: string) => {
        try {
          const sessionId = channel.replace('chat:', '');
          // broadcast message (string) to all ws clients in this session
          await wsManager.broadcastToSession(sessionId, message);
        } catch (error) {
          console.error('❌ Error broadcasting Redis message:', error);
        }
      });
    } catch (error) {
      console.error('❌ Redis listener connection error:', error);
    }
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