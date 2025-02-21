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

  async saveChatMessage(userId: string, modelId: string, collectionName: string, chatName: string, messages: any[]) {
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
        { userId, modelId, collectionName, chatName },
        { 
          userId,
          modelId,
          collectionName,
          chatName,
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

  async getAllChatHistories(userId: string) {
    try {
      const histories = await ChatHistory.find({ 
        userId: userId 
      }).sort({ updatedAt: -1 });

      return histories.map(history => ({
        id: history._id,
        chatName: history.chatName,
        modelId: history.modelId,
        collectionName: history.collectionName,
        lastMessage: history.messages[history.messages.length - 1]?.content || '',
        updatedAt: history.updatedAt
      }));
    } catch (error) {
      console.error('Error getting chat histories:', error);
      throw error;
    }
  }
}

export const chatHistoryService = new ChatHistoryService(); 