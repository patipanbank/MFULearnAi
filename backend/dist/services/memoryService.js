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
        this.contextSwitchCache = new Map();
        this.topicModelCache = new Map();
        this.contextTransitions = new Map();
        this.bedrock = new client_bedrock_runtime_1.BedrockRuntimeClient({
            region: process.env.AWS_REGION || 'us-east-1'
        });
        this.setupContextSwitching();
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
    setupContextSwitching() {
        console.log('🧠 Setting up enhanced context switching');
    }
    async analyzeContextSwitch(sessionId, newMessage, previousMessages) {
        try {
            const currentContext = await this.analyzeCurrentContext(sessionId, previousMessages);
            const newContext = await this.analyzeMessageContext(newMessage);
            const switchDetected = await this.detectContextSwitch(currentContext, newContext);
            if (switchDetected.confidence > 0.7) {
                const contextSwitch = {
                    id: this.generateContextSwitchId(),
                    sessionId,
                    fromContext: currentContext,
                    toContext: newContext,
                    trigger: switchDetected,
                    timestamp: new Date(),
                    confidence: switchDetected.confidence,
                    transitionType: this.determineTransitionType(currentContext, newContext)
                };
                this.contextSwitchCache.set(contextSwitch.id, contextSwitch);
                await this.updateTransitionHistory(sessionId, currentContext, newContext);
                console.log(`🔄 Context switch detected: ${currentContext.topic} → ${newContext.topic} (${switchDetected.confidence.toFixed(2)})`);
                return contextSwitch;
            }
            return null;
        }
        catch (error) {
            console.error(`❌ Error analyzing context switch: ${error}`);
            return null;
        }
    }
    async getAdaptiveContext(sessionId, query, contextSwitch) {
        try {
            if (!contextSwitch) {
                return await this.getConversationContext(sessionId, query);
            }
            const strategy = this.determineAdaptationStrategy(contextSwitch);
            switch (strategy.type) {
                case 'maintain_context':
                    return await this.getMaintainedContext(sessionId, contextSwitch, strategy);
                case 'bridge_contexts':
                    return await this.getBridgedContext(sessionId, contextSwitch, strategy);
                case 'reset_context':
                    return await this.getResetContext(sessionId, contextSwitch, strategy);
                case 'merge_contexts':
                    return await this.getMergedContext(sessionId, contextSwitch, strategy);
                default:
                    return await this.getConversationContext(sessionId, query);
            }
        }
        catch (error) {
            console.error(`❌ Error getting adaptive context: ${error}`);
            return await this.getConversationContext(sessionId, query);
        }
    }
    async updateTopicModel(sessionId, messages) {
        try {
            let topicModel = this.topicModelCache.get(sessionId);
            if (!topicModel) {
                topicModel = {
                    sessionId,
                    topics: [],
                    topicTransitions: [],
                    lastUpdated: new Date()
                };
            }
            const extractedTopics = await this.extractTopics(messages);
            topicModel.topics = this.mergeTopics(topicModel.topics, extractedTopics);
            topicModel.topicTransitions = await this.updateTopicTransitions(topicModel.topics, messages);
            topicModel.lastUpdated = new Date();
            this.topicModelCache.set(sessionId, topicModel);
            console.log(`📊 Updated topic model for session ${sessionId}: ${topicModel.topics.length} topics`);
        }
        catch (error) {
            console.error(`❌ Error updating topic model: ${error}`);
        }
    }
    async analyzeCurrentContext(sessionId, messages) {
        if (messages.length === 0) {
            return this.createEmptyContext(sessionId);
        }
        const recentMessages = messages.slice(-5);
        const entities = await this.extractEntities(recentMessages);
        const keywords = this.extractKeywords(recentMessages);
        const topic = await this.identifyTopic(recentMessages, keywords);
        const sentiment = this.analyzeSentiment(recentMessages);
        const intent = await this.analyzeIntent(recentMessages);
        return {
            id: this.generateContextId(),
            topic,
            domain: this.determineDomain(keywords, entities),
            entities,
            sentiment,
            complexity: this.assessComplexity(recentMessages),
            intent,
            keywords,
            startTime: new Date(messages[0].timestamp),
            messageCount: messages.length
        };
    }
    async analyzeMessageContext(message) {
        const entities = await this.extractEntities([message]);
        const keywords = this.extractKeywords([message]);
        const topic = await this.identifyTopic([message], keywords);
        const sentiment = this.analyzeSentiment([message]);
        const intent = await this.analyzeIntent([message]);
        return {
            id: this.generateContextId(),
            topic,
            domain: this.determineDomain(keywords, entities),
            entities,
            sentiment,
            complexity: this.assessComplexity([message]),
            intent,
            keywords,
            startTime: new Date(message.timestamp),
            messageCount: 1
        };
    }
    async detectContextSwitch(currentContext, newContext) {
        const evidence = [];
        let confidence = 0;
        let triggerType = 'topic_drift';
        const topicSimilarity = this.calculateTopicSimilarity(currentContext.topic, newContext.topic);
        if (topicSimilarity < 0.3) {
            evidence.push(`Topic change: ${currentContext.topic} → ${newContext.topic}`);
            confidence += 0.4;
            triggerType = 'topic_drift';
        }
        const entityOverlap = this.calculateEntityOverlap(currentContext.entities, newContext.entities);
        if (entityOverlap < 0.2) {
            evidence.push(`Entity shift: ${entityOverlap.toFixed(2)} overlap`);
            confidence += 0.3;
            triggerType = 'entity_change';
        }
        if (currentContext.intent !== newContext.intent) {
            evidence.push(`Intent change: ${currentContext.intent} → ${newContext.intent}`);
            confidence += 0.2;
            triggerType = 'user_intent';
        }
        if (currentContext.domain !== newContext.domain) {
            evidence.push(`Domain change: ${currentContext.domain} → ${newContext.domain}`);
            confidence += 0.1;
        }
        const explicitIndicators = ['let\'s talk about', 'switching to', 'now about', 'different topic'];
        const hasExplicitIndicator = explicitIndicators.some(indicator => newContext.keywords.some(keyword => keyword.toLowerCase().includes(indicator)));
        if (hasExplicitIndicator) {
            evidence.push('Explicit context change indicator detected');
            confidence += 0.5;
            triggerType = 'explicit_change';
        }
        return {
            type: triggerType,
            confidence: Math.min(confidence, 1.0),
            evidence
        };
    }
    determineAdaptationStrategy(contextSwitch) {
        const { fromContext, toContext, transitionType, confidence } = contextSwitch;
        switch (transitionType) {
            case 'smooth':
                return {
                    type: 'bridge_contexts',
                    memoryRetention: 0.8,
                    contextBlending: 0.7,
                    priority: 'balanced'
                };
            case 'related':
                return {
                    type: 'merge_contexts',
                    memoryRetention: 0.9,
                    contextBlending: 0.8,
                    priority: 'current'
                };
            case 'abrupt':
                return confidence > 0.8 ? {
                    type: 'reset_context',
                    memoryRetention: 0.3,
                    contextBlending: 0.2,
                    priority: 'current'
                } : {
                    type: 'maintain_context',
                    memoryRetention: 0.7,
                    contextBlending: 0.5,
                    priority: 'previous'
                };
            case 'unrelated':
                return {
                    type: 'reset_context',
                    memoryRetention: 0.2,
                    contextBlending: 0.1,
                    priority: 'current'
                };
            default:
                return {
                    type: 'maintain_context',
                    memoryRetention: 0.7,
                    contextBlending: 0.5,
                    priority: 'balanced'
                };
        }
    }
    async getMaintainedContext(sessionId, contextSwitch, strategy) {
        const recentMessages = await this.getBufferMessages(sessionId);
        const contextSize = Math.floor(recentMessages.length * strategy.memoryRetention);
        return recentMessages.slice(-contextSize);
    }
    async getBridgedContext(sessionId, contextSwitch, strategy) {
        const recentMessages = await this.getBufferMessages(sessionId);
        const previousContextMessages = recentMessages.slice(0, Math.floor(recentMessages.length * 0.6));
        const relevantMessages = await this.getRelevantMessages(sessionId, contextSwitch.toContext.keywords.join(' '), 3);
        return [...previousContextMessages, ...relevantMessages];
    }
    async getResetContext(sessionId, contextSwitch, strategy) {
        const recentMessages = await this.getBufferMessages(sessionId);
        const minimalContext = recentMessages.slice(-2);
        const summary = await this.getConversationSummary(sessionId);
        if (summary) {
            return [{
                    role: 'system',
                    content: `Previous conversation summary: ${summary.summary}`,
                    timestamp: new Date().toISOString(),
                    metadata: { type: 'context_summary' }
                }, ...minimalContext];
        }
        return minimalContext;
    }
    async getMergedContext(sessionId, contextSwitch, strategy) {
        const recentMessages = await this.getBufferMessages(sessionId);
        const fromContextMessages = await this.getContextRelatedMessages(sessionId, contextSwitch.fromContext, 3);
        const toContextMessages = await this.getContextRelatedMessages(sessionId, contextSwitch.toContext, 2);
        const mergedMessages = this.mergeAndDeduplicateMessages([
            ...fromContextMessages,
            ...toContextMessages,
            ...recentMessages.slice(-3)
        ]);
        return mergedMessages;
    }
    createEmptyContext(sessionId) {
        return {
            id: this.generateContextId(),
            topic: 'general',
            domain: 'general',
            entities: [],
            sentiment: 'neutral',
            complexity: 'low',
            intent: 'conversation',
            keywords: [],
            startTime: new Date(),
            messageCount: 0
        };
    }
    async extractEntities(messages) {
        const entities = [];
        const text = messages.map(m => m.content).join(' ');
        const patterns = {
            person: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
            organization: /\b[A-Z][A-Z\s&]+\b/g,
            technology: /\b(JavaScript|Python|React|Node\.js|AI|ML|API)\b/gi
        };
        for (const [type, pattern] of Object.entries(patterns)) {
            const matches = text.match(pattern) || [];
            for (const match of matches) {
                entities.push({
                    text: match,
                    type: type,
                    confidence: 0.8,
                    mentions: 1
                });
            }
        }
        return entities;
    }
    extractKeywords(messages) {
        const text = messages.map(m => m.content).join(' ').toLowerCase();
        const words = text.split(/\W+/).filter(word => word.length > 3);
        const stopWords = new Set(['that', 'this', 'with', 'from', 'they', 'been', 'have', 'your', 'what', 'when', 'where', 'will', 'there']);
        const keywords = words.filter(word => !stopWords.has(word));
        const frequency = {};
        keywords.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        return Object.entries(frequency)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);
    }
    async identifyTopic(messages, keywords) {
        const topicKeywords = {
            programming: ['code', 'function', 'javascript', 'python', 'development'],
            education: ['learn', 'study', 'course', 'university', 'school'],
            business: ['company', 'market', 'sales', 'business', 'strategy'],
            technology: ['technology', 'software', 'system', 'digital', 'computer']
        };
        for (const [topic, topicWords] of Object.entries(topicKeywords)) {
            const matches = keywords.filter(keyword => topicWords.some(topicWord => keyword.includes(topicWord)));
            if (matches.length >= 2) {
                return topic;
            }
        }
        return 'general';
    }
    analyzeSentiment(messages) {
        const text = messages.map(m => m.content).join(' ').toLowerCase();
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'like', 'helpful'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'problem', 'error'];
        const positiveCount = positiveWords.reduce((count, word) => count + (text.match(new RegExp(word, 'g')) || []).length, 0);
        const negativeCount = negativeWords.reduce((count, word) => count + (text.match(new RegExp(word, 'g')) || []).length, 0);
        if (positiveCount > negativeCount)
            return 'positive';
        if (negativeCount > positiveCount)
            return 'negative';
        return 'neutral';
    }
    async analyzeIntent(messages) {
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage)
            return 'general';
        const content = lastMessage.content.toLowerCase();
        if (content.includes('?'))
            return 'question';
        if (content.includes('help') || content.includes('how'))
            return 'assistance';
        if (content.includes('explain') || content.includes('what'))
            return 'explanation';
        if (content.includes('create') || content.includes('make'))
            return 'creation';
        return 'conversation';
    }
    determineDomain(keywords, entities) {
        const domainKeywords = {
            technology: ['tech', 'software', 'code', 'programming', 'computer'],
            academic: ['university', 'research', 'study', 'academic', 'education'],
            business: ['business', 'company', 'market', 'sales', 'finance'],
            personal: ['personal', 'life', 'family', 'friend', 'hobby']
        };
        for (const [domain, domainWords] of Object.entries(domainKeywords)) {
            const matches = keywords.filter(keyword => domainWords.some(domainWord => keyword.includes(domainWord)));
            if (matches.length >= 1) {
                return domain;
            }
        }
        return 'general';
    }
    assessComplexity(messages) {
        const text = messages.map(m => m.content).join(' ');
        const avgWordLength = text.split(' ').reduce((sum, word) => sum + word.length, 0) / text.split(' ').length;
        const sentenceLength = text.split(/[.!?]/).length;
        if (avgWordLength > 6 && sentenceLength > 3)
            return 'high';
        if (avgWordLength > 4 || sentenceLength > 2)
            return 'medium';
        return 'low';
    }
    calculateTopicSimilarity(topic1, topic2) {
        if (topic1 === topic2)
            return 1.0;
        const words1 = new Set(topic1.split(' '));
        const words2 = new Set(topic2.split(' '));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        return intersection.size / union.size;
    }
    calculateEntityOverlap(entities1, entities2) {
        if (entities1.length === 0 && entities2.length === 0)
            return 1.0;
        if (entities1.length === 0 || entities2.length === 0)
            return 0.0;
        const set1 = new Set(entities1.map(e => e.text.toLowerCase()));
        const set2 = new Set(entities2.map(e => e.text.toLowerCase()));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
    }
    determineTransitionType(fromContext, toContext) {
        const topicSimilarity = this.calculateTopicSimilarity(fromContext.topic, toContext.topic);
        const entityOverlap = this.calculateEntityOverlap(fromContext.entities, toContext.entities);
        const domainSame = fromContext.domain === toContext.domain;
        if (topicSimilarity > 0.7 && entityOverlap > 0.5)
            return 'smooth';
        if (domainSame && (topicSimilarity > 0.3 || entityOverlap > 0.2))
            return 'related';
        if (topicSimilarity < 0.2 && entityOverlap < 0.1)
            return 'unrelated';
        return 'abrupt';
    }
    async updateTransitionHistory(sessionId, fromContext, toContext) {
        const transitions = this.contextTransitions.get(sessionId) || [];
        const transition = {
            id: this.generateTransitionId(),
            sessionId,
            messageIndex: 0,
            previousContext: fromContext,
            newContext: toContext,
            transitionScore: this.calculateTopicSimilarity(fromContext.topic, toContext.topic),
            adaptationStrategy: this.determineAdaptationStrategy({
                id: '',
                sessionId,
                fromContext,
                toContext,
                trigger: { type: 'topic_drift', confidence: 0.8, evidence: [] },
                timestamp: new Date(),
                confidence: 0.8,
                transitionType: this.determineTransitionType(fromContext, toContext)
            }),
            timestamp: new Date()
        };
        transitions.push(transition);
        this.contextTransitions.set(sessionId, transitions.slice(-20));
    }
    async extractTopics(messages) {
        const topics = [];
        const messageGroups = this.groupMessagesBySimilarity(messages);
        for (const group of messageGroups) {
            const keywords = this.extractKeywords(group);
            const topicName = await this.identifyTopic(group, keywords);
            topics.push({
                id: this.generateTopicId(),
                name: topicName,
                keywords: keywords.slice(0, 5),
                prevalence: group.length / messages.length,
                coherence: 0.8,
                messages: group.map(m => m.content)
            });
        }
        return topics;
    }
    mergeTopics(existingTopics, newTopics) {
        const merged = [...existingTopics];
        for (const newTopic of newTopics) {
            const existingTopic = merged.find(t => this.calculateTopicSimilarity(t.name, newTopic.name) > 0.8);
            if (existingTopic) {
                existingTopic.keywords = [...new Set([...existingTopic.keywords, ...newTopic.keywords])].slice(0, 10);
                existingTopic.messages.push(...newTopic.messages);
                existingTopic.prevalence = (existingTopic.prevalence + newTopic.prevalence) / 2;
            }
            else {
                merged.push(newTopic);
            }
        }
        return merged;
    }
    async updateTopicTransitions(topics, messages) {
        const transitions = [];
        return transitions;
    }
    async getRelevantMessages(sessionId, query, limit) {
        const searchResults = await this.semanticSearch(sessionId, query, limit);
        return searchResults.map(result => ({
            role: result.role,
            content: result.content,
            timestamp: result.timestamp,
            metadata: { relevanceScore: result.relevanceScore }
        }));
    }
    async getContextRelatedMessages(sessionId, context, limit) {
        const query = `${context.topic} ${context.keywords.join(' ')}`;
        return await this.getRelevantMessages(sessionId, query, limit);
    }
    mergeAndDeduplicateMessages(messages) {
        const seen = new Set();
        const unique = [];
        for (const message of messages) {
            const key = `${message.content}_${message.timestamp}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(message);
            }
        }
        return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    groupMessagesBySimilarity(messages) {
        const groups = [];
        const timeWindow = 10 * 60 * 1000;
        let currentGroup = [];
        let lastTimestamp = 0;
        for (const message of messages) {
            const timestamp = new Date(message.timestamp).getTime();
            if (timestamp - lastTimestamp > timeWindow && currentGroup.length > 0) {
                groups.push(currentGroup);
                currentGroup = [];
            }
            currentGroup.push(message);
            lastTimestamp = timestamp;
        }
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }
        return groups;
    }
    generateContextSwitchId() {
        return `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateContextId() {
        return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateTransitionId() {
        return `tr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateTopicId() {
        return `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async getContextSwitchHistory(sessionId) {
        return Array.from(this.contextSwitchCache.values())
            .filter(cs => cs.sessionId === sessionId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 20);
    }
    async getTopicModel(sessionId) {
        return this.topicModelCache.get(sessionId) || null;
    }
    async getContextTransitions(sessionId) {
        return this.contextTransitions.get(sessionId) || [];
    }
    async clearContextSwitchCache(sessionId) {
        const toRemove = Array.from(this.contextSwitchCache.entries())
            .filter(([_, cs]) => cs.sessionId === sessionId)
            .map(([id]) => id);
        toRemove.forEach(id => this.contextSwitchCache.delete(id));
        this.topicModelCache.delete(sessionId);
        this.contextTransitions.delete(sessionId);
        console.log(`🧹 Cleared context switch cache for session ${sessionId}`);
    }
}
exports.MemoryService = MemoryService;
exports.memoryService = new MemoryService();
//# sourceMappingURL=memoryService.js.map