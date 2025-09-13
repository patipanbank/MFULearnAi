import { Chat, ChatMessage } from '../../models/chat';
import { chatRoomService } from './ChatRoomService';
import { chatMessageService } from './ChatMessageService';
import { chatMemoryService } from './ChatMemoryService';
import { chatProcessingService } from './ChatProcessingService';

/**
 * Main ChatService - orchestrates all chat-related operations
 * Now acts as a facade that delegates to specialized services
 */
export class ChatService {
  constructor() {
    console.log('✅ Main chat service initialized');
  }

  // Chat Room Operations
  public async createChat(userId: string, name: string, agentId?: string): Promise<Chat> {
    return chatRoomService.createChat(userId, name, agentId);
  }

  public async getChat(chatId: string, userId: string): Promise<Chat | null> {
    return chatRoomService.getChat(chatId, userId);
  }

  public async getUserChats(userId: string): Promise<Chat[]> {
    return chatRoomService.getUserChats(userId);
  }

  public async deleteChat(chatId: string, userId: string): Promise<boolean> {
    return chatRoomService.deleteChat(chatId, userId);
  }

  public async updateChatName(chatId: string, userId: string, name: string): Promise<Chat | null> {
    return chatRoomService.updateChatName(chatId, userId, name);
  }

  public async updateChatPinStatus(chatId: string, userId: string, isPinned: boolean): Promise<Chat | null> {
    return chatRoomService.updateChatPinStatus(chatId, userId, isPinned);
  }

  // Message Operations
  public async addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    return chatMessageService.addMessage(chatId, message);
  }

  // AI Processing
  public async processMessage(
    chatId: string, 
    userId: string, 
    content: string, 
    images?: Array<{ url: string; mediaType: string }>
  ): Promise<void> {
    return chatProcessingService.processMessage(chatId, userId, content, images);
  }

  // Memory Management
  public async clearChatMemory(chatId: string): Promise<void> {
    return chatMemoryService.clearChatMemory(chatId);
  }

  // Statistics
  public getStats(): any {
    const processingStats = chatProcessingService.getStats();
    return {
      ...processingStats,
      // Add more stats from other services as needed
    };
  }

  // ===== ROUTE COMPATIBILITY METHODS =====
  
  public async getChatWithMessages(chatId: string, userId: string): Promise<any> {
    try {
      const chat = await this.getChat(chatId, userId);
      if (!chat) {
        return null;
      }
      
      // Return chat with messages included
      return {
        ...chat.toObject(),
        messages: chat.messages || []
      };
    } catch (error) {
      console.error('Error getting chat with messages:', error);
      throw error;
    }
  }

  public async getChatMessages(chatId: string, userId: string, options: any = {}): Promise<any[]> {
    try {
      const chat = await this.getChat(chatId, userId);
      if (!chat) {
        return [];
      }
      
      let messages = chat.messages || [];
      
      // Apply pagination if provided
      if (options.limit) {
        messages = messages.slice(0, options.limit);
      }
      
      return messages;
    } catch (error) {
      console.error('Error getting chat messages:', error);
      return [];
    }
  }

  public async updateMessage(messageId: string, updates: any): Promise<any> {
    // Stub implementation
    console.log(`Updating message ${messageId} with:`, updates);
    return { id: messageId, ...updates };
  }

  public async deleteMessage(messageId: string): Promise<boolean> {
    // Stub implementation
    console.log(`Deleting message ${messageId}`);
    return true;
  }

  public async searchMessages(query: string, options: any = {}): Promise<any[]> {
    // Stub implementation
    console.log(`Searching messages for: ${query}`);
    return [];
  }

  public async updateChat(chatId: string, updates: any): Promise<any> {
    // Stub implementation  
    console.log(`Updating chat ${chatId} with:`, updates);
    return { id: chatId, ...updates };
  }

  public async batchDeleteChats(chatIds: string[]): Promise<boolean> {
    // Stub implementation
    console.log(`Batch deleting chats:`, chatIds);
    return true;
  }

  public async batchPinChats(chatIds: string[], pinned: boolean): Promise<boolean> {
    // Stub implementation
    console.log(`Batch ${pinned ? 'pinning' : 'unpinning'} chats:`, chatIds);
    return true;
  }

  // Session management stubs
  public async getActiveSessions(userId: string): Promise<any[]> {
    return [];
  }

  public async createSession(data: any): Promise<any> {
    return { id: 'session-' + Date.now(), ...data };
  }

  public async getSession(sessionId: string): Promise<any> {
    return { id: sessionId };
  }

  public async updateSession(sessionId: string, updates: any): Promise<any> {
    return { id: sessionId, ...updates };
  }

  public async endSession(sessionId: string): Promise<boolean> {
    return true;
  }

  public async getSessionStats(sessionId: string): Promise<any> {
    return { sessionId, stats: {} };
  }

  public async transferSession(sessionId: string, toUserId: string): Promise<any> {
    return { sessionId, transferredTo: toUserId };
  }
}

export const chatService = new ChatService();