import { ChatHistory } from '../models/ChatHistory';

class ChatHistoryService {
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

  async saveChatMessage(userId: string, modelId: string, collectionName: string, messages: any[]) {
    try {
      const chatHistory = await ChatHistory.findOne({
        userId,
        modelId,
        collectionName
      });

      if (chatHistory) {
        chatHistory.messages = messages;
        await chatHistory.save();
        return chatHistory;
      }

      const newChatHistory = await ChatHistory.create({
        userId,
        modelId,
        collectionName,
        messages
      });

      return newChatHistory;
    } catch (error) {
      console.error('Error saving chat message:', error);
      throw error;
    }
  }
}

export const chatHistoryService = new ChatHistoryService(); 