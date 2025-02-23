import { ChatHistory } from '../models/ChatHistory';

interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

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

  async getSpecificChat(userId: string, chatId: string) {
    try {
      console.log('Getting specific chat:', { userId, chatId });
      const chat = await ChatHistory.findOne({ _id: chatId, userId });
      if (!chat) {
        throw new Error('Chat not found');
      }
      return chat;
    } catch (error) {
      console.error('Error getting specific chat:', error);
      throw new Error(`Failed to get specific chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateMessage(msg: any) {
    if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
      throw new Error('Invalid message role');
    }
    if (!msg.content && (!msg.images || msg.images.length === 0)) {
      throw new Error('Message must have content or images');
    }
    if (msg.images) {
      msg.images.forEach((img: any) => {
        if (!img.data || !img.mediaType) {
          throw new Error('Invalid image format');
        }
      });
    }
  }

  async saveChatMessage(userId: string, modelId: string, collectionName: string, messages: any[], chatId?: string) {
    try {
      const firstUserMessage = messages.find(msg => msg.role === 'user');
      const chatname = firstUserMessage 
        ? firstUserMessage.content.slice(0, 10) + (firstUserMessage.content.length > 10 ? '...' : '')
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

      console.log('Saving chat message:', {
        userId,
        modelId,
        collectionName,
        chatId,
        messagesCount: messages.length
      });

      if (chatId) {
        console.log('Updating existing chat:', chatId);
        const history = await ChatHistory.findByIdAndUpdate(
          chatId,
          {
            messages: processedMessages,
            updatedAt: new Date()
          },
          { new: true }
        );
        console.log('Updated chat result:', history?._id);
        return history;
      } else {
        console.log('Creating new chat');
        const history = await ChatHistory.create({
          userId,
          modelId,
          collectionName,
          chatname,
          messages: processedMessages,
          updatedAt: new Date()
        });
        console.log('Created new chat:', history._id);
        return history;
      }
    } catch (error) {
      console.error('Error in saveChatMessage:', error);
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

  async togglePinChat(userId: string, chatId: string) {
    console.log('Toggling pin status:', { userId, chatId });
    const chat = await ChatHistory.findOne({ _id: chatId, userId });
    if (!chat) {
      throw new Error('Chat not found');
    }

    chat.isPinned = !chat.isPinned;
    await chat.save();
    console.log(`Chat ${chatId} pin status toggled to ${chat.isPinned}`);
    return chat;
  }
}

export const chatHistoryService = new ChatHistoryService(); 