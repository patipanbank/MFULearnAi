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
    return await ChatModel.findOne({ _id: chatId, userId });
  }

  public async addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      throw new Error(`Chat session ${chatId} not found`);
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

      // Send user message to all clients in the session
      // Only broadcast if there are active connections
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'user_message',
          data: {
            message: userMessage,
            sessionId: chatId
          }
        }));
      }

      // Get chat and agent info
      const chat = await ChatModel.findById(chatId);
      if (!chat) {
        throw new Error(`Chat session ${chatId} not found`);
      }

      // Process with AI agent
      await this.processWithAI(chatId, content, images, chat.agentId, userId);

    } catch (error) {
      console.error('❌ Error processing message:', error);
      
      // Send error to client
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'error',
          data: 'Failed to process message'
        }));
      }
    }
  }

  private async processWithAI(chatId: string, userMessage: string, images?: Array<{ url: string; mediaType: string }>, agentId?: string, userId?: string): Promise<void> {
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    // Create assistant message with placeholder content
    const assistantMessage = await this.addMessage(chatId, {
      role: 'assistant',
      content: 'กำลังประมวลผล...',
      toolUsage: []
    });

          // Send initial assistant message
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'assistant_start',
          data: {
            messageId: assistantMessage.id,
            sessionId: chatId
          }
        }));
      }

    // Get agent configuration if available
    let agentConfig = null;
    if (agentId) {
      agentConfig = await agentService.getAgentById(agentId);
    }

    // Simulate AI processing with enhanced features
    await this.simulateAIProcessing(chatId, assistantMessage.id, userMessage, images, agentConfig, userId);
  }

  private async simulateAIProcessing(chatId: string, messageId: string, userMessage: string, images?: Array<{ url: string; mediaType: string }>, agentConfig?: any, userId?: string): Promise<void> {
    // Simulate thinking time
    await this.delay(1000);

    // Simulate tool usage based on message content
    const toolsUsed = await this.simulateToolUsage(chatId, messageId, userMessage, agentConfig);

    // Generate response based on agent configuration
    const response = this.generateResponse(userMessage, images, agentConfig, toolsUsed);
    
    // Stream response with enhanced features
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
  }

  private async simulateToolUsage(chatId: string, messageId: string, userMessage: string, agentConfig?: any): Promise<string[]> {
    const toolsUsed: string[] = [];
    
    // Simulate different tools based on message content
    if (userMessage.toLowerCase().includes('search') || userMessage.toLowerCase().includes('find')) {
      toolsUsed.push('web_search');
      await this.simulateToolExecution(chatId, messageId, 'web_search', 'Searching for information...', 'Found relevant information about the topic.');
    }
    
    if (userMessage.toLowerCase().includes('calculate') || userMessage.toLowerCase().includes('math')) {
      toolsUsed.push('calculator');
      await this.simulateToolExecution(chatId, messageId, 'calculator', 'Performing calculation...', 'Calculation completed successfully.');
    }
    
    if (userMessage.toLowerCase().includes('knowledge') || userMessage.toLowerCase().includes('database')) {
      toolsUsed.push('knowledge_base');
      await this.simulateToolExecution(chatId, messageId, 'knowledge_base', 'Searching knowledge base...', 'Retrieved relevant information from knowledge base.');
    }

    return toolsUsed;
  }

  private async simulateToolExecution(chatId: string, messageId: string, toolName: string, input: string, output: string): Promise<void> {
    // Send tool start
    if (wsManager.getSessionConnectionCount(chatId) > 0) {
      wsManager.broadcastToSession(chatId, JSON.stringify({
        type: 'tool_start',
        data: {
          messageId,
          tool_name: toolName,
          tool_input: input,
          timestamp: new Date()
        }
      }));
    }

    await this.delay(500);

    // Send tool result
    if (wsManager.getSessionConnectionCount(chatId) > 0) {
      wsManager.broadcastToSession(chatId, JSON.stringify({
        type: 'tool_result',
        data: {
          messageId,
          tool_name: toolName,
          output: output,
          timestamp: new Date()
        }
      }));
    }

    await this.delay(300);
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
          data: {
            messageId,
            chunk,
            fullContent
          }
        }));
      }

      await this.delay(100);
    }
  }

  private generateResponse(userMessage: string, images?: Array<{ url: string; mediaType: string }>, agentConfig?: any, toolsUsed?: string[]): string {
    // Use agent-specific response if available
    if (agentConfig?.systemPrompt) {
      const responses = [
        `ตามที่กำหนดในระบบ: ${agentConfig.systemPrompt}\n\nสำหรับคำถาม "${userMessage}" นี่คือคำตอบ:`,
        `ตามแนวทางของ ${agentConfig.name || 'AI Assistant'}: ${agentConfig.systemPrompt}\n\nคำตอบสำหรับ "${userMessage}":`
      ];
      
      const baseResponse = responses[Math.floor(Math.random() * responses.length)];
      return `${baseResponse} ${this.generateDetailedResponse(toolsUsed)}`;
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
      return `${baseResponse} ฉันเห็นว่าคุณได้แนบรูปภาพมาด้วย ฉันจะวิเคราะห์ทั้งข้อความและรูปภาพเพื่อให้คำตอบที่ครบถ้วนที่สุด. ${this.generateDetailedResponse(toolsUsed)}`;
    }

    return `${baseResponse} ${this.generateDetailedResponse(toolsUsed)}`;
  }

  private generateDetailedResponse(toolsUsed?: string[]): string {
    let toolInfo = '';
    if (toolsUsed && toolsUsed.length > 0) {
      toolInfo = `ฉันได้ใช้เครื่องมือ ${toolsUsed.join(', ')} เพื่อหาข้อมูลที่เกี่ยวข้อง. `;
    }

    const details = [
      `${toolInfo}ข้อมูลนี้จะช่วยให้คุณเข้าใจแนวคิดได้ดีขึ้น และสามารถนำไปประยุกต์ใช้ในสถานการณ์จริงได้.`,
      `${toolInfo}หากคุณต้องการข้อมูลเพิ่มเติมหรือมีคำถามอื่นๆ อย่าลังเลที่จะถามได้เลย.`,
      `${toolInfo}ฉันหวังว่าคำตอบนี้จะช่วยให้คุณเข้าใจประเด็นนี้ได้ชัดเจนขึ้น.`,
      `${toolInfo}หากมีส่วนไหนที่ยังไม่ชัดเจน กรุณาแจ้งให้ฉันทราบเพื่อที่ฉันจะได้อธิบายเพิ่มเติม.`
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
    // Clear messages but keep the chat
    await ChatModel.updateOne(
      { _id: chatId },
      { 
        $set: { 
          messages: [],
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`🧹 Cleared memory for chat session ${chatId}`);
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