import { ChatHistory } from '../models/ChatHistory';

export class ChatHistoryService {
  async getChatHistory(userId: string) {
    try {
      const history = await ChatHistory.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(50);
      return history;
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw error;
    }
  }

  async saveChatMessage(
    userId: string,
    modelId: string,
    collectionName: string,
    messages: any[]
  ) {
    try {
      // หาแชทล่าสุดของผู้ใช้
      let chat = await ChatHistory.findOne({ userId }).sort({ createdAt: -1 });

      if (!chat) {
        // ถ้าไม่มีแชท ให้สร้างใหม่
        const firstMessage = messages[0]?.content || 'New Chat';
        chat = new ChatHistory({
          userId,
          title: firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : ''),
          messages: [],
          modelId,
          collectionName
        });
      }

      // อัพเดทข้อความ
      chat.messages = messages;
      chat.modelId = modelId;
      chat.collectionName = collectionName;
      chat.updatedAt = new Date();

      await chat.save();
      return chat;
    } catch (error) {
      console.error('Error saving chat message:', error);
      throw error;
    }
  }

  async clearChatHistory(userId: string) {
    try {
      await ChatHistory.deleteMany({ userId });
      return { success: true, message: 'Chat history cleared successfully' };
    } catch (error) {
      console.error('Error clearing chat history:', error);
      throw error;
    }
  }
}

export const chatHistoryService = new ChatHistoryService(); 