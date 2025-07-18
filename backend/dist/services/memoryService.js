"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryService = exports.MemoryService = void 0;
const bedrockService_1 = require("./bedrockService");
class MemoryService {
    constructor() {
        this.memoryStores = new Map();
        console.log('✅ Memory service initialized');
    }
    async addChatMemory(sessionId, messages) {
        try {
            const existingIds = new Set(this.memoryStores.get(sessionId)?.map(entry => entry.messageId) || []);
            const newEntries = [];
            for (const msg of messages) {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    if (!existingIds.has(msg.id) && msg.content.trim()) {
                        const embedding = await bedrockService_1.bedrockService.createTextEmbedding(msg.content);
                        const entry = {
                            content: msg.content,
                            role: msg.role,
                            timestamp: msg.timestamp,
                            messageId: msg.id,
                            embedding
                        };
                        newEntries.push(entry);
                    }
                }
            }
            if (newEntries.length > 0) {
                const currentMemory = this.memoryStores.get(sessionId) || [];
                this.memoryStores.set(sessionId, [...currentMemory, ...newEntries]);
                console.log(`📚 Added ${newEntries.length} messages to memory for session ${sessionId}`);
            }
        }
        catch (error) {
            console.error(`❌ Error adding chat memory for session ${sessionId}:`, error);
        }
    }
    async searchChatMemory(sessionId, query, k = 5) {
        try {
            const memory = this.memoryStores.get(sessionId);
            if (!memory || memory.length === 0) {
                return [];
            }
            const queryEmbedding = await bedrockService_1.bedrockService.createTextEmbedding(query);
            const scoredEntries = memory
                .filter(entry => entry.embedding)
                .map(entry => ({
                ...entry,
                similarity: this.calculateCosineSimilarity(queryEmbedding, entry.embedding)
            }))
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, k);
            return scoredEntries;
        }
        catch (error) {
            console.error(`❌ Error searching chat memory for session ${sessionId}:`, error);
            return [];
        }
    }
    getRecentMessages(sessionId, limit = 10) {
        const memory = this.memoryStores.get(sessionId);
        if (!memory) {
            return [];
        }
        return memory
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            .slice(-limit);
    }
    getAllMessages(sessionId) {
        const memory = this.memoryStores.get(sessionId);
        if (!memory) {
            return [];
        }
        return memory.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    clearChatMemory(sessionId) {
        this.memoryStores.delete(sessionId);
        console.log(`🧹 Cleared chat memory for session ${sessionId}`);
    }
    getMemoryStats() {
        const stats = {
            totalSessions: this.memoryStores.size,
            totalMessages: 0,
            sessions: {}
        };
        for (const [sessionId, memory] of this.memoryStores) {
            stats.totalMessages += memory.length;
            stats.sessions[sessionId] = {
                messageCount: memory.length,
                lastUpdated: memory.length > 0 ? memory[memory.length - 1].timestamp : null
            };
        }
        return stats;
    }
    calculateCosineSimilarity(vec1, vec2) {
        if (vec1.length !== vec2.length) {
            return 0;
        }
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
    shouldUseMemoryTool(messageCount) {
        return messageCount > 10;
    }
    shouldEmbedMessages(messageCount) {
        return messageCount % 10 === 0;
    }
}
exports.MemoryService = MemoryService;
exports.memoryService = new MemoryService();
//# sourceMappingURL=memoryService.js.map