import { Queue, Worker, QueueEvents } from 'bullmq';
import { config } from '../config/config';

const connection = {
  host: new URL(config.redisUrl).hostname,
  port: parseInt(new URL(config.redisUrl).port),
  password: new URL(config.redisUrl).password || undefined,
};

const defaultJobOptions = {
  removeOnComplete: 100,
  removeOnFail: 50,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
};

// Abstraction สำหรับ queue หลายประเภท
export const chatQueue = new Queue('chat', { connection, defaultJobOptions });
export const agentQueue = new Queue('agent', { connection, defaultJobOptions });
export const notificationQueue = new Queue('notification', { connection, defaultJobOptions });

// Event emitter สำหรับ monitoring
export const chatQueueEvents = new QueueEvents('chat', { connection });
export const agentQueueEvents = new QueueEvents('agent', { connection });
export const notificationQueueEvents = new QueueEvents('notification', { connection });

// QueueScheduler (BullMQ 2.x+ อาจไม่มี export หรือ deprecated)
// หากต้องการใช้งาน delayed/stalled jobs ให้ตรวจสอบเวอร์ชัน bullmq และ import ให้ถูกต้อง
// ตัวอย่าง (ถ้าใช้งานได้):
// import { QueueScheduler } from 'bullmq';
// export const chatQueueScheduler = new QueueScheduler('chat', { connection });
// export const agentQueueScheduler = new QueueScheduler('agent', { connection });
// export const notificationQueueScheduler = new QueueScheduler('notification', { connection });

export { Queue, Worker, QueueEvents }; 