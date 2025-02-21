import { ChatHistory } from '../models/ChatHistory';
import mongoose from 'mongoose';

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

  async createNewChat(userId: string) {
    try {
      const chatId = new mongoose.Types.ObjectId().toString();
      const newChat = new ChatHistory({
        chatId,
        userId,
        messages: [],
        modelId: '',
        collectionName: ''
      });
      await newChat.save();
      return chatId;
    } catch (error) {
      console.error('Error creating new chat:', error);
      throw error;
    }
  }

  async getAllChats(userId: string) {
    try {
      return await ChatHistory.find({ userId })
        .sort({ updatedAt: -1 })
        .select('chatId modelId collectionName messages.content updatedAt');
    } catch (error) {
      console.error('Error getting all chats:', error);
      throw error;
    }
  }

  async saveChatMessage(chatId: string, userId: string, modelId: string, collectionName: string, messages: any[]) {
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
        { chatId, userId },
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
}

export const chatHistoryService = new ChatHistoryService(); 