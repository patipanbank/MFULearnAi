import { ChatHistory } from '../models/ChatHistory';

class ChatHistoryService {
  async getChatHistory(userId: string) {
    try {
      console.log('Fetching chat history for userId:', userId);
      const histories = await ChatHistory.find({ 
        userId: userId 
      }).sort({ updatedAt: -1 });

      console.log('Retrieved chat histories:', JSON.stringify({
        count: histories.length,
        histories: histories.map(history => ({
          id: history._id,
          chatname: history.chatname,
          modelId: history.modelId,
          messageCount: history.messages.length,
          lastUpdated: history.updatedAt,
          collectionName: history.collectionName,
          messages: history.messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            images: msg.images,
            sources: msg.sources
          }))
        }))
      }, null, 2));

      return histories;
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw error;
    }
  }

  async saveChatMessage(userId: string, modelId: string, collectionName: string | undefined, messages: any[], chatId?: string) {
    try {
      const firstUserMessage = messages.find(msg => msg.role === 'user');
      const chatname = firstUserMessage 
        ? firstUserMessage.content.slice(0, 10) + (firstUserMessage.content.length > 10 ? '...' : '')
        : 'New Chat';

      console.log('Processing messages:', JSON.stringify(messages, null, 2));

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

      console.log('Processed messages:', JSON.stringify(processedMessages, null, 2));

      // เพิ่ม log เพื่อตรวจสอบ
      console.log('Saving chat message:', {
        userId,
        modelId,
        collectionName,
        chatId,
        messagesCount: messages.length
      });

      const chatData = {
        userId,
        modelId,
        ...(collectionName && { collectionName }), // Only include if collectionName is provided
        chatname,
        messages: processedMessages,
        updatedAt: new Date()
      };

      if (chatId) {
        console.log('Updating existing chat:', chatId);
        const history = await ChatHistory.findByIdAndUpdate(
          chatId,
          chatData,
          { new: true }
        );
        console.log('Updated chat result:', history?._id);
        return history;
      } else {
        console.log('Creating new chat');
        const history = await ChatHistory.create(chatData);
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
}

export const chatHistoryService = new ChatHistoryService(); 