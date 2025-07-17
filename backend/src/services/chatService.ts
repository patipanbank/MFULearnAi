import { ChatModel, Chat, ChatMessage } from '../models/chat';
import { wsManager } from '../utils/websocketManager';
import { agentService } from './agentService';
import { usageService } from './usageService';

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

    // Ensure content is not empty
    if (!message.content || message.content.trim() === '') {
      message.content = 'กำลังประมวลผล...';
    }

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      ...message,
      timestamp: new Date()
    };

    chat.messages.push(newMessage);
    chat.updatedAt = new Date();
    await chat.save();

    console.log(`✅ Added message to session ${chatId}`);

    return newMessage;
  }

  public async processMessage(chatId: string, userId: string, content: string, images?: Array<{ url: string; mediaType: string }>): Promise<void> {
    try {
      // Add user message
      const userMessage = await this.addMessage(chatId, {
        role: 'user',
        content,
        images
      });

      // Get chat and agent info
      const chat = await ChatModel.findById(chatId);
      if (!chat) {
        throw new Error(`Chat session ${chatId} not found`);
      }

      // Get agent configuration if available
      let agentConfig = null;
      let modelId: string | null = null;
      let collectionNames: string[] = [];
      let systemPrompt: string | null = null;
      let temperature = 0.7;
      let maxTokens = 4000;

      if (chat.agentId) {
        agentConfig = await agentService.getAgentById(chat.agentId);
        if (agentConfig) {
          modelId = agentConfig.modelId;
          collectionNames = agentConfig.collectionNames || [];
          systemPrompt = agentConfig.systemPrompt;
          temperature = agentConfig.temperature;
          maxTokens = agentConfig.maxTokens;
        }
      }

      // Create assistant message with placeholder content
      const assistantMessage = await this.addMessage(chatId, {
        role: 'assistant',
        content: 'กำลังประมวลผล...'
      });

      // Process with AI agent using legacy-style processing
      await this.processWithAILegacy(chatId, assistantMessage.id, content, images, {
        modelId,
        collectionNames,
        systemPrompt,
        temperature,
        maxTokens,
        agentId: chat.agentId
      }, userId);

    } catch (error) {
      console.error('❌ Error processing message:', error);
      
      // Handle validation errors specifically
      if (error instanceof Error && error.message.includes('validation failed')) {
        console.error('Validation error details:', error);
        
        // Try to fix the validation issue by updating the message
        try {
          await ChatModel.updateOne(
            { _id: chatId, 'messages.content': { $exists: false } },
            { $set: { 'messages.$.content': 'กำลังประมวลผล...' } }
          );
        } catch (fixError) {
          console.error('Failed to fix validation error:', fixError);
        }
      }
      
      // Send error to client
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'error',
          data: 'Failed to process message'
        }));
      }
    }
  }

  private async processWithAILegacy(chatId: string, messageId: string, userMessage: string, images?: Array<{ url: string; mediaType: string }>, config?: {
    modelId?: string | null;
    collectionNames?: string[];
    systemPrompt?: string | null;
    temperature?: number;
    maxTokens?: number;
    agentId?: string;
  }, userId?: string): Promise<void> {
    try {
      // Simulate thinking time
      await this.delay(1000);

      // Generate response based on configuration
      const response = this.generateResponse(userMessage, images, config);
      
      // Stream response
      await this.streamResponse(chatId, messageId, response);

      // Calculate tokens and update usage
      const inputTokens = Math.floor(userMessage.length / 4);
      const outputTokens = Math.floor(response.length / 4);
      
      // Update usage statistics if userId is available
      if (userId) {
        await usageService.updateUsage(userId, inputTokens, outputTokens);
      }

      // Mark as complete
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'end',
          data: {
            messageId,
            sessionId: chatId,
            inputTokens,
            outputTokens
          }
        }));
      }
    } catch (error) {
      console.error('❌ Error in AI processing:', error);
      
      // Send error to client
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'error',
          data: 'Failed to process AI response'
        }));
      }
    }
  }





  private async streamResponse(chatId: string, messageId: string, response: string): Promise<void> {
    const words = response.split(' ');
    let fullContent = '';
    
    for (let i = 0; i < words.length; i++) {
      const chunk = (i > 0 ? ' ' : '') + words[i];
      fullContent += chunk;
      
      // Update message content in database
      await ChatModel.updateOne(
        { _id: chatId, 'messages.id': messageId },
        { 
          $set: { 
            'messages.$.content': fullContent,
            updatedAt: new Date()
          }
        }
      );
      
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'chunk',
          data: chunk
        }));
      }

      await this.delay(100);
    }
  }

  private generateResponse(userMessage: string, images?: Array<{ url: string; mediaType: string }>, config?: {
    modelId?: string | null;
    collectionNames?: string[];
    systemPrompt?: string | null;
    temperature?: number;
    maxTokens?: number;
    agentId?: string;
  }): string {
    // Use system prompt if available
    if (config?.systemPrompt) {
      const responses = [
        `ตามที่กำหนดในระบบ: ${config.systemPrompt}\n\nสำหรับคำถาม "${userMessage}" นี่คือคำตอบ:`,
        `ตามแนวทางของ AI Assistant: ${config.systemPrompt}\n\nคำตอบสำหรับ "${userMessage}":`
      ];
      
      const baseResponse = responses[Math.floor(Math.random() * responses.length)];
      return `${baseResponse} ${this.generateDetailedResponse()}`;
    }

    // Default responses
    const responses = [
      `ฉันเข้าใจคำถามของคุณเกี่ยวกับ "${userMessage}" แล้ว นี่คือคำตอบที่ครอบคลุม:`,
      `ขอบคุณสำหรับคำถาม "${userMessage}" ฉันจะอธิบายให้คุณฟัง:`,
      `สำหรับคำถาม "${userMessage}" นี่คือข้อมูลที่เกี่ยวข้อง:`,
      `ฉันได้วิเคราะห์คำถาม "${userMessage}" ของคุณแล้ว และนี่คือสิ่งที่ฉันพบ:`
    ];

    const baseResponse = responses[Math.floor(Math.random() * responses.length)];
    
    if (images && images.length > 0) {
      return `${baseResponse} ฉันเห็นว่าคุณได้แนบรูปภาพมาด้วย ฉันจะวิเคราะห์ทั้งข้อความและรูปภาพเพื่อให้คำตอบที่ครบถ้วนที่สุด. ${this.generateDetailedResponse()}`;
    }

    return `${baseResponse} ${this.generateDetailedResponse()}`;
  }

  private generateDetailedResponse(): string {
    const details = [
      `ข้อมูลนี้จะช่วยให้คุณเข้าใจแนวคิดได้ดีขึ้น และสามารถนำไปประยุกต์ใช้ในสถานการณ์จริงได้.`,
      `หากคุณต้องการข้อมูลเพิ่มเติมหรือมีคำถามอื่นๆ อย่าลังเลที่จะถามได้เลย.`,
      `ฉันหวังว่าคำตอบนี้จะช่วยให้คุณเข้าใจประเด็นนี้ได้ชัดเจนขึ้น.`,
      `หากมีส่วนไหนที่ยังไม่ชัดเจน กรุณาแจ้งให้ฉันทราบเพื่อที่ฉันจะได้อธิบายเพิ่มเติม.`
    ];

    return details[Math.floor(Math.random() * details.length)];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async getUserChats(userId: string): Promise<Chat[]> {
    const chats = await ChatModel.find({ userId })
      .sort({ isPinned: -1, updatedAt: -1 })
      .exec();

    return chats;
  }

  public async deleteChat(chatId: string, userId: string): Promise<boolean> {
    const result = await ChatModel.deleteOne({ _id: chatId, userId });
    const success = result.deletedCount > 0;
    
    if (success) {
      console.log(`🗑️ Deleted chat session ${chatId}`);
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
      console.log(`✏️ Updated chat name for session ${chatId}`);
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
      // Clear Redis memory if available
      console.log(`🧹 Clearing memory for chat ${chatId}`);
      
      // TODO: Implement Redis memory clearing
      // This would require Redis client setup
      
      console.log(`✅ Memory cleared for chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to clear memory for chat ${chatId}:`, error);
    }
  }

  private shouldUseMemoryTool(messageCount: number): boolean {
    // Use memory tool when there are more than 10 messages
    return messageCount > 10;
  }

  private shouldUseRedisMemory(messageCount: number): boolean {
    // Always use Redis memory for recent conversations (last 10 messages)
    return true;
  }

  private shouldEmbedMessages(messageCount: number): boolean {
    // Embed messages every 10 messages (10, 20, 30, etc.)
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