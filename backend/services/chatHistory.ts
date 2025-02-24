import { ChatHistory } from '../models/ChatHistory';
import mongoose from 'mongoose';

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

      // Process messages with validation
      const processedMessages = messages.map((msg, index) => {
        if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
          throw new Error(`Invalid message role at index ${index}`);
        }
        if (!msg.content && (!msg.images || msg.images.length === 0)) {
          throw new Error(`Message must have content or images at index ${index}`);
        }

        // Process timestamp
        let timestamp;
        try {
          if (msg.timestamp) {
            if (msg.timestamp.$date) {
              // Handle MongoDB date format
              timestamp = new Date(msg.timestamp.$date);
            } else if (typeof msg.timestamp === 'string') {
              // Handle string date
              timestamp = new Date(msg.timestamp);
            } else if (msg.timestamp instanceof Date) {
              // Handle Date object
              timestamp = msg.timestamp;
            } else {
              // Default to current time if invalid
              timestamp = new Date();
            }
          } else {
            timestamp = new Date();
          }

          // Validate timestamp
          if (isNaN(timestamp.getTime())) {
            console.warn(`Invalid timestamp at index ${index}, using current time`);
            timestamp = new Date();
          }
        } catch (error) {
          console.warn(`Error processing timestamp at index ${index}, using current time:`, error);
          timestamp = new Date();
        }

        return {
          ...msg,
          timestamp,
          role: msg.role,
          content: msg.content || '',
          images: msg.images || [],
          sources: msg.sources || [],
          isImageGeneration: msg.isImageGeneration || false
        };
      });

      // Generate chat name from first user message if not provided
      const finalChatname = chatname || (() => {
        const firstUserMessage = messages.find(msg => msg.role === 'user');
        if (!firstUserMessage) {
          return "New Chat";
        }
        const content = firstUserMessage.content.trim();
        return content.length > 50 ? content.substring(0, 47) + "..." : content;
      })();

      // Update existing chat
      if (chatId) {
        const history = await ChatHistory.findOneAndUpdate(
          { _id: chatId, userId }, // Ensure user owns the chat
          {
            messages: processedMessages,
            updatedAt: new Date()
          },
          { 
            new: true, 
            runValidators: true,
            setDefaultsOnInsert: true
          }
        );
        
        if (!history) {
          throw new Error('Chat not found or unauthorized');
        }
        
        return history;
      }

      // Handle new chat creation
      try {
        // Create new chat
        const history = await ChatHistory.create({
          userId,
          modelId,
          collectionName,
          chatname: finalChatname,
          messages: processedMessages
        });

        return history;
      } catch (error: any) {
        // If duplicate key error (same chatname)
        if (error.code === 11000) {
          // Find and update existing chat
          const existingChat = await ChatHistory.findOneAndUpdate(
            { 
              userId,
              chatname: finalChatname,
              modelId 
            },
            {
              messages: processedMessages,
              updatedAt: new Date()
            },
            { 
              new: true,
              runValidators: true
            }
          );

          if (!existingChat) {
            throw new Error('Failed to update existing chat');
          }

          return existingChat;
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Error in saveChatMessage:', error);
      throw new Error(`Failed to save chat message: ${error.message}`);
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