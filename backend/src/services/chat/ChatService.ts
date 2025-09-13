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
}

export const chatService = new ChatService();