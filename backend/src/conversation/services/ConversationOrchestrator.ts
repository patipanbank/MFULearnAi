/**
 * ConversationOrchestrator
 *
 * ประสานงานระหว่าง WebSocket, LangGraph workflow และ database
 * เป็น main service ที่จัดการ conversation lifecycle ทั้งหมด
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  Conversation,
  ConversationMessage,
  MessageRole,
  MessageStatus,
  ConversationStatus,
  StreamingEvent,
  StreamingEventType,
  CreateConversationRequest,
  SendMessageRequest,
  ErrorCode,
  ErrorDetails
} from '../types';
import { ConversationModel, ConversationMessageModel } from '../models';
import { ConversationGraph } from '../workflow';
import { ConversationWebSocket } from '../websocket';

export class ConversationOrchestrator extends EventEmitter {
  private conversationGraph: ConversationGraph;
  private webSocketService: ConversationWebSocket | null = null;
  private activeConversations: Map<string, any> = new Map();

  constructor() {
    super();
    this.conversationGraph = new ConversationGraph();
    this.setupEventHandlers();
    console.log('🎭 ConversationOrchestrator initialized');
  }

  // ============= INITIALIZATION =============

  public setWebSocketService(webSocketService: ConversationWebSocket): void {
    this.webSocketService = webSocketService;
    this.setupWebSocketHandlers();
  }

  private setupEventHandlers(): void {
    // Listen to workflow events
    this.conversationGraph.on('workflow_event', (event: StreamingEvent) => {
      this.handleWorkflowEvent(event);
    });
  }

  private setupWebSocketHandlers(): void {
    if (!this.webSocketService) return;

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

  // ============= CONVERSATION MANAGEMENT =============

  /**
   * สร้าง conversation ใหม่
   */
  public async createConversation(
    userId: string,
    request: CreateConversationRequest
  ): Promise<Conversation> {
    console.log(`🎭 Creating conversation for user ${userId}`);

    try {
      const conversationId = uuidv4();

      // Create conversation document
      const conversation = new ConversationModel({
        id: conversationId,
        userId,
        title: request.title || 'New Conversation',
        status: ConversationStatus.ACTIVE,
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

    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      throw new Error(`Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ดึง conversation
   */
  public async getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
    try {
      const conversation = await ConversationModel.findOne({
        id: conversationId,
        userId
      });

      return conversation ? conversation.toObject() : null;
    } catch (error) {
      console.error('❌ Error getting conversation:', error);
      return null;
    }
  }

  /**
   * ดึง conversation messages
   */
  public async getConversationMessages(
    conversationId: string,
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ConversationMessage[]> {
    try {
      // Verify user has access to conversation
      const conversation = await this.getConversation(conversationId, userId);
      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      const messages = await ConversationMessageModel.findByConversationId(
        conversationId,
        {
          limit: options.limit || 50,
          skip: options.offset || 0,
          includeToolCalls: true
        }
      );

      return messages.map(msg => msg.toObject());
    } catch (error) {
      console.error('❌ Error getting conversation messages:', error);
      throw error;
    }
  }

  // ============= MESSAGE PROCESSING =============

  /**
   * ส่งข้อความและเริ่ม workflow
   */
  public async sendMessage(
    conversationId: string,
    userId: string,
    request: SendMessageRequest
  ): Promise<ConversationMessage> {
    console.log(`🎭 Processing message for conversation ${conversationId}`);

    try {
      // Verify conversation access
      const conversation = await this.getConversation(conversationId, userId);
      if (!conversation) {
        throw this.createError(ErrorCode.PERMISSION_DENIED, 'Conversation not found or access denied');
      }

      if (conversation.status !== ConversationStatus.ACTIVE) {
        throw this.createError(ErrorCode.INVALID_INPUT, 'Conversation is not active');
      }

      // Create user message
      const userMessage = await this.createMessage(conversationId, {
        role: MessageRole.USER,
        content: request.content,
        attachments: request.attachments,
        metadata: {
          userId,
          ...request.metadata
        }
      });

      // Create assistant message (initially empty)
      const assistantMessage = await this.createMessage(conversationId, {
        role: MessageRole.ASSISTANT,
        content: '',
        metadata: {
          userId,
          agentId: conversation.agentId,
          modelId: conversation.modelId
        }
      });

      // Broadcast user message
      this.broadcastMessage(conversationId, userMessage);

      // Broadcast assistant message (streaming placeholder)
      this.broadcastMessage(conversationId, {
        ...assistantMessage,
        status: MessageStatus.STREAMING
      });

      // Start workflow processing
      this.processWithWorkflow(conversationId, userMessage, assistantMessage, conversation);

      return userMessage;

    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  /**
   * จัดการข้อความจาก WebSocket
   */
  private async handleWebSocketMessage(data: {
    connectionId: string;
    userId: string;
    conversationId: string;
    message: any;
    timestamp: Date;
  }): Promise<void> {
    try {
      console.log(`📨 WebSocket message from ${data.userId} in conversation ${data.conversationId}`);

      await this.sendMessage(data.conversationId, data.userId, {
        content: data.message.content || data.message.text || '',
        attachments: data.message.attachments || data.message.images || []
      });

    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error);

      // Send error back to client
      if (this.webSocketService) {
        this.webSocketService.sendToConnection(data.connectionId, {
          type: 'error',
          conversationId: data.conversationId,
          data: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Failed to process message'
          },
          success: false,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // ============= WORKFLOW PROCESSING =============

  /**
   * ประมวลผลด้วย LangGraph workflow
   */
  private async processWithWorkflow(
    conversationId: string,
    userMessage: ConversationMessage,
    assistantMessage: ConversationMessage,
    conversation: Conversation
  ): Promise<void> {
    try {
      console.log(`🔄 Starting workflow for conversation ${conversationId}`);

      // Mark conversation as active
      this.activeConversations.set(conversationId, {
        userMessage,
        assistantMessage,
        conversation,
        startTime: new Date()
      });

      // Run the workflow
      await this.conversationGraph.runConversation(
        conversationId,
        userMessage,
        conversation.configuration
      );

    } catch (error) {
      console.error('❌ Workflow processing failed:', error);

      // Update assistant message with error
      await this.updateMessageStatus(assistantMessage.id, MessageStatus.FAILED, {
        code: ErrorCode.WORKFLOW_ERROR,
        message: error instanceof Error ? error.message : 'Workflow processing failed',
        timestamp: new Date(),
        retryable: true
      });

      // Broadcast error
      this.broadcastStreamingEvent(conversationId, {
        type: StreamingEventType.MESSAGE_FAILED,
        conversationId,
        messageId: assistantMessage.id,
        data: { error: 'Processing failed' },
        timestamp: new Date()
      });

    } finally {
      // Clean up active conversation
      this.activeConversations.delete(conversationId);
    }
  }

  // ============= EVENT HANDLING =============

  /**
   * จัดการ workflow events
   */
  private async handleWorkflowEvent(event: StreamingEvent): Promise<void> {
    const activeConversation = this.activeConversations.get(event.conversationId);
    if (!activeConversation) return;

    try {
      switch (event.type) {
        case StreamingEventType.MESSAGE_CHUNK:
          await this.handleMessageChunk(event, activeConversation);
          break;

        case StreamingEventType.MESSAGE_COMPLETED:
          await this.handleMessageCompleted(event, activeConversation);
          break;

        case StreamingEventType.MESSAGE_FAILED:
          await this.handleMessageFailed(event, activeConversation);
          break;

        case StreamingEventType.TOOL_STARTED:
        case StreamingEventType.TOOL_COMPLETED:
        case StreamingEventType.TOOL_FAILED:
          await this.handleToolEvent(event, activeConversation);
          break;

        default:
          // Forward other events to WebSocket
          this.broadcastStreamingEvent(event.conversationId, event);
      }
    } catch (error) {
      console.error('❌ Error handling workflow event:', error);
    }
  }

  private async handleMessageChunk(event: StreamingEvent, activeConversation: any): Promise<void> {
    const { assistantMessage } = activeConversation;
    const chunk = event.data.chunk || '';

    // Update message content
    const currentContent = await this.getMessageContent(assistantMessage.id);
    const newContent = currentContent + chunk;

    await this.updateMessageContent(assistantMessage.id, newContent);

    // Broadcast chunk
    this.broadcastStreamingEvent(event.conversationId, event);
  }

  private async handleMessageCompleted(event: StreamingEvent, activeConversation: any): Promise<void> {
    const { assistantMessage } = activeConversation;

    // Update message status
    await this.updateMessageStatus(assistantMessage.id, MessageStatus.COMPLETED);

    // Update conversation stats
    await this.updateConversationStats(event.conversationId);

    // Broadcast completion
    this.broadcastStreamingEvent(event.conversationId, event);
  }

  private async handleMessageFailed(event: StreamingEvent, activeConversation: any): Promise<void> {
    const { assistantMessage } = activeConversation;

    // Update message status with error
    await this.updateMessageStatus(assistantMessage.id, MessageStatus.FAILED, {
      code: ErrorCode.LLM_ERROR,
      message: event.data.error || 'Message processing failed',
      timestamp: new Date(),
      retryable: true
    });

    // Broadcast failure
    this.broadcastStreamingEvent(event.conversationId, event);
  }

  private async handleToolEvent(event: StreamingEvent, activeConversation: any): Promise<void> {
    const { assistantMessage } = activeConversation;

    // Update message with tool information
    if (event.type === StreamingEventType.TOOL_STARTED) {
      await this.addToolCallToMessage(assistantMessage.id, {
        name: event.data.toolName,
        input: event.data.input,
        status: 'running',
        startTime: new Date()
      });
    } else if (event.type === StreamingEventType.TOOL_COMPLETED) {
      await this.updateToolCallInMessage(assistantMessage.id, event.data.toolName, {
        output: event.data.output,
        status: 'completed',
        endTime: new Date()
      });
    } else if (event.type === StreamingEventType.TOOL_FAILED) {
      await this.updateToolCallInMessage(assistantMessage.id, event.data.toolName, {
        status: 'failed',
        error: event.data.error,
        endTime: new Date()
      });
    }

    // Broadcast tool event
    this.broadcastStreamingEvent(event.conversationId, event);
  }

  // ============= DATABASE OPERATIONS =============

  private async createMessage(
    conversationId: string,
    messageData: Partial<ConversationMessage>
  ): Promise<ConversationMessage> {
    const message = new ConversationMessageModel({
      id: uuidv4(),
      conversationId,
      ...messageData,
      status: MessageStatus.PENDING
    });

    await message.save();
    return message.toObject();
  }

  private async updateMessageContent(messageId: string, content: string): Promise<void> {
    await ConversationMessageModel.updateOne(
      { id: messageId },
      { content, updatedAt: new Date() }
    );
  }

  private async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    error?: ErrorDetails
  ): Promise<void> {
    const updateData: any = { status, updatedAt: new Date() };

    if (error) {
      updateData['metadata.errorDetails'] = error;
    }

    if (status === MessageStatus.COMPLETED) {
      updateData['metadata.processingTime'] = Date.now() - (await this.getMessageCreatedTime(messageId));
    }

    await ConversationMessageModel.updateOne({ id: messageId }, updateData);
  }

  private async addToolCallToMessage(messageId: string, toolCall: any): Promise<void> {
    const message = await ConversationMessageModel.findOne({ id: messageId });
    if (message) {
      message.addToolCall(toolCall);
      await message.save();
    }
  }

  private async updateToolCallInMessage(messageId: string, toolName: string, updates: any): Promise<void> {
    const message = await ConversationMessageModel.findOne({ id: messageId });
    if (message && message.toolCalls) {
      const toolCall = message.toolCalls.find(tc => tc.name === toolName);
      if (toolCall) {
        Object.assign(toolCall, updates);
        await message.save();
      }
    }
  }

  // ============= BROADCASTING =============

  private broadcastMessage(conversationId: string, message: ConversationMessage): void {
    if (!this.webSocketService) return;

    this.webSocketService.broadcastToRoom(conversationId, {
      type: 'message_added',
      conversationId,
      messageId: message.id,
      data: { message },
      success: true,
      timestamp: new Date().toISOString()
    });
  }

  private broadcastStreamingEvent(conversationId: string, event: StreamingEvent): void {
    if (!this.webSocketService) return;

    this.webSocketService.broadcastToRoom(conversationId, {
      type: event.type,
      conversationId,
      messageId: event.messageId,
      data: event.data,
      success: true,
      timestamp: new Date().toISOString()
    });
  }

  // ============= UTILITY METHODS =============

  private async getMessageContent(messageId: string): Promise<string> {
    const message = await ConversationMessageModel.findOne({ id: messageId }, 'content');
    return message?.content || '';
  }

  private async getMessageCreatedTime(messageId: string): Promise<number> {
    const message = await ConversationMessageModel.findOne({ id: messageId }, 'createdAt');
    return message?.createdAt.getTime() || Date.now();
  }

  private async updateConversationStats(conversationId: string): Promise<void> {
    try {
      const stats = await ConversationMessageModel.getMessageStats(conversationId);
      if (stats.length > 0) {
        const stat = stats[0];
        await ConversationModel.updateOne(
          { id: conversationId },
          {
            'metadata.messageCount': stat.totalMessages,
            'metadata.totalTokens': stat.totalTokens,
            'metadata.averageResponseTime': stat.averageProcessingTime,
            lastMessageAt: new Date(),
            updatedAt: new Date()
          }
        );
      }
    } catch (error) {
      console.error('❌ Error updating conversation stats:', error);
    }
  }

  private createError(code: ErrorCode, message: string): Error {
    const error = new Error(message);
    (error as any).code = code;
    return error;
  }

  // ============= PUBLIC API =============

  public async getUserConversations(userId: string): Promise<Conversation[]> {
    try {
      const conversations = await ConversationModel.findByUserId(userId, {
        limit: 50
      });
      return conversations.map(conv => conv.toObject());
    } catch (error) {
      console.error('❌ Error getting user conversations:', error);
      return [];
    }
  }

  public async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    try {
      // Delete messages first
      await ConversationMessageModel.deleteMany({ conversationId });

      // Delete conversation
      const result = await ConversationModel.deleteOne({ id: conversationId, userId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      return false;
    }
  }

  public getStats(): any {
    return {
      activeConversations: this.activeConversations.size,
      webSocketStats: this.webSocketService?.getStats() || null
    };
  }

  // ============= CLEANUP =============

  public async shutdown(): Promise<void> {
    console.log('🎭 Shutting down ConversationOrchestrator...');

    // Clean up active conversations
    this.activeConversations.clear();

    // Shutdown workflow
    this.conversationGraph.cleanup();

    // Remove listeners
    this.removeAllListeners();

    console.log('🎭 ConversationOrchestrator shutdown complete');
  }
}