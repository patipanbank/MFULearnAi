export declare class RedisListener {
    private subscriber;
    private publisher;
    private listeners;
    constructor();
    private setupSubscriber;
    subscribeToChat(sessionId: string, callback: (message: any) => void): void;
    unsubscribeFromChat(sessionId: string): void;
    publish(channel: string, message: any): Promise<void>;
    close(): Promise<void>;
}
export declare const redisListener: RedisListener;
//# sourceMappingURL=redisListener.d.ts.map