import { ChatModel, Chat, ChatMessage } from '../models/chat';
import { wsManager } from '../utils/websocketManager';
import axios from 'axios';
import config from '../config/config';

export class ChatService {
  constructor() {
    console.log('✅ Chat service initialized');
  }

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
      return chat.messages[chat.messages.length - 1];
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
   * Prepare images for multimodal processing by fetching from Storage Service
   */
  private async prepareImagesForMultimodal(images?: Array<{ url: string; mediaType: string }>): Promise<Array<{ url: string; mediaType: string; base64Data?: string }>> {
    if (!images || images.length === 0) {
      return [];
    }

    const preparedImages: Array<{ url: string; mediaType: string; base64Data?: string }> = [];

    const maxImageSize = 10 * 1024 * 1024; // 10MB limit
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

        // Fetch image from Storage Service
        const response = await axios.get(`${config.STORAGE_SERVICE_URL}/api/storage/base64`, {
          params: { url: image.url },
          timeout: 10000
        });

        if (response.data && response.data.data) {
          const base64Data = response.data.data;
          const base64Size = base64Data.length * 0.75;

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
            base64Data,
            mediaType: response.data.mediaType || image.mediaType
          });
          console.log(`✅ Image ${index + 1} prepared successfully`);
        } else {
          console.warn(`⚠️ Failed to prepare image ${index + 1}`);
          preparedImages.push({
            ...image,
            base64Data: undefined,
            error: 'Failed to load image'
          } as any);
        }
      } catch (error: any) {
        console.error(`❌ Error preparing image ${index + 1}:`, error.message);
        preparedImages.push({
          ...image,
          base64Data: undefined,
          error: error.message || 'Unknown error'
        } as any);
      }
    }

    const successCount = preparedImages.filter(img => img.base64Data).length;
    console.log(`📊 Vision preparation complete: ${successCount}/${images.length} images ready`);

    return preparedImages;
  }

  /**
   * Process user message with AI agent execution
   */
  public async processMessage(chatId: string, userId: string, content: string, images?: Array<{ url: string; mediaType: string }>): Promise<void> {
    console.log(`🚀 processMessage: chat=${chatId}, user=${userId}`);
    console.log(`🚀 Content: "${content.substring(0, 50)}...", Images: ${images?.length || 0}`);

    try {
      // Step 1: Save user message to database
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
        content: ''
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

      // Step 5: Process with AI via Agent Service
      console.log(`🤖 Step 5: Processing with AI via Agent Service...`);
      await this.processWithAgentService(chatId, assistantMessage.id, content, images, userId);

    } catch (error) {
      console.error('❌ Error in processMessage:', error);
      this.broadcastToChat(chatId, {
        type: 'error',
        data: { message: 'Failed to process message' }
      });
    }
  }

  /**
   * Broadcast helper
   */
  private broadcastToChat(chatId: string, data: any): void {
    if (wsManager.getSessionConnectionCount(chatId) > 0) {
      wsManager.broadcastToSession(chatId, JSON.stringify(data));
    }
  }

  /**
   * Process message via Agent Service HTTP API
   */
  private async processWithAgentService(
    chatId: string,
    assistantMessageId: string,
    userContent: string,
    images?: Array<{ url: string; mediaType: string }>,
    userId?: string
  ): Promise<void> {
    try {
      console.log(`🚀 processWithAgentService: chatId=${chatId}, assistantId=${assistantMessageId}`);

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

      // Fetch agent config from Agent Service if agentId exists
      if (chat.agentId) {
        try {
          const agentResponse = await axios.get(
            `${config.AGENT_SERVICE_URL}/api/agents/${chat.agentId}`,
            { timeout: 5000 }
          );

          if (agentResponse.data) {
            agentConfig = agentResponse.data;
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

      // Prepare images if any
      let preparedImages: Array<{ url: string; mediaType: string; base64Data?: string }> = [];
      if (images && images.length > 0) {
        console.log(`🖼️ Preparing ${images.length} images...`);
        preparedImages = await this.prepareImagesForMultimodal(images);
      }

      // Create execution request
      const executionRequest = {
        chatId,
        userId: userId || 'unknown',
        agentId: chat.agentId,
        userContent,
        images: preparedImages.filter(img => img.base64Data),
        modelId,
        temperature,
        maxTokens,
        collectionNames,
        systemPrompt,
        chatHistory: chat.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          id: msg.id,
          timestamp: msg.timestamp
        }))
      };

      // Call Agent Service execution endpoint
      console.log(`📡 Calling Agent Service execution API...`);
      const response = await axios.post(
        `${config.AGENT_SERVICE_URL}/api/agents/execute`,
        executionRequest,
        {
          timeout: 60000, // 60 second timeout
          responseType: 'stream'
        }
      );

      // Handle streaming response
      let fullContent = '';

      response.data.on('data', async (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.replace('data: ', ''));

            if (data.type === 'chunk') {
              const chunkContent = String(data.data || '');
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

            } else if (data.type === 'tool_start') {
              this.broadcastToChat(chatId, {
                type: 'tool_start',
                data: {
                  messageId: assistantMessageId,
                  toolName: data.data.tool_name,
                  toolInput: data.data.tool_input
                }
              });

            } else if (data.type === 'tool_result') {
              this.broadcastToChat(chatId, {
                type: 'tool_result',
                data: {
                  messageId: assistantMessageId,
                  toolName: data.data.tool_name,
                  result: data.data.output
                }
              });

            } else if (data.type === 'end') {
              const finalContent = String(data.data.answer || fullContent);

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

              console.log(`✅ AI processing completed for message ${assistantMessageId}`);
            }
          } catch (parseError) {
            console.error('❌ Error parsing SSE data:', parseError);
          }
        }
      });

      response.data.on('error', async (error: Error) => {
        console.error('❌ Stream error:', error);
        await this.updateMessageContent(
          chatId,
          assistantMessageId,
          `[Error: ${error.message}]`
        );

        this.broadcastToChat(chatId, {
          type: 'message_error',
          data: {
            messageId: assistantMessageId,
            error: error.message
          }
        });
      });

    } catch (error) {
      console.error('❌ Error in processWithAgentService:', error);
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
   * Update message content in database
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
      // Clear memory via RAG Service
      try {
        await axios.delete(`${config.RAG_SERVICE_URL}/api/chroma/memory/${chatId}`, {
          timeout: 5000
        });
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
      // Clear memory via RAG Service
      await axios.delete(`${config.RAG_SERVICE_URL}/api/chroma/memory/${chatId}`, {
        timeout: 5000
      });

      console.log(`✅ Memory cleared for chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to clear memory for chat ${chatId}:`, error);
      throw error;
    }
  }

  public getStats(): any {
    return {
      totalChats: 0,
      activeSessions: 0,
      totalMessages: 0
    };
  }
}

export const chatService = new ChatService();
