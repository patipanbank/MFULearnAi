"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = void 0;
const bedrock_1 = require("./bedrock");
const chroma_1 = require("./chroma");
const Model_1 = require("../models/Model");
const Chat_1 = require("../models/Chat");
const usage_service_1 = require("./usage.service");
const ChatStats_1 = require("../models/ChatStats");
const webSearch_1 = require("./webSearch");
const SystemPrompt_1 = require("../models/SystemPrompt");
class ChatService {
    constructor() {
        this.questionTypes = {
            FACTUAL: 'factual',
            ANALYTICAL: 'analytical',
            CONCEPTUAL: 'conceptual',
            PROCEDURAL: 'procedural',
            CLARIFICATION: 'clarification'
        };
        this.systemPrompt = `You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.

  Response Style 🎯:
  - Be concise, friendly and conversational
  - Always respond in the same language the user is using
  - Use appropriate emojis to make responses engaging
  - Never say "I don't know" or "I'm not sure"
  - Always provide answers using your knowledge and reasoning
  - Break down complex topics into clear steps
  - Use markdown formatting effectively
  
  Knowledge Approach 📚:
  - Use provided context first, then general knowledge
  - Can analyze images, read files, search web
  - Provide step-by-step solutions for issues
  - Cite sources when referencing specific information
  - For MFU questions without specific data, provide helpful general information
  
  Remember: Keep responses friendly, use emojis, answer every question positively without refusing, and maintain a conversational tone.`;
        this.promptTemplates = {
            [this.questionTypes.FACTUAL]: 'Provide a direct and accurate answer based on the following context:',
            [this.questionTypes.ANALYTICAL]: 'Analyze the following information and provide insights:',
            [this.questionTypes.CONCEPTUAL]: 'Explain the concept using the following context:',
            [this.questionTypes.PROCEDURAL]: 'Describe the process or steps based on:',
            [this.questionTypes.CLARIFICATION]: 'To better answer your question, let me clarify based on:'
        };
        this.chatModel = bedrock_1.bedrockService.chatModel;
        this.BATCH_SIZE = 3; // Number of collections to query simultaneously
        this.MIN_SIMILARITY_THRESHOLD = 0.1; // Lowered from 0.6 to match ChromaService
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 5000
        };
    }
    // You are DinDin, a male AI. Keep responses brief and to the point.
    isRelevantQuestion(query) {
        return true;
    }
    /**
     * Sanitizes a collection name by replacing invalid characters.
     * Here we replace any colon (:) with a hyphen (-) to conform to ChromaDB's requirements.
     */
    sanitizeCollectionName(name) {
        return name.replace(/:/g, '-');
    }
    /**
     * Gets collection names for a model ID or returns the collection names if directly provided
     */
    async resolveCollections(modelIdOrCollections) {
        try {
            if (Array.isArray(modelIdOrCollections)) {
                // console.log('Collections provided directly:', modelIdOrCollections);
                return modelIdOrCollections;
            }
            // console.log('Looking up model by ID:', modelIdOrCollections);
            const model = await Model_1.ModelModel.findById(modelIdOrCollections);
            if (!model) {
                console.error('Model not found:', modelIdOrCollections);
                return [];
            }
            // console.log('Found model:', {
            //   id: model._id,
            //   name: model.name,
            //   collections: model.collections
            // });
            return model.collections;
        }
        catch (error) {
            console.error('Error resolving collections:', error);
            return [];
        }
    }
    async processBatch(batch, queryEmbedding, imageEmbedding) {
        return Promise.all(batch.map(async (name) => {
            try {
                const queryResult = await chroma_1.chromaService.queryDocumentsWithEmbedding(name, imageEmbedding || queryEmbedding, 4);
                if (!queryResult?.documents || !queryResult?.metadatas) {
                    return { context: '', sources: [] };
                }
                const results = queryResult.documents
                    .map((doc, index) => ({
                    text: doc,
                    metadata: queryResult.metadatas[index],
                    similarity: 1 - (queryResult.distances?.[index] || 0)
                }));
                // กำหนดค่า threshold ที่สามารถปรับได้ตามความเหมาะสม
                // ค่าสูงขึ้นหมายถึงกรองเฉพาะข้อมูลที่เกี่ยวข้องมากขึ้น
                const MIN_SIMILARITY_THRESHOLD = 0.1; // เพิ่มจาก 0.1 เป็น 0.3
                const filteredResults = results
                    .filter(result => result.similarity >= MIN_SIMILARITY_THRESHOLD)
                    .sort((a, b) => b.similarity - a.similarity);
                const sources = filteredResults.map(result => ({
                    modelId: result.metadata.modelId,
                    collectionName: name,
                    filename: result.metadata.filename,
                    similarity: result.similarity
                }));
                // เพิ่ม logging เพื่อตรวจสอบ
                // console.log('Filtered results:', {
                //   name,
                //   resultCount: filteredResults.length,
                //   context: filteredResults.map(r => r.text).join("\n\n")
                // });
                return {
                    context: filteredResults.map(r => r.text).join("\n\n"),
                    sources
                };
            }
            catch (error) {
                console.error(`Error querying collection ${name}:`, error);
                return { context: '', sources: [] };
            }
        }));
    }
    detectQuestionType(query) {
        const patterns = {
            [this.questionTypes.FACTUAL]: /^(what|when|where|who|which|how many|how much)/i,
            [this.questionTypes.ANALYTICAL]: /^(why|how|what if|what are the implications|analyze|compare|contrast)/i,
            [this.questionTypes.CONCEPTUAL]: /^(explain|describe|define|what is|what are|how does)/i,
            [this.questionTypes.PROCEDURAL]: /^(how to|how do|what steps|how can|show me how)/i,
            [this.questionTypes.CLARIFICATION]: /^(can you clarify|what do you mean|please explain|could you elaborate)/i
        };
        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(query)) {
                return type;
            }
        }
        return this.questionTypes.FACTUAL; // Default to factual if no pattern matches
    }
    async getContext(query, modelIdOrCollections, imageBase64) {
        const questionType = this.detectQuestionType(query);
        const promptTemplate = this.promptTemplates[questionType];
        const collectionNames = await this.resolveCollections(modelIdOrCollections);
        let context = '';
        // ดึงข้อมูลจาก collections ก่อน
        if (collectionNames.length > 0) {
            const sanitizedCollections = collectionNames.map(name => this.sanitizeCollectionName(name));
            const truncatedQuery = query.slice(0, 512);
            let queryEmbedding = await chroma_1.chromaService.getQueryEmbedding(truncatedQuery);
            let imageEmbedding;
            if (imageBase64) {
                try {
                    imageEmbedding = await bedrock_1.bedrockService.embedImage(imageBase64, truncatedQuery);
                }
                catch (error) {
                    console.error('Error generating image embedding:', error);
                }
            }
            const batches = this.createBatches(sanitizedCollections, this.BATCH_SIZE);
            let allResults = [];
            for (const batch of batches) {
                const batchResults = await this.processBatch(batch, queryEmbedding, imageEmbedding);
                allResults = allResults.concat(batchResults);
            }
            // ประมวลผลข้อมูลจาก collections
            context = this.processResults(allResults);
        }
        // แก้ไขส่วนนี้: ใช้เฉพาะคำถามล่าสุดในการค้นหาเว็บ
        const lastQuestion = query.split('\n').pop() || query;
        try {
            const webResults = await webSearch_1.webSearchService.searchWeb(lastQuestion);
            if (webResults) {
                if (context) {
                    context += '\n\nAdditional supporting information:\n' + webResults;
                }
                else {
                    context = 'Based on web search results:\n' + webResults;
                }
            }
        }
        catch (error) {
            console.error('Error fetching web results:', error);
        }
        return `${promptTemplate}\n\n${context}`;
    }
    summarizeOldMessages(messages) {
        if (messages.length <= 0) {
            return '';
        }
        // Create a concise summary of the older messages
        const summary = messages.map(msg => {
            const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
            const content = msg.content.length > 100
                ? `${msg.content.substring(0, 97)}...`
                : msg.content;
            return `${role}: ${content}`;
        }).join('\n');
        return `Previous conversation summary:\n${summary}`;
    }
    async updateDailyStats(userId) {
        try {
            // สร้างวันที่ปัจจุบันในโซนเวลาไทย (UTC+7)
            const today = new Date();
            today.setHours(today.getHours() + 7); // แปลงเป็นเวลาไทย
            today.setHours(0, 0, 0, 0); // รีเซ็ตเวลาเป็นต้นวัน
            const stats = await ChatStats_1.ChatStats.findOneAndUpdate({ date: today }, {
                $addToSet: { uniqueUsers: userId },
                $inc: { totalChats: 1 }
            }, {
                upsert: true,
                new: true
            });
            // console.log(`Updated daily stats for ${userId}:`, {
            //   date: today.toISOString(),
            //   uniqueUsers: stats.uniqueUsers.length,
            //   totalChats: stats.totalChats
            // });
        }
        catch (error) {
            console.error('Error updating daily stats:', error);
        }
    }
    async getSystemPrompt() {
        try {
            const promptDoc = await SystemPrompt_1.SystemPrompt.findOne().sort({ updatedAt: -1 });
            return promptDoc ? promptDoc.prompt : this.systemPrompt;
        }
        catch (error) {
            console.error('Error fetching system prompt, using default:', error);
            return this.systemPrompt;
        }
    }
    async *generateResponse(messages, query, modelIdOrCollections, userId) {
        try {
            // console.log("Starting generateResponse with:", modelIdOrCollections);
            const lastMessage = messages[messages.length - 1];
            const isImageGeneration = lastMessage.isImageGeneration;
            // Dynamically determine message limit based on message length
            const MAX_CHAR_THRESHOLD = 500; // Define threshold for "long" messages
            const DEFAULT_MESSAGE_LIMIT = 6;
            const LONG_MESSAGE_LIMIT = 2;
            // Calculate average message length
            const avgMessageLength = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) / Math.max(1, messages.length);
            // Set message limit based on average length
            const MESSAGE_LIMIT = avgMessageLength > MAX_CHAR_THRESHOLD
                ? LONG_MESSAGE_LIMIT
                : DEFAULT_MESSAGE_LIMIT;
            let recentMessages = [];
            let olderMessages = [];
            if (messages.length > MESSAGE_LIMIT) {
                // Split messages into older and recent messages
                olderMessages = messages.slice(0, messages.length - MESSAGE_LIMIT);
                recentMessages = messages.slice(messages.length - MESSAGE_LIMIT);
            }
            else {
                recentMessages = [...messages];
            }
            // Skip context retrieval for image generation
            let context = '';
            if (!isImageGeneration) {
                const imageBase64 = lastMessage.images?.[0]?.data;
                try {
                    // Ensure query doesn't exceed reasonable length
                    const MAX_QUERY_FOR_CONTEXT = 4000;
                    const trimmedQuery = query.length > MAX_QUERY_FOR_CONTEXT
                        ? query.substring(0, MAX_QUERY_FOR_CONTEXT)
                        : query;
                    context = await this.retryOperation(async () => this.getContext(trimmedQuery, modelIdOrCollections, imageBase64), 'Failed to get context');
                }
                catch (error) {
                    console.error('Error getting context:', error);
                    // Continue without context if there's an error
                }
            }
            // console.log('Retrieved context length:', context.length);
            const questionType = isImageGeneration ? 'imageGeneration' : this.detectQuestionType(query);
            // console.log('Question type:', questionType);
            // ดึง system prompt จากฐานข้อมูล
            const dynamicSystemPrompt = await this.getSystemPrompt();
            const systemMessages = [
                {
                    role: 'system',
                    content: isImageGeneration ?
                        'You are an expert at generating detailed image descriptions. Create vivid, detailed descriptions that can be used to generate images.' :
                        dynamicSystemPrompt
                }
            ];
            // Add summary of older messages if there are any
            if (olderMessages.length > 0) {
                systemMessages.push({
                    role: 'system',
                    content: this.summarizeOldMessages(olderMessages)
                });
            }
            // Only add context if we have it and not in image generation mode
            if (context && !isImageGeneration) {
                systemMessages.push({
                    role: 'system',
                    content: `Context from documents:\n${context}`
                });
            }
            // Combine system messages with recent user messages only
            const augmentedMessages = [...systemMessages, ...recentMessages];
            // นับจำนวนข้อความทั้งหมดในการสนทนานี้
            const messageCount = messages.length + 1; // รวมข้อความใหม่ด้วย
            // อัพเดทสถิติพร้อมจำนวนข้อความ
            await this.updateDailyStats(userId);
            let attempt = 0;
            while (attempt < this.retryConfig.maxRetries) {
                try {
                    // ตรวจสอบว่ามีไฟล์หรือไม่
                    const hasFiles = lastMessage.files && lastMessage.files.length > 0;
                    // ถ้ามีไฟล์ ให้สร้างข้อความพิเศษบอก AI ว่ามีไฟล์แนบมา
                    if (hasFiles && lastMessage.files) {
                        const fileInfo = lastMessage.files.map(file => {
                            let fileDetail = `- ${file.name} (${file.mediaType}, ${Math.round(file.size / 1024)} KB)`;
                            if (file.content) {
                                fileDetail += " - File content included";
                            }
                            return fileDetail;
                        }).join('\n');
                        // เพิ่มข้อความเกี่ยวกับไฟล์แนบในคำถาม
                        query = `${query}\n\n[Attached files]\n${fileInfo}`;
                    }
                    // Generate response and send chunks
                    let totalTokens = 0;
                    for await (const chunk of bedrock_1.bedrockService.chat(augmentedMessages, isImageGeneration ? bedrock_1.bedrockService.models.titanImage : bedrock_1.bedrockService.chatModel)) {
                        if (typeof chunk === 'string') {
                            yield chunk;
                        }
                    }
                    // อัพเดท token usage หลังจากได้ response ทั้งหมด
                    totalTokens = bedrock_1.bedrockService.getLastTokenUsage();
                    if (totalTokens > 0) {
                        const usage = await usage_service_1.usageService.updateTokenUsage(userId, totalTokens);
                        console.log(`[Chat] Token usage updated for ${userId}:`, {
                            used: totalTokens,
                            daily: usage.dailyTokens,
                            remaining: usage.remainingTokens
                        });
                        // อัปเดตข้อมูล token ในสถิติรายวัน
                        const today = new Date();
                        today.setHours(today.getHours() + 7); // แปลงเป็นเวลาไทย
                        today.setHours(0, 0, 0, 0); // รีเซ็ตเวลาเป็นต้นวัน
                        await ChatStats_1.ChatStats.findOneAndUpdate({ date: today }, { $inc: { totalTokens: totalTokens } }, { upsert: true });
                    }
                    return;
                }
                catch (error) {
                    attempt++;
                    if (error instanceof Error && error.name === 'InvalidSignatureException') {
                        console.error(`Error in chat generation (Attempt ${attempt}/${this.retryConfig.maxRetries}):`, error);
                        // รอสักครู่ก่อน retry
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                    throw error;
                }
            }
        }
        catch (error) {
            console.error('Error generating response:', error);
            throw error;
        }
    }
    async retryOperation(operation, errorMessage) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                console.error(`${errorMessage} (Attempt ${attempt}/${this.retryConfig.maxRetries}):`, error);
                if (attempt < this.retryConfig.maxRetries) {
                    const delay = Math.min(this.retryConfig.baseDelay * Math.pow(2, attempt - 1), this.retryConfig.maxDelay);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw new Error(`${errorMessage} after ${this.retryConfig.maxRetries} attempts: ${lastError?.message}`);
    }
    async getChats(userId, page = 1, limit = 5) {
        const skip = (page - 1) * limit;
        const chats = await Chat_1.Chat.find({ userId })
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = await Chat_1.Chat.countDocuments({ userId });
        const totalPages = Math.ceil(total / limit);
        const hasMore = page < totalPages;
        return { chats, totalPages, hasMore };
    }
    isValidObjectId(id) {
        if (!id)
            return false;
        return /^[0-9a-fA-F]{24}$/.test(id);
    }
    async getChat(userId, chatId) {
        try {
            if (!this.isValidObjectId(chatId)) {
                throw new Error('Invalid chat ID format');
            }
            const chat = await Chat_1.Chat.findOne({ _id: chatId, userId });
            if (!chat) {
                throw new Error('Chat not found');
            }
            return chat;
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Invalid chat ID format') {
                    throw error;
                }
                if (error.message === 'Chat not found') {
                    throw error;
                }
                console.error('Error getting chat:', error);
                throw new Error('Failed to get chat');
            }
            throw error;
        }
    }
    async saveChat(userId, modelId, messages) {
        try {
            // บันทึกสถิติก่อนที่จะบันทึกแชท
            await this.updateDailyStats(userId);
            // หาข้อความแรกของ user
            const firstUserMessage = messages.find(msg => msg.role === 'user');
            const chatname = firstUserMessage ? firstUserMessage.content.substring(0, 50) : 'Untitled Chat';
            const lastMessage = messages[messages.length - 1];
            const name = lastMessage.content.substring(0, 50);
            const processedMessages = messages.map(msg => ({
                ...msg,
                timestamp: msg.timestamp?.$date ? new Date(msg.timestamp.$date) : new Date(),
                images: msg.images || [],
                sources: msg.sources || [],
                isImageGeneration: msg.isImageGeneration || false,
                isComplete: msg.isComplete || false
            }));
            const chat = new Chat_1.Chat({
                userId,
                modelId,
                chatname,
                name,
                messages: processedMessages
            });
            await chat.save();
            return chat;
        }
        catch (error) {
            console.error('Error saving chat:', error);
            throw error;
        }
    }
    async updateChat(chatId, userId, messages) {
        try {
            if (!this.isValidObjectId(chatId)) {
                throw new Error('Invalid chat ID format');
            }
            const chat = await Chat_1.Chat.findOneAndUpdate({ _id: chatId, userId }, {
                $set: {
                    name: messages[messages.length - 1].content.substring(0, 50),
                    messages: messages.map(msg => ({
                        ...msg,
                        timestamp: msg.timestamp?.$date ? new Date(msg.timestamp.$date) : new Date(),
                        images: msg.images || [],
                        sources: msg.sources || [],
                        isImageGeneration: msg.isImageGeneration || false,
                        isComplete: msg.isComplete || false
                    }))
                }
            }, { new: true });
            if (!chat) {
                throw new Error('Chat not found');
            }
            return chat;
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Invalid chat ID format') {
                    throw error;
                }
                if (error.message === 'Chat not found') {
                    throw error;
                }
                console.error('Error updating chat:', error);
                throw new Error('Failed to update chat');
            }
            throw error;
        }
    }
    async deleteChat(chatId, userId) {
        try {
            if (!this.isValidObjectId(chatId)) {
                throw new Error('Invalid chat ID format');
            }
            const result = await Chat_1.Chat.deleteOne({ _id: chatId, userId });
            if (result.deletedCount === 0) {
                throw new Error('Chat not found or unauthorized');
            }
            return true;
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Invalid chat ID format') {
                    throw error;
                }
                if (error.message === 'Chat not found or unauthorized') {
                    throw error;
                }
                console.error('Error deleting chat:', error);
                throw new Error('Failed to delete chat');
            }
            throw error;
        }
    }
    async togglePinChat(chatId, userId) {
        const chat = await Chat_1.Chat.findOne({ _id: chatId, userId });
        if (!chat) {
            throw new Error('Chat not found');
        }
        chat.isPinned = !chat.isPinned;
        await chat.save();
        return chat;
    }
    // เพิ่มฟังก์ชันใหม่สำหรับประมวลผลข้อมูล
    processResults(results) {
        const MIN_COLLECTION_SIMILARITY = 0.4;
        const contexts = results
            .filter(r => {
            if (r.sources.length === 0)
                return false;
            const maxSimilarity = Math.max(...r.sources.map(s => s.similarity));
            return maxSimilarity >= MIN_COLLECTION_SIMILARITY;
        })
            .sort((a, b) => {
            const aMaxSim = Math.max(...a.sources.map(s => s.similarity));
            const bMaxSim = Math.max(...b.sources.map(s => s.similarity));
            return bMaxSim - aMaxSim;
        })
            .map(r => r.context);
        const MAX_CONTEXT_LENGTH = 6000;
        let context = '';
        for (const result of contexts) {
            if (result && result.length > 0) {
                let resultToAdd = result;
                if (resultToAdd.length > MAX_CONTEXT_LENGTH) {
                    resultToAdd = resultToAdd.substring(0, MAX_CONTEXT_LENGTH);
                    const lastPeriodIndex = resultToAdd.lastIndexOf('.');
                    const lastNewlineIndex = resultToAdd.lastIndexOf('\n');
                    const lastBreakIndex = Math.max(lastPeriodIndex, lastNewlineIndex);
                    if (lastBreakIndex > MAX_CONTEXT_LENGTH * 0.8) {
                        resultToAdd = resultToAdd.substring(0, lastBreakIndex + 1);
                    }
                }
                if (context.length + resultToAdd.length > MAX_CONTEXT_LENGTH) {
                    break;
                }
                context += resultToAdd + '\n';
            }
        }
        return context;
    }
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
}
exports.chatService = new ChatService();
// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
    // console.log('Debug message');
}
