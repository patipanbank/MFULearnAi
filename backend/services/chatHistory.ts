import { ChatHistory } from '../models/ChatHistory';

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

  async getChatById(userId: string, chatId: string) {
    try {
      const chat = await ChatHistory.findOne({
        _id: chatId,
        userId: userId
      });
      
      if (!chat) {
        throw new Error('Chat not found');
      }
      
      return chat;
    } catch (error) {
      console.error('Error getting chat by id:', error);
      throw error;
    }
  }

  async deleteChatById(userId: string, chatId: string) {
    try {
      const result = await ChatHistory.deleteOne({
        _id: chatId,
        userId: userId
      });
      
      if (result.deletedCount === 0) {
        throw new Error('Chat not found or unauthorized');
      }
      
      return { success: true, message: 'Chat deleted successfully' };
    } catch (error) {
      console.error('Error deleting chat by id:', error);
      throw error;
    }
  }
}

export const chatHistoryService = new ChatHistoryService(); 