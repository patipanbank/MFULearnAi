import { ChatHistory } from '../models/ChatHistory';

class ChatHistoryService {
  async getChatHistory(userId: string) {
    try {
      const histories = await ChatHistory.find({ 
        userId: userId 
      }).sort({ updatedAt: -1 });

      return histories.map(history => ({
        id: history._id,
        chatName: history.chatName,
        messages: history.messages,
        modelId: history.modelId,
        collectionName: history.collectionName,
        updatedAt: history.updatedAt
      }));
    } catch (error) {
      console.error('Error getting chat histories:', error);
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

  async createNewChat(userId: string, modelId: string, collectionName: string) {
    try {
      const newChat = await ChatHistory.create({
        userId,
        modelId,
        collectionName,
        chatName: 'New Chat',
        messages: []
      });
      return newChat;
    } catch (error) {
      console.error('Error creating new chat:', error);
      throw error;
    }
  }
}

export const chatHistoryService = new ChatHistoryService(); 