"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisListener = exports.RedisListener = void 0;
const redis_1 = require("redis");
const config_1 = require("../config/config");
const websocketManager_1 = require("./websocketManager");
class RedisListener {
    constructor() {
        this.subscriber = (0, redis_1.createClient)({ url: config_1.config.redisUrl });
        this.publisher = (0, redis_1.createClient)({ url: config_1.config.redisUrl });
        this.setupSubscriber();
    }
    async setupSubscriber() {
        try {
            await this.subscriber.connect();
            await this.publisher.connect();
            console.log('✅ Redis listener connected');
            await this.subscriber.pSubscribe('chat:*', async (message, channel) => {
                try {
                    const sessionId = channel.replace('chat:', '');
                    await websocketManager_1.wsManager.broadcastToSession(sessionId, message);
                }
                catch (error) {
                    console.error('❌ Error broadcasting Redis message:', error);
                }
            });
        }
        catch (error) {
            console.error('❌ Redis listener connection error:', error);
        }
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