import { Queue, Worker, QueueEvents } from 'bullmq';
export declare const chatQueue: Queue<any, any, string, any, any, string>;
export declare const agentQueue: Queue<any, any, string, any, any, string>;
export declare const notificationQueue: Queue<any, any, string, any, any, string>;
export declare const chatQueueEvents: QueueEvents;
export declare const agentQueueEvents: QueueEvents;
export declare const notificationQueueEvents: QueueEvents;
export { Queue, Worker, QueueEvents };
//# sourceMappingURL=queue.d.ts.map