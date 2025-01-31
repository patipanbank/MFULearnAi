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
      const processedMessages = messages.map((msg, index) => ({
        id: index + 1,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: String(msg.content),
        timestamp: new Date(msg.timestamp || Date.now())
      }));

      let chatHistory = await ChatHistory.findOne({
        userId,
        modelId,
        collectionName
      });

      if (chatHistory) {
        chatHistory.messages = processedMessages as any;
        await chatHistory.save();
        return chatHistory;
      }

      chatHistory = await ChatHistory.create({
        userId,
        modelId,
        collectionName,
        messages: processedMessages
      });

      return chatHistory;
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