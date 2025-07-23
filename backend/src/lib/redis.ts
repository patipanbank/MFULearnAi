import Redis from 'ioredis';
import config from '../config/config';

const redisUrl = process.env.REDIS_URL || config.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl);

redis.on('connect', () => {
  console.log('✅ Connected to Redis:', redisUrl);
});
redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
}); 