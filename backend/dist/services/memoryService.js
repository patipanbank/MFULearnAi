"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryService = exports.MemoryService = void 0;
const chromaService_1 = require("./chromaService");
const embeddingService_1 = require("./embeddingService");
const redis_1 = require("../lib/redis");
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
class MemoryService {
    constructor() {
        this.BUFFER_WINDOW_SIZE = 20;
        this.TOKEN_LIMIT = 4000;
        this.SUMMARY_THRESHOLD = 30;
        this.MIN_RELEVANCE_SCORE = 0.7;
        this.bedrock = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region: process.env.AWS_REGION || 'us-east-1'
        });
    }
    async addMessage(sessionId, message) {
        try {
            await this.addToBuffer(sessionId, message);
            const bufferSize = await this.getBufferSize(sessionId);
            if (bufferSize >= this.SUMMARY_THRESHOLD) {
                await this.performSummarization(sessionId);
            }
            await this.addToVectorStore(sessionId, message);
        }
        catch (error) {
            console.error(`❌ Error adding message: ${error}`);
            throw error;
        }
    }
    async getConversationContext(sessionId, query) {
        try {
            const recentMessages = await this.getBufferMessages(sessionId);
            const summary = await this.getConversationSummary(sessionId);
            let relevantMessages = [];
            if (query) {
                const searchResults = await this.semanticSearch(sessionId, query, 5);
                relevantMessages = searchResults.map(result => ({
                    role: result.role,
                    content: result.content,
                    timestamp: result.timestamp,
                    metadata: { ...result.metadata, relevanceScore: result.relevanceScore }
                }));
            }
            return this.combineMessages(recentMessages, relevantMessages, summary);
        }
        catch (error) {
            console.error(`❌ Error getting conversation context: ${error}`);
            return [];
        }
    }
    async addRecentMessage(sessionId, message) {
        const msg = {
            role: message.role || 'user',
            content: message.content || '',
            timestamp: message.timestamp || new Date().toISOString(),
            metadata: message.metadata
        };
        await this.addMessage(sessionId, msg);
    }
    async getRecentMessages(sessionId) {
        const messages = await this.getBufferMessages(sessionId);
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            ...msg.metadata
        }));
    }
    async searchMemory(sessionId, query, k = 3) {
        try {
            const results = await this.semanticSearch(sessionId, query, k);
            return results.map(result => ({
                content: result.content,
                role: result.role,
                timestamp: result.timestamp,
                relevanceScore: result.relevanceScore
            }));
        }
        catch (error) {
            console.error(`❌ Error searching memory: ${error}`);
            return [];
        }
    }
    async addToBuffer(sessionId, message) {
        const key = `memory:buffer:${sessionId}`;
        const messageStr = JSON.stringify(message);
        await redis_1.redis.lpush(key, messageStr);
        await redis_1.redis.ltrim(key, 0, this.BUFFER_WINDOW_SIZE - 1);
        await redis_1.redis.expire(key, 86400);
    }
    async getBufferMessages(sessionId) {
        const key = `memory:buffer:${sessionId}`;
        const items = await redis_1.redis.lrange(key, 0, -1);
        return items.map(item => {
            try {
                return JSON.parse(item);
            }
            catch {
                return null;
            }
        }).filter(Boolean).reverse();
    }
    async getBufferSize(sessionId) {
        const key = `memory:buffer:${sessionId}`;
        return await redis_1.redis.llen(key);
    }
    async clearBuffer(sessionId) {
        const key = `memory:buffer:${sessionId}`;
        await redis_1.redis.del(key);
    }
    async performSummarization(sessionId) {
        try {
            const messages = await this.getBufferMessages(sessionId);
            if (messages.length < 15)
                return;
            const messagesToSummarize = messages.slice(0, -10);
            const remainingMessages = messages.slice(-10);
            const newSummary = await this.generateSummary(sessionId, messagesToSummarize);
            await this.updateSummary(sessionId, newSummary);
            await this.clearBuffer(sessionId);
            for (const msg of remainingMessages) {
                await this.addToBuffer(sessionId, msg);
            }
            console.log(`🧠 Summarized ${messagesToSummarize.length} messages for session ${sessionId}`);
        }
        catch (error) {
            console.error(`❌ Error in summarization: ${error}`);
        }
    }
    async generateSummary(sessionId, messages) {
        try {
            const conversationText = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
            const prompt = `Summarize this conversation focusing on key points, decisions, and context needed for continuation:\n\n${conversationText}\n\nProvide a concise summary:`;
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
                modelId: 'amazon.titan-text-express-v1',
                body: JSON.stringify({
                    inputText: prompt,
                    textGenerationConfig: {
                        maxTokenCount: 500,
                        temperature: 0.3,
                        topP: 0.9
                    }
                }),
                contentType: 'application/json'
            });
            const response = await this.bedrock.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            const summary = responseBody.results[0].outputText.trim();
            const keyTopics = this.extractKeyTopics(conversationText);
            return {
                sessionId,
                summary,
                messageCount: messages.length,
                lastUpdated: new Date().toISOString(),
                keyTopics
            };
        }
        catch (error) {
            console.error(`❌ Error generating summary: ${error}`);
            return {
                sessionId,
                summary: `Conversation summary (${messages.length} messages)`,
                messageCount: messages.length,
                lastUpdated: new Date().toISOString(),
                keyTopics: []
            };
        }
    }
    extractKeyTopics(text) {
        const words = text.toLowerCase().split(/\W+/);
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'when', 'where', 'why', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can']);
        const wordCount = {};
        words.forEach(word => {
            if (word.length > 3 && !stopWords.has(word)) {
                wordCount[word] = (wordCount[word] || 0) + 1;
            }
        });
        return Object.entries(wordCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }
    async updateSummary(sessionId, summary) {
        const key = `memory:summary:${sessionId}`;
        await redis_1.redis.setex(key, 604800, JSON.stringify(summary));
    }
    async getConversationSummary(sessionId) {
        const key = `memory:summary:${sessionId}`;
        const summaryStr = await redis_1.redis.get(key);
        if (!summaryStr)
            return null;
        try {
            return JSON.parse(summaryStr);
        }
        catch {
            return null;
        }
    }
    async addToVectorStore(sessionId, message) {
        try {
            const contentHash = Buffer.from(message.content + message.timestamp).toString('base64');
            const collectionName = `memory_${sessionId}`;
            const exists = await chromaService_1.chromaService.documentExists(collectionName, contentHash);
            if (exists)
                return;
            const embedding = await embeddingService_1.embeddingService.embed(message.content);
            if (!embedding || embedding.length === 0)
                return;
            await chromaService_1.chromaService.addToCollection(collectionName, [message.content], [embedding], [{
                    role: message.role,
                    timestamp: message.timestamp,
                    sessionId,
                    ...message.metadata
                }], [contentHash]);
        }
        catch (error) {
            console.error(`❌ Error adding to vector store: ${error}`);
        }
    }
    async semanticSearch(sessionId, query, k = 5) {
        try {
            const queryEmbedding = await embeddingService_1.embeddingService.embed(query);
            if (!queryEmbedding || queryEmbedding.length === 0)
                return [];
            const results = await chromaService_1.chromaService.queryCollection(`memory_${sessionId}`, [queryEmbedding], k);
            if (!results)
                return [];
            const processedResults = [];
            if (results.documents && results.distances && results.metadatas) {
                const documents = results.documents.flat();
                const distances = results.distances.flat();
                const metadatas = results.metadatas.flat();
                for (let i = 0; i < documents.length; i++) {
                    const relevanceScore = Math.max(0, 1 - (distances[i] || 1));
                    if (relevanceScore >= this.MIN_RELEVANCE_SCORE) {
                        const metadata = metadatas[i];
                        processedResults.push({
                            content: String(documents[i] || ''),
                            role: String(metadata?.role || 'user'),
                            timestamp: String(metadata?.timestamp || ''),
                            relevanceScore,
                            metadata: metadata || undefined
                        });
                    }
                }
            }
            return processedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
        }
        catch (error) {
            console.error(`❌ Error in semantic search: ${error}`);
            return [];
        }
    }
    combineMessages(recentMessages, relevantMessages, summary) {
        const messages = [];
        if (summary) {
            messages.push({
                role: 'system',
                content: `Previous conversation: ${summary.summary}`,
                timestamp: summary.lastUpdated,
                metadata: { type: 'summary', keyTopics: summary.keyTopics }
            });
        }
        const seen = new Set();
        const allMessages = [...relevantMessages, ...recentMessages];
        for (const msg of allMessages) {
            const key = `${msg.content}_${msg.timestamp}`;
            if (!seen.has(key)) {
                seen.add(key);
                messages.push(msg);
            }
        }
        const sorted = messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return this.trimToTokenLimit(sorted);
    }
    trimToTokenLimit(messages) {
        let totalTokens = 0;
        const result = [];
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const estimatedTokens = Math.ceil(msg.content.length / 4);
            if (totalTokens + estimatedTokens <= this.TOKEN_LIMIT) {
                result.unshift(msg);
                totalTokens += estimatedTokens;
            }
            else if (msg.role === 'system') {
                result.unshift(msg);
            }
            else {
                break;
            }
        }
        return result;
    }
    async embedMessage(sessionId, message) {
        const msg = {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        };
        await this.addMessage(sessionId, msg);
    }
    async getAllMessages(sessionId) {
        try {
            const results = await chromaService_1.chromaService.getAllFromCollection(`memory_${sessionId}`);
            if (!Array.isArray(results))
                return [];
            return results.map((r) => ({
                content: r.document ?? '',
                role: r.metadata?.role || 'user',
                timestamp: r.metadata?.timestamp || null
            }));
        }
        catch (error) {
            console.error(`❌ Error getting all messages: ${error}`);
            return [];
        }
    }
    async setupHybridMemory(sessionId, messages) {
        try {
            console.log(`🧠 Setting up memory for session ${sessionId}`);
            const recentMessages = messages.slice(-this.BUFFER_WINDOW_SIZE);
            await this.clearBuffer(sessionId);
            for (const msg of recentMessages) {
                const message = {
                    role: msg.role || 'user',
                    content: msg.content || '',
                    timestamp: msg.timestamp || new Date().toISOString(),
                    metadata: msg.metadata
                };
                await this.addToBuffer(sessionId, message);
            }
            console.log(`💾 Memory initialized with ${recentMessages.length} messages`);
        }
        catch (error) {
            console.error(`❌ Error setting up memory: ${error}`);
        }
    }
    async getMemoryStats(sessionId) {
        try {
            const bufferSize = await this.getBufferSize(sessionId);
            const summary = await this.getConversationSummary(sessionId);
            let vectorStoreCount = 0;
            try {
                const allMessages = await chromaService_1.chromaService.getAllFromCollection(`memory_${sessionId}`);
                vectorStoreCount = Array.isArray(allMessages) ? allMessages.length : 0;
            }
            catch {
                vectorStoreCount = 0;
            }
            return {
                sessionId,
                bufferSize,
                vectorStoreCount,
                hasSummary: !!summary,
                summaryMessageCount: summary?.messageCount || 0,
                keyTopics: summary?.keyTopics || [],
                lastSummaryUpdate: summary?.lastUpdated || null,
                memoryType: 'intelligent_hybrid'
            };
        }
        catch (error) {
            console.error(`❌ Error getting memory stats: ${error}`);
            return { error: 'Memory stats unavailable' };
        }
    }
    async clearRecentMessages(sessionId) {
        await this.clearBuffer(sessionId);
    }
    async clearLongTermMemory(sessionId) {
        try {
            await chromaService_1.chromaService.deleteCollection(`memory_${sessionId}`);
        }
        catch (error) {
            console.error(`❌ Error clearing long-term memory: ${error}`);
        }
    }
    async clearAllMemory(sessionId) {
        try {
            await this.clearBuffer(sessionId);
            await redis_1.redis.del(`memory:summary:${sessionId}`);
            await chromaService_1.chromaService.deleteCollection(`memory_${sessionId}`);
            console.log(`🧹 Cleared all memory for session ${sessionId}`);
        }
        catch (error) {
            console.error(`❌ Error clearing memory: ${error}`);
        }
    }
    async forceSummarization(sessionId) {
        try {
            await this.performSummarization(sessionId);
            return await this.getConversationSummary(sessionId);
        }
        catch (error) {
            console.error(`❌ Error in force summarization: ${error}`);
            return null;
        }
    }
}
exports.MemoryService = MemoryService;
exports.memoryService = new MemoryService();
//# sourceMappingURL=memoryService.js.map