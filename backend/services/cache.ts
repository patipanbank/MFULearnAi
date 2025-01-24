import Redis from 'redis';
import logger from './logger.js';

class CacheService {
  private client;

  constructor() {
    this.client = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.client.on('error', (err) => logger.error('Redis Client Error', err));
    this.client.connect();
  }

  async set(key: string, value: any, expireTime = 3600) {
    try {
      await this.client.set(key, JSON.stringify(value), {
        EX: expireTime
      });
    } catch (error) {
      logger.error('Cache Set Error:', error);
    }
  }

  async get(key: string) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache Get Error:', error);
      return null;
    }
  }
}

export default new CacheService(); 