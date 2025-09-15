import { ChatModel, Chat, ChatMessage } from '../models/chat';
import { wsManager } from '../utils/websocketManager';
import { agentService } from './agentService';
import { usageService } from './usageService';
import { getLLM } from '../agent/llmFactory';
import { toolRegistry, createMemoryTool, createRetrievalTools, ToolFunction } from '../agent/toolRegistry';
import { createPromptTemplate } from '../agent/promptFactory';
import { createAgent } from '../agent/agentFactory';
import { redis } from '../lib/redis';
import { smartMemoryService } from './smartMemoryService';
import { chromaService } from './chromaService';
import { storageService } from './storageService';

export class ChatService {
  constructor() {
    console.log('✅ Chat service initialized');
  }

  // Cache agent executors per session/config to reduce recreation overhead
  private agentCache: Map<string, {
    signature: string;
    executor: any; // AgentExecutor compatible
  }> = new Map();

  public async createChat(userId: string, name: string, agentId?: string): Promise<Chat> {
    const chat = new ChatModel({
      userId,
      name,
      messages: [],
      agentId,
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await chat.save();
    console.log(`✅ Created chat session ${chat._id} for user ${userId}`);
    return chat;
  }

  public async getChat(chatId: string, userId: string): Promise<Chat | null> {
    console.log(`🔍 Looking for chat: ${chatId} for user: ${userId}`);
    
    const chat = await ChatModel.findOne({ _id: chatId, userId });
    
    if (chat) {
      console.log(`✅ Found chat: ${chatId}`);
    } else {
      console.log(`❌ Chat not found: ${chatId}`);
      // Let's also check if the chat exists without user filter
      const chatWithoutUser = await ChatModel.findById(chatId);
      if (chatWithoutUser) {
        console.log(`⚠️ Chat exists but belongs to user: ${chatWithoutUser.userId}`);
      } else {
        console.log(`❌ Chat doesn't exist in database: ${chatId}`);
      }
    }
    
    return chat;
  }

  public async addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    // Generate unique message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check for duplicate messages (avoid double creation)
    const isDuplicate = chat.messages.some(msg =>
      msg.role === message.role &&
      msg.content === message.content &&
      Math.abs(new Date().getTime() - msg.timestamp.getTime()) < 5000 // Within 5 seconds
    );

    if (isDuplicate) {
      console.log(`⚠️ Duplicate message detected and skipped for chat ${chatId}`);
      return chat.messages[chat.messages.length - 1]; // Return the existing message
    }

    const newMessage: ChatMessage = {
      id: messageId,
      ...message,
      timestamp: new Date()
    };

    chat.messages.push(newMessage);
    chat.updatedAt = new Date();
    await chat.save();

    console.log(`✅ Added message to session ${chatId}:`, messageId);

    return newMessage;
  }

  /**
   * ดึงรูปภาพจาก MinIO และแปลงเป็น base64 สำหรับ multimodal API
   */
  private async prepareImagesForMultimodal(images?: Array<{ url: string; mediaType: string }>): Promise<Array<{ url: string; mediaType: string; base64Data?: string }>> {
    if (!images || images.length === 0) {
      return [];
    }

    const preparedImages: Array<{ url: string; mediaType: string; base64Data?: string }> = [];
    
    const maxImageSize = 10 * 1024 * 1024; // 10MB limit for vision processing
    const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    console.log(`🖼️ Preparing ${images.length} images for vision processing...`);

    for (const [index, image] of images.entries()) {
      try {
        console.log(`🖼️ Processing image ${index + 1}/${images.length}: ${image.url.substring(0, 50)}...`);

        // Validate image format
        if (!supportedFormats.includes(image.mediaType)) {
          console.warn(`⚠️ Unsupported image format: ${image.mediaType}`);
          preparedImages.push({
            ...image,
            base64Data: undefined,
            error: `Unsupported format: ${image.mediaType}. Supported: JPEG, PNG, GIF, WebP`
          } as any);
          continue;
        }

        // ดึงไฟล์จาก MinIO และแปลงเป็น base64
        const base64Data = await storageService.getFileAsBase64(image.url);

        if (base64Data) {
          // Check file size
          const base64Size = base64Data.data.length * 0.75; // Approximate size from base64
          if (base64Size > maxImageSize) {
            const sizeInMB = (base64Size / 1024 / 1024).toFixed(1);
            console.warn(`⚠️ Image too large for vision processing: ${sizeInMB}MB`);
            preparedImages.push({
              ...image,
              base64Data: undefined,
              error: `Image too large: ${sizeInMB}MB (max 10MB)`
            } as any);
            continue;
          }

          preparedImages.push({
            ...image,
            base64Data: base64Data.data,
            mediaType: base64Data.mediaType || image.mediaType
          });
          console.log(`✅ Image ${index + 1} prepared successfully: ${base64Data.mediaType}, size: ${Math.round(base64Data.data.length / 1024)}KB`);
        } else {
          console.warn(`⚠️ Failed to prepare image ${index + 1}: ${image.url}`);
          preparedImages.push({
            ...image,
            base64Data: undefined,
            error: 'Failed to load image'
          } as any);
        }
      } catch (error: any) {
        console.error(`❌ Error preparing image ${index + 1} (${image.url}):`, error.message);
        preparedImages.push({
          ...image,
          base64Data: undefined,
          error: error.message || 'Unknown error'
        } as any);
      }
    }

    const successCount = preparedImages.filter(img => img.base64Data).length;
    console.log(`📊 Vision preparation complete: ${successCount}/${images.length} images ready for processing`);

    return preparedImages;
  }

  /**
   * ✨ NEW SIMPLIFIED MESSAGE PROCESSING ✨
   * - Backend เป็นผู้จัดการทั้งหมด
   * - Single source of truth (Database)
   * - Clean WebSocket events
   */
  public async processMessage(chatId: string, userId: string, content: string, images?: Array<{ url: string; mediaType: string }>): Promise<void> {
    console.log(`🚀 [NEW] processMessage: chat=${chatId}, user=${userId}`);
    console.log(`🚀 Content: "${content.substring(0, 50)}...", Images: ${images?.length || 0}`);

    try {
      // Step 1: Save user message to database FIRST
      console.log(`💾 Step 1: Saving user message to database...`);
      const userMessage = await this.addMessage(chatId, {
        role: 'user',
        content,
        images
      });

      // Step 2: Notify frontend about new user message
      console.log(`📡 Step 2: Notifying frontend about user message...`);
      this.broadcastToChat(chatId, {
        type: 'message_added',
        data: {
          message: {
            id: userMessage.id,
            role: 'user',
            content: userMessage.content,
            timestamp: userMessage.timestamp.toISOString(),
            images: userMessage.images
          }
        }
      });

      // Step 3: Create empty assistant message
      console.log(`🤖 Step 3: Creating assistant message...`);
      const assistantMessage = await this.addMessage(chatId, {
        role: 'assistant',
        content: '' // Empty initially
      });

      // Step 4: Notify frontend about new assistant message
      console.log(`📡 Step 4: Notifying frontend about assistant message...`);
      this.broadcastToChat(chatId, {
        type: 'message_added',
        data: {
          message: {
            id: assistantMessage.id,
            role: 'assistant',
            content: '',
            timestamp: assistantMessage.timestamp.toISOString(),
            isStreaming: true
          }
        }
      });

      // Step 5: Process with AI (using existing LangChain Agent system)
      console.log(`🤖 Step 5: Processing with AI...`);
      await this.processWithAISimple(chatId, assistantMessage.id, content, images, userId);

    } catch (error) {
      console.error('❌ Error in processMessage:', error);
      this.broadcastToChat(chatId, {
        type: 'error',
        data: { message: 'Failed to process message' }
      });
    }
  }

  /**
   * Simplified broadcast helper
   */
  private broadcastToChat(chatId: string, data: any): void {
    if (wsManager.getSessionConnectionCount(chatId) > 0) {
      wsManager.broadcastToSession(chatId, JSON.stringify(data));
    }
  }

  /**
   * ✨ NEW SIMPLIFIED AI PROCESSING ✨
   * - ใช้ LangChain Agent ที่มีอยู่
   * - ทำงานกับ existing agent system
   * - เรียบง่ายและชัดเจน
   */
  private async processWithAISimple(
    chatId: string,
    assistantMessageId: string,
    userContent: string,
    images?: Array<{ url: string; mediaType: string }>,
    userId?: string
  ): Promise<void> {
    try {
      console.log(`🤖 processWithAISimple: chatId=${chatId}, assistantId=${assistantMessageId}`);

      // Get chat and agent configuration
      const chat = await ChatModel.findById(chatId);
      if (!chat) {
        throw new Error(`Chat not found: ${chatId}`);
      }

      // Prepare agent configuration
      let agentConfig = null;
      let modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
      let collectionNames: string[] = [];
      let systemPrompt = "You are a helpful assistant. Use tools when appropriate.";
      let temperature = 0.7;
      let maxTokens = 4000;

      if (chat.agentId) {
        try {
          agentConfig = await agentService.getAgentById(chat.agentId);
          if (agentConfig) {
            modelId = agentConfig.modelId;
            collectionNames = agentConfig.collectionNames || [];
            systemPrompt = agentConfig.systemPrompt || systemPrompt;
            temperature = agentConfig.temperature || 0.7;
            maxTokens = agentConfig.maxTokens || 4000;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to get agent config:`, error);
        }
      }

      // Create/reuse LangChain agent using existing system
      console.log(`🔧 Setting up LangChain agent...`);
      const llm = getLLM(modelId, {
        temperature,
        maxTokens,
        streaming: true
      });

      // Setup tools using existing system
      const sessionTools = createMemoryTool(chatId);
      const allTools: { [name: string]: ToolFunction } = {};

      // Add registry tools
      for (const [k, v] of Object.entries(toolRegistry)) {
        allTools[k] = v.func;
      }

      // Add session tools
      for (const [k, v] of Object.entries(sessionTools)) {
        allTools[k] = v.func;
      }

      // Add retrieval tools if collections specified
      if (collectionNames && collectionNames.length > 0) {
        const retrievalTools = createRetrievalTools(collectionNames);
        for (const [name, tool] of Object.entries(retrievalTools)) {
          allTools[name] = (tool as any).func;
        }
      }

      const agent = await createAgent(llm, allTools, systemPrompt, {
        modelId,
        sessionId: chatId,
        temperature,
        maxTokens
      });

      // Get chat history for context
      const chatHistory = chat.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        id: msg.id,
        timestamp: msg.timestamp
      }));

      // Prepare images if any
      let preparedImages: Array<{ url: string; mediaType: string; base64Data?: string }> = [];
      if (images && images.length > 0) {
        console.log(`🖼️ Preparing ${images.length} images...`);
        preparedImages = await this.prepareImagesForMultimodal(images);
      }

      // Track streaming content
      let fullContent = '';

      // Process with agent
      console.log(`🚀 Starting agent.run...`);
      await agent.run(chatHistory, {
        images: preparedImages.filter(img => img.base64Data),
        onEvent: async (event: { type: string; data?: any }) => {
          console.log(`📡 Agent event: ${event.type}`);

          if (event.type === 'chunk') {
            const chunkContent = String(event.data || '');
            fullContent += chunkContent;

            // Update database in real-time
            await this.updateMessageContent(chatId, assistantMessageId, fullContent);

            // Broadcast streaming update
            this.broadcastToChat(chatId, {
              type: 'message_updated',
              data: {
                messageId: assistantMessageId,
                content: fullContent,
                isStreaming: true
              }
            });

          } else if (event.type === 'tool_start') {
            this.broadcastToChat(chatId, {
              type: 'tool_start',
              data: {
                messageId: assistantMessageId,
                toolName: event.data.tool_name,
                toolInput: event.data.tool_input
              }
            });

          } else if (event.type === 'tool_result') {
            this.broadcastToChat(chatId, {
              type: 'tool_result',
              data: {
                messageId: assistantMessageId,
                toolName: event.data.tool_name,
                result: event.data.output
              }
            });

          } else if (event.type === 'end') {
            const finalContent = String(event.data.answer || fullContent);

            // Final update to database
            await this.updateMessageContent(chatId, assistantMessageId, finalContent);

            // Mark as completed
            this.broadcastToChat(chatId, {
              type: 'message_completed',
              data: {
                messageId: assistantMessageId,
                content: finalContent
              }
            });

            // Update usage if provided
            if (userId && (event.data.inputTokens || event.data.outputTokens)) {
              await usageService.updateUsage(
                userId,
                event.data.inputTokens || 0,
                event.data.outputTokens || 0
              );
            }

            console.log(`✅ AI processing completed for message ${assistantMessageId}`);
          }
        },
        maxSteps: 5
      });

    } catch (error) {
      console.error('❌ Error in processWithAISimple:', error);
      const errorMessage = error instanceof Error ? error.message : 'AI processing failed';

      // Mark message as failed
      await this.updateMessageContent(
        chatId,
        assistantMessageId,
        `[Error: ${errorMessage}]`
      );

      this.broadcastToChat(chatId, {
        type: 'message_error',
        data: {
          messageId: assistantMessageId,
          error: errorMessage
        }
      });
    }
  }

  /**
   * Helper to update message content in database
   */
  private async updateMessageContent(chatId: string, messageId: string, content: string): Promise<void> {
    await ChatModel.updateOne(
      { _id: chatId, 'messages.id': messageId },
      {
        $set: {
          'messages.$.content': content,
          updatedAt: new Date()
        }
      }
    );
  }

  public async getUserChats(userId: string): Promise<Chat[]> {
    const chats = await ChatModel.find({ userId })
      .sort({ updatedAt: -1 })
      .exec();

    return chats;
  }

  public async deleteChat(chatId: string, userId: string): Promise<boolean> {
    const result = await ChatModel.deleteOne({ _id: chatId, userId });
    const success = result.deletedCount > 0;
    
    if (success) {
      console.log(`✅ Deleted chat ${chatId} for user ${userId}`);
      // Also clear associated memory (Redis + Chroma vectorstore)
      try {
        await smartMemoryService.clearSession(chatId);
        console.log(`🧹 Cleared memory for deleted chat ${chatId}`);
      } catch (err) {
        console.warn(`⚠️ Failed to clear memory for deleted chat ${chatId}:`, err);
      }
    } else {
      console.log(`❌ Failed to delete chat ${chatId} for user ${userId}`);
    }
    
    return success;
  }

  public async updateChatName(chatId: string, userId: string, name: string): Promise<Chat | null> {
    const chat = await ChatModel.findOneAndUpdate(
      { _id: chatId, userId },
      { name, updatedAt: new Date() },
      { new: true }
    );

    if (chat) {
      console.log(`📝 Updated chat name for session ${chatId}: ${name}`);
    }
    
    return chat;
  }

  public async updateChatPinStatus(chatId: string, userId: string, isPinned: boolean): Promise<Chat | null> {
    const chat = await ChatModel.findOneAndUpdate(
      { _id: chatId, userId },
      { isPinned, updatedAt: new Date() },
      { new: true }
    );

    if (chat) {
      console.log(`📌 Updated pin status for session ${chatId}: ${isPinned}`);
    }
    
    return chat;
  }

  public async clearChatMemory(chatId: string): Promise<void> {
    try {
      // Clear all memory using smart approach
      await smartMemoryService.clearSession(chatId);
      
      
      console.log(`✅ Memory cleared for chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to clear memory for chat ${chatId}:`, error);
    }
  }

  private shouldUseMemoryTool(messageCount: number): boolean {
    // Use memory tool when there are more than 10 messages (เหมือน Legacy)
    return messageCount > 10;
  }

  private shouldUseRedisMemory(messageCount: number): boolean {
    // Always use Redis memory for recent conversations (เหมือน Legacy)
    return true;
  }

  private shouldEmbedMessages(messageCount: number): boolean {
    // Embed messages every 10 messages (10, 20, 30, etc.) - เหมือน Legacy
    return messageCount % 10 === 0;
  }

  public getStats(): any {
    return {
      totalChats: 0, // TODO: Implement actual stats
      activeSessions: 0, // TODO: Implement active session count
      totalMessages: 0
    };
  }
}

export const chatService = new ChatService(); 