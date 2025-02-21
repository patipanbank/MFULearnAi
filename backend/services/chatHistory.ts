import { ChatHistory } from '../models/ChatHistory';
import { Collection } from '../models/Collection';

class ChatHistoryService {
  async getChatHistory(userId: string) {
    try {
      const history = await ChatHistory.findOne({ 
        userId: userId 
      }).sort({ updatedAt: -1 });

      if (!history) {
        return { messages: [], modelId: '', collectionName: '' };
      }

      return {
        messages: history.messages,
        modelId: history.modelId,
        collectionName: history.collectionName
      };
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw error;
    }
  }

  async saveChatMessage(userId: string, modelId: string, collectionName: string, messages: any[]) {
    try {
      const processedMessages = messages.map((msg, index) => ({
        id: index + 1,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: String(msg.content),
        timestamp: new Date(msg.timestamp || Date.now()),
        images: msg.images ? msg.images.map((img: any) => ({
          data: img.data,
          mediaType: img.mediaType
        })) : undefined,
        sources: msg.sources || []
      }));

      const history = await ChatHistory.findOneAndUpdate(
        { userId, modelId, collectionName },
        { 
          userId,
          modelId,
          collectionName,
          messages: processedMessages,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      return history;
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

  async createNewChat(userId: string) {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }

      const defaultCollection = await this.getDefaultCollection();

      const chat = new ChatHistory({
        userId,
        modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0', // default model
        collectionName: defaultCollection, // ใช้ collection เริ่มต้น
        title: 'New Chat',
        messages: [],
        isActive: true,
        lastUpdated: new Date()
      });

      const savedChat = await chat.save();
      if (!savedChat) {
        throw new Error('Failed to save new chat');
      }

      return savedChat;
    } catch (error) {
      console.error('Error in createNewChat:', error);
      throw error;
    }
  }

  // เพิ่มฟังก์ชันสำหรับดึง collection เริ่มต้น
  private async getDefaultCollection(): Promise<string> {
    try {
      // ดึง collection แรกจากฐานข้อมูล
      const collections = await Collection.find().limit(1);
      return collections.length > 0 ? collections[0].name : 'default';
    } catch (error) {
      console.error('Error getting default collection:', error);
      return 'default';
    }
  }

  async getChatList(userId: string) {
    return await ChatHistory.find({ 
      userId 
    }).sort({ lastUpdated: -1 });
  }

  async updateChatTitle(chatId: string, title: string) {
    return await ChatHistory.findByIdAndUpdate(
      chatId,
      { title },
      { new: true }
    );
  }

  async getChat(chatId: string) {
    return await ChatHistory.findById(chatId);
  }
}

export const chatHistoryService = new ChatHistoryService(); 