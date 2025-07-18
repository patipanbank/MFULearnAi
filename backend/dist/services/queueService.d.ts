import { Job } from 'bullmq';
export interface ChatJobData {
    sessionId: string;
    userId: string;
    message: string;
    modelId: string;
    collectionNames: string[];
    images?: any[];
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    agentId?: string;
}
export interface AgentJobData {
    agentId: string;
    userId: string;
    data: any;
}
export interface NotificationJobData {
    userId: string;
    type: string;
    payload: any;
}
export declare class QueueService {
    addChatJob(data: ChatJobData): Promise<Job<any, any, string>>;
    addAgentJob(data: AgentJobData): Promise<Job<any, any, string>>;
    addNotificationJob(data: NotificationJobData): Promise<Job<any, any, string>>;
    processChatJob(job: Job<ChatJobData>): Promise<void>;
    processAgentJob(job: Job<AgentJobData>): Promise<void>;
    processNotificationJob(job: Job<NotificationJobData>): Promise<void>;
    private publishToRedis;
    getJobStatus(jobId: string): Promise<{
        id: any;
        name: any;
        state: any;
        progress: any;
        data: any;
        failedReason: any;
    } | null>;
    getQueueStats(): Promise<{
        chat: {
            [index: string]: number;
        };
        agent: {
            [index: string]: number;
        };
    }>;
}
export declare const queueService: QueueService;
//# sourceMappingURL=queueService.d.ts.map