import Redis from 'ioredis';
import config from '../config/config';

const redisUrl = process.env.REDIS_URL || config.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl);
export const redisClient = redis; // Alias for compatibility

redis.on('connect', () => {
  console.log('✅ Connected to Redis:', redisUrl);
});
redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redis.ping();
    console.log('✅ Redis connection verified');
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    throw error;
  }
}; 