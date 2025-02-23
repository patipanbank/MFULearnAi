import { ChatHistory } from '../models/ChatHistory';

class ChatHistoryService {
  // Get all chat topics for a user
  async getChatTopics(userId: string) {
    try {
      return await ChatHistory.find({ userId })
        .select('_id chatname')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting chat topics:', error);
      throw error;
    }
  }

  // Get messages for a specific chat topic
  async getChatMessages(chatId: string, userId: string) {
    try {
      return await ChatHistory.findOne(
        { _id: chatId, userId },
        { messages: 1, chatname: 1 }
      );
    } catch (error) {
      console.error('Error getting chat messages:', error);
      throw error;
    }
  }

  // Save message to a chat topic
  async saveMessage(userId: string, chatId: string | undefined, message: {
    role: 'user' | 'assistant',
    content: string
  }) {
    try {
      if (chatId) {
        // Add message to existing chat
        return await ChatHistory.findOneAndUpdate(
          { _id: chatId, userId },
          { 
            $push: { messages: message }
          },
          { new: true }
        );
      } else {
        // Create new chat topic with first message
        const chatname = message.content.slice(0, 30) + 
          (message.content.length > 30 ? '...' : '');
        
        return await ChatHistory.create({
          userId,
          chatname,
          messages: [message]
        });
      }
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  // Delete a chat topic
  async deleteChat(chatId: string, userId: string) {
    try {
      return await ChatHistory.findOneAndDelete({ _id: chatId, userId });
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  }
}

export const chatHistoryService = new ChatHistoryService(); 