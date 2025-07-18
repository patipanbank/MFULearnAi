export declare class RedisListener {
    private subscriber;
    private publisher;
    constructor();
    private setupSubscriber;
    publish(channel: string, message: any): Promise<void>;
    close(): Promise<void>;
}
export declare const redisListener: RedisListener;
//# sourceMappingURL=redisListener.d.ts.map