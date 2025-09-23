"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationOrchestrator = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const types_1 = require("../types");
const models_1 = require("../models");
const workflow_1 = require("../workflow");
class ConversationOrchestrator extends events_1.EventEmitter {
    constructor() {
        super();
        this.webSocketService = null;
        this.activeConversations = new Map();
        this.conversationGraph = new workflow_1.ConversationGraph();
        this.setupEventHandlers();
        console.log('🎭 ConversationOrchestrator initialized');
    }
    setWebSocketService(webSocketService) {
        this.webSocketService = webSocketService;
        this.setupWebSocketHandlers();
    }
    setupEventHandlers() {
        this.conversationGraph.on('workflow_event', (event) => {
            this.handleWorkflowEvent(event);
        });
    }
    setupWebSocketHandlers() {
        if (!this.webSocketService)
            return;
        this.webSocketService.on('message_received', async (data) => {
            await this.handleWebSocketMessage(data);
        });
        this.webSocketService.on('connection_established', (data) => {
            console.log(`🔌 Connection established: ${data.connectionId} for user ${data.userId}`);
        });
        this.webSocketService.on('connection_closed', (data) => {
            console.log(`🔌 Connection closed: ${data.connectionId}`);
        });
    }
    async createConversation(userId, request) {
        console.log(`🎭 Creating conversation for user ${userId}`);
        try {
            const conversationId = (0, uuid_1.v4)();
            const conversation = new models_1.ConversationModel({
                id: conversationId,
                userId,
                title: request.title || 'New Conversation',
                status: types_1.ConversationStatus.ACTIVE,
                agentId: request.agentId,
                modelId: request.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
                configuration: {
                    temperature: 0.7,
                    maxTokens: 4000,
                    collectionNames: [],
                    enabledTools: ['web_search', 'calculator', 'current_date'],
                    memorySettings: {
                        shortTermEnabled: true,
                        longTermEnabled: true,
                        embeddingEnabled: true,
                        maxShortTermMessages: 10,
                        embeddingThreshold: 10,
                        contextWindow: 4000
                    },
                    streamingEnabled: true,
                    autoSave: true,
                    timeoutMs: 60000,
                    ...request.configuration
                }
            });
            await conversation.save();
            console.log(`✅ Conversation created: ${conversationId}`);
            return conversation.toObject();
        }
        catch (error) {
            console.error('❌ Error creating conversation:', error);
            throw new Error(`Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getConversation(conversationId, userId) {
        try {
            const conversation = await models_1.ConversationModel.findOne({
                id: conversationId,
                userId
            });
            return conversation ? conversation.toObject() : null;
        }
        catch (error) {
            console.error('❌ Error getting conversation:', error);
            return null;
        }
    }
    async getConversationMessages(conversationId, userId, options = {}) {
        try {
            const conversation = await this.getConversation(conversationId, userId);
            if (!conversation) {
                throw new Error('Conversation not found or access denied');
            }
            const messages = await models_1.ConversationMessageModel.findByConversationId(conversationId, {
                limit: options.limit || 50,
                skip: options.offset || 0,
                includeToolCalls: true
            });
            return messages.map(msg => msg.toObject());
        }
        catch (error) {
            console.error('❌ Error getting conversation messages:', error);
            throw error;
        }
    }
    async sendMessage(conversationId, userId, request) {
        console.log(`🎭 Processing message for conversation ${conversationId}`);
        try {
            const conversation = await this.getConversation(conversationId, userId);
            if (!conversation) {
                throw this.createError(types_1.ErrorCode.PERMISSION_DENIED, 'Conversation not found or access denied');
            }
            if (conversation.status !== types_1.ConversationStatus.ACTIVE) {
                throw this.createError(types_1.ErrorCode.INVALID_INPUT, 'Conversation is not active');
            }
            const userMessage = await this.createMessage(conversationId, {
                role: types_1.MessageRole.USER,
                content: request.content,
                attachments: request.attachments,
                metadata: {
                    userId,
                    ...request.metadata
                }
            });
            const assistantMessage = await this.createMessage(conversationId, {
                role: types_1.MessageRole.ASSISTANT,
                content: '',
                metadata: {
                    userId,
                    agentId: conversation.agentId,
                    modelId: conversation.modelId
                }
            });
            this.broadcastMessage(conversationId, userMessage);
            this.broadcastMessage(conversationId, {
                ...assistantMessage,
                status: types_1.MessageStatus.STREAMING
            });
            this.processWithWorkflow(conversationId, userMessage, assistantMessage, conversation);
            return userMessage;
        }
        catch (error) {
            console.error('❌ Error sending message:', error);
            throw error;
        }
    }
    async handleWebSocketMessage(data) {
        try {
            console.log(`📨 WebSocket message from ${data.userId} in conversation ${data.conversationId}`);
            await this.sendMessage(data.conversationId, data.userId, {
                content: data.message.content || data.message.text || '',
                attachments: data.message.attachments || data.message.images || []
            });
        }
        catch (error) {
            console.error('❌ Error handling WebSocket message:', error);
            if (this.webSocketService) {
                this.webSocketService.sendToConnection(data.connectionId, {
                    type: 'error',
                    conversationId: data.conversationId,
                    data: {
                        code: types_1.ErrorCode.INTERNAL_ERROR,
                        message: 'Failed to process message'
                    },
                    success: false,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }
    async processWithWorkflow(conversationId, userMessage, assistantMessage, conversation) {
        try {
            console.log(`🔄 Starting workflow for conversation ${conversationId}`);
            this.activeConversations.set(conversationId, {
                userMessage,
                assistantMessage,
                conversation,
                startTime: new Date()
            });
            await this.conversationGraph.runConversation(conversationId, userMessage, conversation.configuration);
        }
        catch (error) {
            console.error('❌ Workflow processing failed:', error);
            await this.updateMessageStatus(assistantMessage.id, types_1.MessageStatus.FAILED, {
                code: types_1.ErrorCode.WORKFLOW_ERROR,
                message: error instanceof Error ? error.message : 'Workflow processing failed',
                timestamp: new Date(),
                retryable: true
            });
            this.broadcastStreamingEvent(conversationId, {
                type: types_1.StreamingEventType.MESSAGE_FAILED,
                conversationId,
                messageId: assistantMessage.id,
                data: { error: 'Processing failed' },
                timestamp: new Date()
            });
        }
        finally {
            this.activeConversations.delete(conversationId);
        }
    }
    async handleWorkflowEvent(event) {
        const activeConversation = this.activeConversations.get(event.conversationId);
        if (!activeConversation)
            return;
        try {
            switch (event.type) {
                case types_1.StreamingEventType.MESSAGE_CHUNK:
                    await this.handleMessageChunk(event, activeConversation);
                    break;
                case types_1.StreamingEventType.MESSAGE_COMPLETED:
                    await this.handleMessageCompleted(event, activeConversation);
                    break;
                case types_1.StreamingEventType.MESSAGE_FAILED:
                    await this.handleMessageFailed(event, activeConversation);
                    break;
                case types_1.StreamingEventType.TOOL_STARTED:
                case types_1.StreamingEventType.TOOL_COMPLETED:
                case types_1.StreamingEventType.TOOL_FAILED:
                    await this.handleToolEvent(event, activeConversation);
                    break;
                default:
                    this.broadcastStreamingEvent(event.conversationId, event);
            }
        }
        catch (error) {
            console.error('❌ Error handling workflow event:', error);
        }
    }
    async handleMessageChunk(event, activeConversation) {
        const { assistantMessage } = activeConversation;
        const chunk = event.data.chunk || '';
        const currentContent = await this.getMessageContent(assistantMessage.id);
        const newContent = currentContent + chunk;
        await this.updateMessageContent(assistantMessage.id, newContent);
        this.broadcastStreamingEvent(event.conversationId, event);
    }
    async handleMessageCompleted(event, activeConversation) {
        const { assistantMessage } = activeConversation;
        await this.updateMessageStatus(assistantMessage.id, types_1.MessageStatus.COMPLETED);
        await this.updateConversationStats(event.conversationId);
        this.broadcastStreamingEvent(event.conversationId, event);
    }
    async handleMessageFailed(event, activeConversation) {
        const { assistantMessage } = activeConversation;
        await this.updateMessageStatus(assistantMessage.id, types_1.MessageStatus.FAILED, {
            code: types_1.ErrorCode.LLM_ERROR,
            message: event.data.error || 'Message processing failed',
            timestamp: new Date(),
            retryable: true
        });
        this.broadcastStreamingEvent(event.conversationId, event);
    }
    async handleToolEvent(event, activeConversation) {
        const { assistantMessage } = activeConversation;
        if (event.type === types_1.StreamingEventType.TOOL_STARTED) {
            await this.addToolCallToMessage(assistantMessage.id, {
                name: event.data.toolName,
                input: event.data.input,
                status: 'running',
                startTime: new Date()
            });
        }
        else if (event.type === types_1.StreamingEventType.TOOL_COMPLETED) {
            await this.updateToolCallInMessage(assistantMessage.id, event.data.toolName, {
                output: event.data.output,
                status: 'completed',
                endTime: new Date()
            });
        }
        else if (event.type === types_1.StreamingEventType.TOOL_FAILED) {
            await this.updateToolCallInMessage(assistantMessage.id, event.data.toolName, {
                status: 'failed',
                error: event.data.error,
                endTime: new Date()
            });
        }
        this.broadcastStreamingEvent(event.conversationId, event);
    }
    async createMessage(conversationId, messageData) {
        const message = new models_1.ConversationMessageModel({
            id: (0, uuid_1.v4)(),
            conversationId,
            ...messageData,
            status: types_1.MessageStatus.PENDING
        });
        await message.save();
        return message.toObject();
    }
    async updateMessageContent(messageId, content) {
        await models_1.ConversationMessageModel.updateOne({ id: messageId }, { content, updatedAt: new Date() });
    }
    async updateMessageStatus(messageId, status, error) {
        const updateData = { status, updatedAt: new Date() };
        if (error) {
            updateData['metadata.errorDetails'] = error;
        }
        if (status === types_1.MessageStatus.COMPLETED) {
            updateData['metadata.processingTime'] = Date.now() - (await this.getMessageCreatedTime(messageId));
        }
        await models_1.ConversationMessageModel.updateOne({ id: messageId }, updateData);
    }
    async addToolCallToMessage(messageId, toolCall) {
        const message = await models_1.ConversationMessageModel.findOne({ id: messageId });
        if (message) {
            message.addToolCall(toolCall);
            await message.save();
        }
    }
    async updateToolCallInMessage(messageId, toolName, updates) {
        const message = await models_1.ConversationMessageModel.findOne({ id: messageId });
        if (message && message.toolCalls) {
            const toolCall = message.toolCalls.find(tc => tc.name === toolName);
            if (toolCall) {
                Object.assign(toolCall, updates);
                await message.save();
            }
        }
    }
    broadcastMessage(conversationId, message) {
        if (!this.webSocketService)
            return;
        this.webSocketService.broadcastToRoom(conversationId, {
            type: 'message_added',
            conversationId,
            messageId: message.id,
            data: { message },
            success: true,
            timestamp: new Date().toISOString()
        });
    }
    broadcastStreamingEvent(conversationId, event) {
        if (!this.webSocketService)
            return;
        this.webSocketService.broadcastToRoom(conversationId, {
            type: event.type,
            conversationId,
            messageId: event.messageId,
            data: event.data,
            success: true,
            timestamp: new Date().toISOString()
        });
    }
    async getMessageContent(messageId) {
        const message = await models_1.ConversationMessageModel.findOne({ id: messageId }, 'content');
        return message?.content || '';
    }
    async getMessageCreatedTime(messageId) {
        const message = await models_1.ConversationMessageModel.findOne({ id: messageId }, 'createdAt');
        return message?.createdAt?.getTime() || Date.now();
    }
    async updateConversationStats(conversationId) {
        try {
            const stats = await models_1.ConversationMessageModel.getMessageStats?.(conversationId) || [];
            if (stats.length > 0) {
                const stat = stats[0];
                await models_1.ConversationModel.updateOne({ id: conversationId }, {
                    'metadata.messageCount': stat.totalMessages,
                    'metadata.totalTokens': stat.totalTokens,
                    'metadata.averageResponseTime': stat.averageProcessingTime,
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                });
            }
        }
        catch (error) {
            console.error('❌ Error updating conversation stats:', error);
        }
    }
    createError(code, message) {
        const error = new Error(message);
        error.code = code;
        return error;
    }
    async getUserConversations(userId) {
        try {
            const conversations = await models_1.ConversationModel.findByUserId?.(userId, {
                limit: 50
            }) || [];
            return conversations.map((conv) => conv.toObject?.() || conv);
        }
        catch (error) {
            console.error('❌ Error getting user conversations:', error);
            return [];
        }
    }
    async deleteConversation(conversationId, userId) {
        try {
            await models_1.ConversationMessageModel.deleteMany({ conversationId });
            const result = await models_1.ConversationModel.deleteOne({ id: conversationId, userId });
            return result.deletedCount > 0;
        }
        catch (error) {
            console.error('❌ Error deleting conversation:', error);
            return false;
        }
    }
    getStats() {
        return {
            activeConversations: this.activeConversations.size,
            webSocketStats: this.webSocketService?.getStats() || null
        };
    }
    async shutdown() {
        console.log('🎭 Shutting down ConversationOrchestrator...');
        this.activeConversations.clear();
        this.conversationGraph.cleanup();
        this.removeAllListeners();
        console.log('🎭 ConversationOrchestrator shutdown complete');
    }
}
exports.ConversationOrchestrator = ConversationOrchestrator;
//# sourceMappingURL=ConversationOrchestrator.js.map