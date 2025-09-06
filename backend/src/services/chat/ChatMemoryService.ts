import { memoryService } from '../memoryService';
import type { MemoryConfig } from './types/chat-service.types';
import type { ChatMessage } from '../../models/chat';

export class ChatMemoryService {
  constructor() {
    console.log('✅ Chat memory service initialized');
  }

  /**
   * วิเคราะห์ว่าควรใช้ memory management แบบไหน
   */
  public analyzeMemoryNeeds(messageCount: number): MemoryConfig {
    return {
      messageCount,
      useMemoryTool: this.shouldUseMemoryTool(messageCount),
      useRedisMemory: this.shouldUseRedisMemory(messageCount),
      shouldEmbed: this.shouldEmbedMessages(messageCount)
    };
  }

  /**
   * จัดการ hybrid memory management
   */
  public async setupHybridMemory(chatId: string, messages: ChatMessage[]): Promise<void> {
    try {
      console.log(`💾 Setting up hybrid memory for chat ${chatId}`);
      await memoryService.setupHybridMemory(chatId, messages);
    } catch (error) {
      console.warn('⚠️ Hybrid memory setup failed:', error);
    }
  }

  /**
   * ล้างความจำทั้งหมดของ chat
   */
  public async clearChatMemory(chatId: string): Promise<void> {
    try {
      await memoryService.clearAllMemory(chatId);
      
      // Clear memory tool (ถ้ามี)
      if (typeof (global as any).clearChatMemoryTool === 'function') {
        await (global as any).clearChatMemoryTool(chatId);
      }
      
      console.log(`✅ Memory cleared for chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to clear memory for chat ${chatId}:`, error);
    }
  }

  private shouldUseMemoryTool(messageCount: number): boolean {
    return messageCount > 10;
  }

  private shouldUseRedisMemory(messageCount: number): boolean {
    return true; // Always use Redis memory for recent conversations
  }

  private shouldEmbedMessages(messageCount: number): boolean {
    return messageCount % 10 === 0; // Embed every 10 messages
  }
}

export const chatMemoryService = new ChatMemoryService();