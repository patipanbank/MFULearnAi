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
    limit: number = 20
  ): Promise<PaginationResult<any>> {
    try {
      const skip = (page - 1) * limit;
      
      const [histories, total] = await Promise.all([
        ChatHistory.find({ userId })
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit),
        ChatHistory.countDocuments({ userId })
      ]);

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
    chatname?: string
  ) {
    try {
      if (!userId || !modelId) {
        throw new Error('userId and modelId are required');
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array is required and must not be empty');
      }

      // Process messages
      const processedMessages = messages.map((msg, index) => {
        this.validateMessage(msg);
        let timestamp;
        try {
          if (msg.timestamp?.$date) {
            timestamp = new Date(msg.timestamp.$date);
          } else if (msg.timestamp) {
            timestamp = new Date(msg.timestamp);
          } else {
            timestamp = new Date();
          }
          
          if (isNaN(timestamp.getTime())) {
            timestamp = new Date();
          }
        } catch (error) {
          timestamp = new Date();
        }

        return {
          role: msg.role as 'user' | 'assistant' | 'system',
          content: String(msg.content || ''),
          timestamp: timestamp,
          images: msg.images ? msg.images.map((img: any) => ({
            data: img.data,
            mediaType: img.mediaType
          })) : undefined,
          sources: msg.sources || [],
          isImageGeneration: msg.isImageGeneration || false
        };
      });

      if (chatId) {
        // Update existing chat
        const updatedChat = await ChatHistory.findByIdAndUpdate(
          chatId,
          {
            $set: {
              messages: processedMessages,
              updatedAt: new Date()
            }
          },
          { 
            new: true, 
            runValidators: true 
          }
        );

        if (!updatedChat) {
          throw new Error('Chat not found');
        }

        return updatedChat;
      } else {
        // Create new chat
        const finalChatname = chatname || (() => {
          const firstUserMessage = messages.find(msg => msg.role === 'user');
          return firstUserMessage 
            ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
            : 'New Chat';
        })();

        const newChat = await ChatHistory.create({
          userId,
          modelId,
          collectionName,
          chatname: finalChatname,
          messages: processedMessages,
          updatedAt: new Date()
        });

        return newChat;
      }
    } catch (error) {
      console.error('Error in saveChatMessage:', error);
      throw new Error(`Failed to save chat message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async clearChatHistory(userId: string) {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }
      
      const result = await ChatHistory.deleteMany({ userId });
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
    const chat = await ChatHistory.findOne({ _id: chatId, userId });
    if (!chat) {
      throw new Error('Chat not found');
    }

    chat.isPinned = !chat.isPinned;
    await chat.save();
    return chat;
  }
}

export const chatHistoryService = new ChatHistoryService(); 