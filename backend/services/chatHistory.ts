import { ChatHistory } from '../models/ChatHistory';

interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

class ChatHistoryService {
  async getChatHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    folder?: string
  ): Promise<PaginationResult<any>> {
    try {
      console.log('Getting chat history:', { userId, page, limit, folder });
      const skip = (page - 1) * limit;
      
      const query = { userId };
      if (folder) {
        Object.assign(query, { folder });
      }
      
      const [histories, total] = await Promise.all([
        ChatHistory.find(query)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit),
        ChatHistory.countDocuments(query)
      ]);

      console.log(`Found ${histories.length} chats for user ${userId}`);
      return {
        data: histories,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + histories.length < total
      };
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw new Error(`Failed to get chat history: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  async saveChatMessage(
    userId: string,
    modelId: string,
    collectionName: string,
    messages: any[],
    chatId?: string,
    chatname?: string,
    folder: string = 'default'
  ) {
    try {
      console.log('Saving chat message:', {
        userId,
        modelId,
        collectionName,
        chatId,
        messagesCount: messages.length,
        folder
      });

      if (!userId || !modelId) {
        throw new Error('userId and modelId are required');
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array is required and must not be empty');
      }

      const finalChatname = chatname || (() => {
        const firstUserMessage = messages.find(msg => msg.role === 'user');
        return firstUserMessage 
          ? firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')
          : 'New Chat';
      })();

      const processedMessages = messages.map((msg, index) => {
        this.validateMessage(msg);
        const timestamp = new Date(msg.timestamp || Date.now());
        
        return {
          id: index + 1,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: String(msg.content || ''),
          timestamp,
          images: msg.images,
          sources: msg.sources || [],
          isImageGeneration: msg.isImageGeneration || false
        };
      });

      if (!chatId) {
        console.log('Creating new chat');
        const history = await ChatHistory.create({
          userId,
          modelId,
          collectionName,
          chatname: finalChatname,
          messages: processedMessages,
          folder,
          updatedAt: new Date()
        });
        
        console.log('Created new chat:', history._id);
        return history;
      } else {
        console.log('Updating existing chat:', chatId);
        const history = await ChatHistory.findByIdAndUpdate(
          chatId,
          {
            messages: processedMessages,
            updatedAt: new Date()
          },
          { new: true, runValidators: true }
        );
        
        if (!history) {
          throw new Error('Chat not found');
        }
        
        console.log('Updated chat result:', history._id);
        return history;
      }
    } catch (error) {
      console.error('Error in saveChatMessage:', error);
      throw new Error(`Failed to save chat message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async clearChatHistory(userId: string) {
    try {
      console.log('Clearing chat history for user:', userId);
      if (!userId) {
        throw new Error('userId is required');
      }
      
      const result = await ChatHistory.deleteMany({ userId });
      console.log(`Deleted ${result.deletedCount} chats for user ${userId}`);
      return { 
        success: true, 
        message: 'Chat history cleared successfully',
        deletedCount: result.deletedCount 
      };
    } catch (error) {
      console.error('Error clearing chat history:', error);
      throw new Error(`Failed to clear chat history: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  async moveToFolder(userId: string, chatId: string, folder: string) {
    console.log('Moving chat to folder:', { userId, chatId, folder });
    const chat = await ChatHistory.findOneAndUpdate(
      { _id: chatId, userId },
      { folder },
      { new: true }
    );
    
    if (!chat) {
      throw new Error('Chat not found');
    }
    
    console.log(`Chat ${chatId} moved to folder ${folder}`);
    return chat;
  }
}

export const chatHistoryService = new ChatHistoryService(); 