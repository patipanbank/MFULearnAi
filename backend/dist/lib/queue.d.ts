import { Queue, Worker } from 'bullmq';
export declare const chatQueue: Queue<any, any, string, any, any, string>;
export declare const agentQueue: Queue<any, any, string, any, any, string>;
export declare const queueConfig: {
    defaultJobOptions: {
        removeOnComplete: number;
        removeOnFail: number;
        attempts: number;
        backoff: {
            type: string;
            delay: number;
        };
    };
};
export declare const chatQueue: Queue<any, any, string, any, any, string>;
export declare const agentQueue: Queue<any, any, string, any, any, string>;
export { Queue, Worker };
//# sourceMappingURL=queue.d.ts.map