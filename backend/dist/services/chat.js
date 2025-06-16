"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatService = void 0;
const bedrock_1 = require("./bedrock");
const Model_1 = require("../models/Model");
const Chat_1 = require("../models/Chat");
const usageService_1 = require("./usageService");
const ChatStats_1 = require("../models/ChatStats");
const SystemPrompt_1 = require("../models/SystemPrompt");
const tools_1 = require("./tools");
const Collection_1 = require("../models/Collection");
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
    async *sendMessage(messages, modelId, userId) {
        try {
            // Get the model and its collections
            const model = await Model_1.ModelModel.findById(modelId);
            if (!model) {
                yield { type: 'error', data: 'Model not found' };
                return;
            }
            // Get system prompt
            const systemPrompt = await this.getSystemPrompt();
            // Update daily stats
            await this.updateDailyStats(userId);
            // Create tools array
            const tools = await this.createToolsForModel(model);
            // Prepare messages for Bedrock
            const conversationMessages = messages.map(msg => ({
                role: msg.role,
                content: [{ text: msg.content }]
            }));
            // Start the Agent Loop
            yield* this.agentLoop(conversationMessages, systemPrompt, tools, userId);
        }
        catch (error) {
            console.error('Error in sendMessage:', error);
            yield { type: 'error', data: 'An error occurred while processing your message.' };
        }
    }
    async createToolsForModel(model) {
        const tools = [];
        // Add KnowledgeTool if model has collections
        if (model.collections && model.collections.length > 0) {
            const knowledgeTool = new KnowledgeToolForModel(model.collections.map(c => c.name));
            tools.push(knowledgeTool);
        }
        // Always add WebSearchTool
        tools.push(new tools_1.WebSearchTool());
        return tools;
    }
    async *agentLoop(messages, systemPrompt, tools, userId) {
        const toolConfig = tools.length > 0 ? {
            tools: tools.map(tool => ({
                toolSpec: {
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema
                }
            }))
        } : undefined;
        let conversationMessages = [...messages];
        let iterationCount = 0;
        const maxIterations = 10;
        while (iterationCount < maxIterations) {
            iterationCount++;
            try {
                const converseInput = {
                    modelId: bedrock_1.bedrockService.chatModel,
                    messages: conversationMessages,
                    system: [{ text: systemPrompt }],
                    toolConfig,
                    inferenceConfig: {
                        maxTokens: 4096,
                        temperature: 0.7,
                        topP: 0.9
                    }
                };
                // Stream the response
                const responseStream = bedrock_1.bedrockService.converseStream(converseInput);
                let currentContent = '';
                let toolUseBlocks = [];
                for await (const chunk of responseStream) {
                    if (chunk.contentBlockDelta?.delta?.text) {
                        const textDelta = chunk.contentBlockDelta.delta.text;
                        currentContent += textDelta;
                        yield { type: 'content', data: textDelta };
                    }
                    else if (chunk.contentBlockStart?.start?.toolUse) {
                        toolUseBlocks.push(chunk.contentBlockStart.start.toolUse);
                    }
                    else if (chunk.contentBlockDelta?.delta?.toolUse) {
                        const lastToolUse = toolUseBlocks[toolUseBlocks.length - 1];
                        if (lastToolUse) {
                            lastToolUse.input = { ...lastToolUse.input, ...chunk.contentBlockDelta.delta.toolUse.input };
                        }
                    }
                }
                // Add assistant's response to conversation
                const assistantMessage = { role: 'assistant', content: [] };
                if (currentContent) {
                    assistantMessage.content.push({ text: currentContent });
                }
                if (toolUseBlocks.length > 0) {
                    assistantMessage.content.push(...toolUseBlocks.map(toolUse => ({ toolUse })));
                }
                conversationMessages.push(assistantMessage);
                // If no tool use, we're done
                if (toolUseBlocks.length === 0) {
                    // Update usage tracking
                    await usageService_1.usageService.updateTokenUsage(userId, currentContent.length);
                    break;
                }
                // Execute tools and add results
                const toolResults = [];
                for (const toolUse of toolUseBlocks) {
                    const tool = tools.find(t => t.name === toolUse.name);
                    if (tool) {
                        yield { type: 'tool_use', data: `Using ${tool.name}...` };
                        const result = await tool.execute(toolUse.input);
                        toolResults.push({
                            toolUseId: toolUse.toolUseId,
                            content: [{ text: JSON.stringify(result) }]
                        });
                    }
                }
                // Add tool results to conversation
                conversationMessages.push({
                    role: 'user',
                    content: toolResults.map(result => ({ toolResult: result }))
                });
            }
            catch (error) {
                console.error('Error in agent loop iteration:', error);
                yield { type: 'error', data: 'An error occurred during processing.' };
                break;
            }
        }
        if (iterationCount >= maxIterations) {
            yield { type: 'error', data: 'Maximum iterations reached.' };
        }
    }
    async getSystemPrompt() {
        const prompt = await SystemPrompt_1.SystemPrompt.findOne();
        if (prompt) {
            return prompt.prompt;
        }
        const defaultPrompt = `You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.

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
        return defaultPrompt;
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
}
// Create a specialized KnowledgeTool that only searches specific collections
class KnowledgeToolForModel extends tools_1.KnowledgeTool {
    constructor(allowedCollections) {
        super();
        this.allowedCollections = allowedCollections;
    }
    async selectRelevantCollections(query) {
        // Override to only search in allowed collections
        const allCollections = await Collection_1.CollectionModel.find({
            name: { $in: this.allowedCollections },
            $and: [
                { summary: { $ne: null } },
                { summary: { $ne: '' } }
            ]
        }).lean();
        if (allCollections.length <= 3) {
            return allCollections;
        }
        const collectionsString = allCollections
            .map(c => `  - ${c.name} (ID: ${c._id}): ${c.summary}`)
            .join('\\n');
        const prompt = `You are an AI routing agent. Select the most relevant data collections for the user's query. User Query: "${query}". Available Collections:\\n${collectionsString}\\n\\nRespond with a JSON object containing a list of collection names, like this: { "collections": ["collection_name_1", "collection_name_2"] }`;
        try {
            const response = await bedrock_1.bedrockService.invokeModelJSON(prompt);
            if (response && Array.isArray(response.collections)) {
                console.log('L2 Router selected collections:', response.collections);
                return allCollections.filter(c => response.collections.includes(c.name));
            }
            return allCollections;
        }
        catch (error) {
            console.error('Error in L2 collection selection:', error);
            return allCollections;
        }
    }
}
exports.chatService = new ChatService();
// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
    // console.log('Debug message');
}
