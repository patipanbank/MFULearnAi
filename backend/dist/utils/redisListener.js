"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisListener = exports.RedisListener = void 0;
const redis_1 = require("redis");
const config_1 = require("../config/config");
class RedisListener {
    constructor() {
        this.listeners = new Map();
        this.subscriber = (0, redis_1.createClient)({ url: config_1.config.redisUrl });
        this.publisher = (0, redis_1.createClient)({ url: config_1.config.redisUrl });
        this.setupSubscriber();
    }
    async setupSubscriber() {
        try {
            await this.subscriber.connect();
            await this.publisher.connect();
            console.log('✅ Redis listener connected');
            await this.subscriber.subscribe('chat:*', (message, channel) => {
                try {
                    const data = JSON.parse(message);
                    const sessionId = channel.replace('chat:', '');
                    const listener = this.listeners.get(sessionId);
                    if (listener) {
                        listener(data);
                    }
                }
                catch (error) {
                    console.error('❌ Error parsing Redis message:', error);
                }
            });
        }
        catch (error) {
            console.error('❌ Redis listener connection error:', error);
        }
    }
    subscribeToChat(sessionId, callback) {
        this.listeners.set(sessionId, callback);
        console.log(`📡 Subscribed to chat:${sessionId}`);
    }
    unsubscribeFromChat(sessionId) {
        this.listeners.delete(sessionId);
        console.log(`📡 Unsubscribed from chat:${sessionId}`);
    }
    async publish(channel, message) {
        try {
            await this.publisher.publish(channel, JSON.stringify(message));
        }
        catch (error) {
            console.error('❌ Redis publish error:', error);
        }
    }
    async close() {
        try {
            await this.subscriber.disconnect();
            await this.publisher.disconnect();
            console.log('🔌 Redis listener disconnected');
        }
        catch (error) {
            console.error('❌ Error closing Redis listener:', error);
        }
    }
}
exports.RedisListener = RedisListener;
exports.redisListener = new RedisListener();
//# sourceMappingURL=redisListener.js.map