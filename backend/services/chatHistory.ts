import { ChatHistory } from '../models/ChatHistory';

class ChatHistoryService {
  async getChatHistory(userId: string, folder?: string) {
    try {
      console.log('Fetching chat history for userId:', userId);
      const query = { userId };
      if (folder) {
        Object.assign(query, { folder });
      }
      
      const histories = await ChatHistory.find(query)
        .sort({ isPinned: -1, updatedAt: -1 });

      console.log('Retrieved chat histories:', JSON.stringify({
        count: histories.length,
        histories: histories.map(history => ({
          id: history._id,
          chatname: history.chatname,
          modelId: history.modelId,
          messageCount: history.messages.length,
          lastUpdated: history.updatedAt,
          folder: history.folder,
          tags: history.tags,
          isPinned: history.isPinned,
          collectionName: history.collectionName
        }))
      }, null, 2));

      return histories;
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw error;
    }
  }

  async getChatById(chatId: string, userId: string) {
    try {
      const chat = await ChatHistory.findOne({ _id: chatId, userId });
      if (chat) {
        // Update lastAccessedAt
        chat.lastAccessedAt = new Date();
        await chat.save();
      }
      return chat;
    } catch (error) {
      console.error('Error getting chat by ID:', error);
      throw error;
    }
  }

  async renameChatHistory(chatId: string, userId: string, newName: string) {
    try {
      return await ChatHistory.findOneAndUpdate(
        { _id: chatId, userId },
        { chatname: newName },
        { new: true }
      );
    } catch (error) {
      console.error('Error renaming chat:', error);
      throw error;
    }
  }

  async deleteChatHistory(chatId: string, userId: string) {
    try {
      return await ChatHistory.findOneAndDelete({ _id: chatId, userId });
    } catch (error) {
      console.error('Error deleting specific chat:', error);
      throw error;
    }
  }

  async searchChatHistory(userId: string, query: string) {
    try {
      return await ChatHistory.find({
        userId,
        $or: [
          { chatname: { $regex: query, $options: 'i' } },
          { 'messages.content': { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } }
        ]
      }).sort({ updatedAt: -1 });
    } catch (error) {
      console.error('Error searching chats:', error);
      throw error;
    }
  }

  async updateChatFolder(chatId: string, userId: string, folder: string) {
    try {
      return await ChatHistory.findOneAndUpdate(
        { _id: chatId, userId },
        { folder, lastAccessedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating chat folder:', error);
      throw error;
    }
  }

  async updateChatTags(chatId: string, userId: string, tags: string[]) {
    try {
      return await ChatHistory.findOneAndUpdate(
        { _id: chatId, userId },
        { tags, lastAccessedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating chat tags:', error);
      throw error;
    }
  }

  async togglePinChat(chatId: string, userId: string) {
    try {
      const chat = await ChatHistory.findOne({ _id: chatId, userId });
      if (!chat) throw new Error('Chat not found');
      
      chat.isPinned = !chat.isPinned;
      chat.lastAccessedAt = new Date();
      return await chat.save();
    } catch (error) {
      console.error('Error toggling chat pin:', error);
      throw error;
    }
  }

  async saveChatMessage(userId: string, modelId: string, collectionName: string | undefined, messages: any[], chatId?: string) {
    try {
      console.log('Processing messages:', JSON.stringify(messages, null, 2));

      // Process and validate messages
      const processedMessages = messages.map((msg, index) => ({
        id: msg.id || index + 1,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: String(msg.content || '').trim(),
        timestamp: new Date(msg.timestamp || Date.now()),
        images: msg.images ? msg.images.map((img: any) => ({
          data: img.data,
          mediaType: img.mediaType
        })) : undefined,
        sources: msg.sources || [],
        isImageGeneration: msg.isImageGeneration || false
      }));

      console.log('Processed messages:', JSON.stringify(processedMessages, null, 2));

      // Get chat name from first user message
      const firstUserMessage = messages.find(msg => msg.role === 'user');
      const chatname = firstUserMessage 
        ? firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')
        : 'New Chat';

      console.log('Saving chat message:', {
        userId,
        modelId,
        collectionName,
        chatId,
        messagesCount: messages.length
      });

      if (chatId) {
        console.log('Updating existing chat:', chatId);
        const updateData = {
          messages: processedMessages,
          modelId, // Always update modelId
          ...(collectionName && { collectionName }), // Update collectionName if provided
          updatedAt: new Date()
        };

        const history = await ChatHistory.findByIdAndUpdate(
          chatId,
          updateData,
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
          folder: 'default',
          tags: [],
          isPinned: false,
          lastAccessedAt: new Date(),
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

  async exportChatHistory(userId: string, chatId: string) {
    try {
      const chat = await this.getChatById(chatId, userId);
      if (!chat) throw new Error('Chat not found');
      
      return {
        chatname: chat.chatname,
        messages: chat.messages,
        folder: chat.folder,
        tags: chat.tags,
        timestamp: new Date(),
        format: 'v1'
      };
    } catch (error) {
      console.error('Error exporting chat:', error);
      throw error;
    }
  }

  async importChatHistory(userId: string, chatData: any) {
    try {
      if (!chatData.chatname || !Array.isArray(chatData.messages)) {
        throw new Error('Invalid chat data format');
      }

      const newChat = await ChatHistory.create({
        userId,
        chatname: chatData.chatname,
        messages: chatData.messages,
        folder: chatData.folder || 'default',
        tags: chatData.tags || [],
        lastAccessedAt: new Date()
      });

      return newChat;
    } catch (error) {
      console.error('Error importing chat:', error);
      throw error;
    }
  }
}

export const chatHistoryService = new ChatHistoryService(); 