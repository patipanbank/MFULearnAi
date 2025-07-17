import { wsManager } from '../utils/websocketManager';
import { ChatModel, Chat, ChatMessage } from '../models/chat';
import { v4 as uuidv4 } from 'uuid';

export class ChatService {
  constructor() {
    console.log('✅ Chat service initialized');
  }

  public async createChat(userId: string, name: string, agentId?: string): Promise<Chat> {
    const chat = new ChatModel({
      userId,
      name,
      agentId,
      messages: [],
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await chat.save();
    console.log(`✅ Created chat session ${chat._id} for user ${userId}`);

    return chat;
  }

  public async getChat(chatId: string, userId: string): Promise<Chat | null> {
    const chat = await ChatModel.findOne({ _id: chatId, userId });
    
    if (!chat) {
      return null;
    }

    return chat;
  }

  public async addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    const newMessage: ChatMessage = {
      ...message,
      id: uuidv4(),
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
      wsManager.broadcastToSession(chatId, JSON.stringify({
        type: 'user_message',
        data: {
          message: userMessage,
          sessionId: chatId
        }
      }));

      // Process with AI agent (simulated for now)
      await this.processWithAI(chatId, content, images);

    } catch (error) {
      console.error('❌ Error processing message:', error);
      
      // Send error to client
      wsManager.broadcastToSession(chatId, JSON.stringify({
        type: 'error',
        data: 'Failed to process message'
      }));
    }
  }

  private async processWithAI(chatId: string, userMessage: string, images?: Array<{ url: string; mediaType: string }>): Promise<void> {
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
    wsManager.broadcastToSession(chatId, JSON.stringify({
      type: 'assistant_start',
      data: {
        messageId: assistantMessage.id,
        sessionId: chatId
      }
    }));

    // Simulate AI processing
    await this.simulateAIProcessing(chatId, assistantMessage.id, userMessage, images);
  }

  private async simulateAIProcessing(chatId: string, messageId: string, userMessage: string, images?: Array<{ url: string; mediaType: string }>): Promise<void> {
    // Simulate thinking time
    await this.delay(1000);

    // Simulate tool usage
    if (Math.random() > 0.5) {
      await this.simulateToolUsage(chatId, messageId, 'web_search');
    }

    // Generate response
    const response = this.generateResponse(userMessage, images);
    
    // Stream response
    await this.streamResponse(chatId, messageId, response);

    // Mark as complete
    wsManager.broadcastToSession(chatId, JSON.stringify({
      type: 'end',
      data: {
        messageId,
        sessionId: chatId
      }
    }));
  }

  private async simulateToolUsage(chatId: string, messageId: string, toolName: string): Promise<void> {
    // Send tool start
    wsManager.broadcastToSession(chatId, JSON.stringify({
      type: 'tool_start',
      data: {
        messageId,
        tool_name: toolName,
        tool_input: 'Searching for information...',
        timestamp: new Date()
      }
    }));

    await this.delay(500);

    // Send tool result
    wsManager.broadcastToSession(chatId, JSON.stringify({
      type: 'tool_result',
      data: {
        messageId,
        tool_name: toolName,
        output: 'Found relevant information about the topic.',
        timestamp: new Date()
      }
    }));

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
      
      wsManager.broadcastToSession(chatId, JSON.stringify({
        type: 'chunk',
        data: {
          messageId,
          chunk,
          fullContent
        }
      }));

      await this.delay(100);
    }
  }

  private generateResponse(userMessage: string, images?: Array<{ url: string; mediaType: string }>): string {
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
      "ข้อมูลนี้จะช่วยให้คุณเข้าใจแนวคิดได้ดีขึ้น และสามารถนำไปประยุกต์ใช้ในสถานการณ์จริงได้.",
      "หากคุณต้องการข้อมูลเพิ่มเติมหรือมีคำถามอื่นๆ อย่าลังเลที่จะถามได้เลย.",
      "ฉันหวังว่าคำตอบนี้จะช่วยให้คุณเข้าใจประเด็นนี้ได้ชัดเจนขึ้น.",
      "หากมีส่วนไหนที่ยังไม่ชัดเจน กรุณาแจ้งให้ฉันทราบเพื่อที่ฉันจะได้อธิบายเพิ่มเติม."
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
      console.log(`📌 Updated pin status for session ${chatId}`);
    }
    
    return chat;
  }

  public getStats(): any {
    return {
      totalSessions: 0, // TODO: Implement with aggregation
      totalMessages: 0  // TODO: Implement with aggregation
    };
  }
}

// Export singleton instance
export const chatService = new ChatService(); 