import { ChatHistory } from '../models/ChatHistory';

class ChatHistoryService {
  async getChatHistory(userId: string) {
    try {
      const histories = await ChatHistory.find({ 
        userId: userId 
      }).sort({ updatedAt: -1 });

      return histories;
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw error;
    }
  }

  async saveChatMessage(userId: string, modelId: string, collectionName: string, messages: any[], chatId?: string) {
    try {
      const firstUserMessage = messages.find(msg => msg.role === 'user');
      const chatname = firstUserMessage 
        ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
        : 'New Chat';

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

      if (chatId) {
        // อัพเดทแชทเดิม
        const history = await ChatHistory.findByIdAndUpdate(
          chatId,
          {
            messages: processedMessages,
            updatedAt: new Date()
          },
          { new: true }
        );
        return history;
      } else {
        // สร้างแชทใหม่
        const history = await ChatHistory.create({
          userId,
          modelId,
          collectionName,
          chatname,
          messages: processedMessages,
          updatedAt: new Date()
        });
        return history;
      }
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