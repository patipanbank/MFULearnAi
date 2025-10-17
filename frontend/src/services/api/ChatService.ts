/**
 * Chat Service
 * Handles all chat-related API calls
 */

import { api } from '../../shared/lib/api';
import { config } from '../../config/config';
import type { ChatSession, ChatMessage } from './types';

export class ChatService {
  private static get baseUrl(): string {
    return config.services.chat.apiPath;
  }

  /**
   * Get chat history for current user
   */
  static async getHistory(): Promise<ChatSession[]> {
    return api.get<ChatSession[]>(`${this.baseUrl}/history`);
  }

  /**
   * Get a specific chat by ID
   */
  static async getChat(chatId: string): Promise<ChatSession> {
    return api.get<ChatSession>(`${this.baseUrl}/history/${chatId}`);
  }

  /**
   * Save current chat session
   */
  static async saveChat(session: ChatSession): Promise<void> {
    return api.post(`${this.baseUrl}/save`, session);
  }

  /**
   * Update chat name
   */
  static async updateChatName(chatId: string, name: string): Promise<void> {
    return api.post(`${this.baseUrl}/update-name`, {
      chat_id: chatId,
      name
    });
  }

  /**
   * Delete a chat
   */
  static async deleteChat(chatId: string): Promise<void> {
    return api.delete(`${this.baseUrl}/${chatId}`);
  }

  /**
   * Pin/unpin a chat
   */
  static async pinChat(chatId: string, isPinned: boolean): Promise<void> {
    return api.post(`${this.baseUrl}/${chatId}/pin`, { isPinned });
  }
}
