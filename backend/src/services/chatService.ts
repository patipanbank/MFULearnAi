import { ChatModel, Chat, ChatMessage } from '../models/chat';
import { wsManager } from '../utils/websocketManager';
import { agentService } from './agentService';
import { usageService } from './usageService';
import { bedrockService, BedrockMessage } from './bedrockService';
import { memoryService } from './memoryService';
import { toolRegistryService } from './toolRegistryService';
import { langchainChatService } from './langchainChatService';

// Memory config
const MEMORY_CONTEXT_WINDOW = 10; // buffer size
const MEMORY_SUMMARY_THRESHOLD = 20; // message count to trigger summary

function extractText(chunkText: any): string {
  if (Array.isArray(chunkText)) {
    return chunkText.map(extractText).join('');
  }
  if (chunkText && typeof chunkText === 'object') {
    if ('content' in chunkText && typeof chunkText.content === 'string') {
      return chunkText.content;
    }
    if ('text' in chunkText && typeof chunkText.text === 'string') {
      return chunkText.text;
    }
    return JSON.stringify(chunkText);
  }
  if (chunkText === undefined || chunkText === null) {
    return '';
  }
  return String(chunkText);
}

export class ChatService {
  constructor() {
    console.log('✅ Chat service initialized');
  }

  public async createChat(userId: string, name: string, agentId?: string): Promise<Chat> {
    const chat = new ChatModel({
      userId,
      name,
      messages: [],
      agentId,
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await chat.save();
    console.log(`✅ Created chat session ${chat._id} for user ${userId} (agentId: ${agentId || 'none'})`);
    return chat;
  }

  public async getChat(chatId: string, userId: string): Promise<Chat | null> {
    console.log(`🔍 Looking for chat: ${chatId} for user: ${userId}`);
    
    const chat = await ChatModel.findOne({ _id: chatId, userId });
    
    if (chat) {
      console.log(`✅ Found chat: ${chatId}`);
    } else {
      console.log(`❌ Chat not found: ${chatId}`);
      // Let's also check if the chat exists without user filter
      const chatWithoutUser = await ChatModel.findById(chatId);
      if (chatWithoutUser) {
        console.log(`⚠️ Chat exists but belongs to user: ${chatWithoutUser.userId}`);
      } else {
        console.log(`❌ Chat doesn't exist in database: ${chatId}`);
      }
    }
    
    return chat;
  }

  public async addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'> & { summary?: string; vectorRef?: string }): Promise<ChatMessage> {
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    // Ensure content is string
    const contentString = typeof message.content === 'string' ? message.content : extractText(message.content);
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      ...message,
      content: contentString,
      timestamp: new Date(),
      summary: message.summary,
      vectorRef: message.vectorRef
    };

    chat.messages.push(newMessage);
    chat.updatedAt = new Date();
    await chat.save();

    // เพิ่มลง memoryService (buffer/vector)
    await memoryService.addChatMemory(chatId, [newMessage]);

    // Trim/summarize history อัตโนมัติ
    const bufferChat = await ChatModel.findById(chatId);
    if (bufferChat && bufferChat.messages.length > MEMORY_CONTEXT_WINDOW) {
      if (bufferChat.messages.length > MEMORY_SUMMARY_THRESHOLD) {
        const summaryText = '[Summary] ' + bufferChat.messages.slice(0, MEMORY_CONTEXT_WINDOW).map(m => m.content).join(' | ');
        const summaryMsg: ChatMessage = {
          id: Math.random().toString(36).substr(2, 9),
          role: 'system',
          content: '',
          summary: summaryText,
          timestamp: new Date()
        };
        bufferChat.messages = [summaryMsg, ...bufferChat.messages.slice(-MEMORY_CONTEXT_WINDOW)];
      } else {
        bufferChat.messages = bufferChat.messages.slice(-MEMORY_CONTEXT_WINDOW);
      }
      await bufferChat.save();
    }

    console.log(`✅ Added message to session ${chatId}`);
    return newMessage;
  }

  public async processMessage(chatId: string, userId: string, content: string, images?: Array<{ url: string; mediaType: string }>): Promise<void> {
    try {
      // Add user message first (like in legacy)
      const userMessage = await this.addMessage(chatId, {
        role: 'user',
        content: typeof content === 'string' ? content : extractText(content),
        images
      });

      // เลือก memory type (buffer/vector/summary)
      const recentBuffer = memoryService.getRecentMessages(chatId, MEMORY_CONTEXT_WINDOW);
      // (สามารถใช้ recentBuffer ในการสร้าง context สำหรับ LLM ได้)

      // ถ้า message count เกิน threshold ให้สรุปข้อความ (mock summary)
      const recentChat = await ChatModel.findById(chatId);
      if (recentChat && recentChat.messages.length > MEMORY_SUMMARY_THRESHOLD) {
        const summaryText = '[Summary] ' + recentChat.messages.slice(0, MEMORY_CONTEXT_WINDOW).map(m => m.content).join(' | ');
        // เพิ่ม summary message
        const summaryMsg: ChatMessage = {
          id: Math.random().toString(36).substr(2, 9),
          role: 'system',
          content: '',
          summary: summaryText,
          timestamp: new Date()
        };
        recentChat.messages = [summaryMsg, ...recentChat.messages.slice(-MEMORY_CONTEXT_WINDOW)];
        await recentChat.save();
      }

      // Send immediate acknowledgment to client (like in legacy)
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'accepted',
          data: { chatId }
        }));
      }

      // Get chat and agent info
      const chat = await ChatModel.findById(chatId);
      if (!chat) {
        throw new Error(`Chat session ${chatId} not found`);
      }

      // Get agent configuration if available
      let agentConfig = null;
      let modelId: string | null = null;
      let collectionNames: string[] = [];
      let systemPrompt: string | null = null;
      let temperature = 0.7;
      let maxTokens = 4000;

      if (chat.agentId) {
        agentConfig = await agentService.getAgentById(chat.agentId);
        if (agentConfig) {
          modelId = agentConfig.modelId;
          collectionNames = agentConfig.collectionNames || [];
          systemPrompt = agentConfig.systemPrompt;
          temperature = agentConfig.temperature;
          maxTokens = agentConfig.maxTokens;
        }
      }

      // Process with LangChain AI agent
      await this.processWithLangChain(chatId, content, images, {
        modelId,
        collectionNames,
        systemPrompt,
        temperature,
        maxTokens,
        agentId: chat.agentId
      }, userId);

    } catch (error) {
      console.error('❌ Error processing message:', error);
      
      // Handle validation errors specifically
      if (error instanceof Error && error.message.includes('validation failed')) {
        console.error('Validation error details:', error);
        
        // Try to fix the validation issue by updating the message
        try {
          await ChatModel.updateOne(
            { _id: chatId, 'messages.content': { $exists: false } },
            { $set: { 'messages.$.content': 'กำลังประมวลผล...' } }
          );
        } catch (fixError) {
          console.error('Failed to fix validation error:', fixError);
        }
      }
      
      // Send error to client
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'error',
          data: 'Failed to process message'
        }));
      }
    }
  }

  // Process with LangChain AI agent
  private async processWithLangChain(chatId: string, userMessage: string, images?: Array<{ url: string; mediaType: string }>, config?: {
    modelId?: string | null;
    collectionNames?: string[];
    systemPrompt?: string | null;
    temperature?: number;
    maxTokens?: number;
    agentId?: string;
  }, userId?: string): Promise<void> {
    try {
      // Create assistant message in database
      const assistantMessage = await this.addMessage(chatId, {
        role: 'assistant',
        content: '',
        images: [],
        isStreaming: true,
        isComplete: false
      });

      let fullResponse = '';

      // ฟังก์ชัน extractText สำหรับแปลง chunkText เป็น string
      // function extractText(chunkText: any): string {
      //   if (Array.isArray(chunkText)) {
      //     return chunkText.map(extractText).join('');
      //   }
      //   if (chunkText && typeof chunkText === 'object') {
      //     if ('content' in chunkText) {
      //       if (typeof chunkText.content === 'string') {
      //         return chunkText.content;
      //       }
      //       if (Array.isArray(chunkText.content)) {
      //         return chunkText.content.map(extractText).join('');
      //       }
      //       if (typeof chunkText.content === 'object') {
      //         return extractText(chunkText.content);
      //       }
      //     }
      //     if ('text' in chunkText && typeof chunkText.text === 'string') {
      //       return chunkText.text;
      //     }
      //     return JSON.stringify(chunkText);
      //   }
      //   if (chunkText === undefined || chunkText === null) {
      //     return '';
      //   }
      //   return String(chunkText);
      // }

      // Use LangChain chat service for advanced features
      const chatStream = langchainChatService.chat(
        chatId,
        userId || '',
        userMessage,
        config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        config?.collectionNames || [],
        images,
        config?.systemPrompt || undefined,
        config?.temperature || 0.7,
        config?.maxTokens || 4000
      );

      for await (const chunk of chatStream) {
        try {
          const data = JSON.parse(chunk);
          
          if (data.type === 'chunk') {
            const chunkText = extractText(data.data);
            fullResponse += chunkText;
            
            // Update message in database
            await ChatModel.updateOne(
              { _id: chatId, 'messages.id': assistantMessage.id },
              { 
                $set: { 
                  'messages.$.content': String(fullResponse),
                  'messages.$.isStreaming': true
                } 
              }
            );
            
            // Send chunk to WebSocket clients
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'chunk',
                data: chunkText
              }));
            }
          }
          
          else if (data.type === 'tool_start') {
            // Forward tool events to WebSocket clients
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify(data));
            }
          }
          
          else if (data.type === 'tool_result') {
            // Forward tool events to WebSocket clients
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify(data));
            }
          }
          
          else if (data.type === 'tool_error') {
            // Forward tool events to WebSocket clients
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify(data));
            }
          }
          
          else if (data.type === 'end') {
            // Send end event to WebSocket clients
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify(data));
            }
          }
          
        } catch (error) {
          console.error('Error parsing chunk:', error);
          continue;
        }
      }

      // Update final message in database
      await ChatModel.updateOne(
        { _id: chatId, 'messages.id': assistantMessage.id },
        { 
          $set: { 
            'messages.$.content': String(fullResponse),
            'messages.$.isStreaming': false,
            'messages.$.isComplete': true
          } 
        }
      );

    } catch (error) {
      console.error('❌ Error in LangChain processing:', error);
      
      // Send error to client
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'error',
          data: 'Failed to process AI response'
        }));
      }
    }
  }





  // Legacy streaming methods removed - now handled by LangChain

  public async getUserChats(userId: string): Promise<Chat[]> {
    const chats = await ChatModel.find({ userId })
      .sort({ isPinned: -1, updatedAt: -1 })
      .exec();

    return chats;
  }

  public async deleteChat(chatId: string, userId: string): Promise<boolean> {
    const result = await ChatModel.deleteOne({ _id: chatId, userId });
    const success = result.deletedCount > 0;
    
    if (success) {
      console.log(`🗑️ Deleted chat session ${chatId}`);
    }
    
    return success;
  }

  public async updateChatName(chatId: string, userId: string, name: string): Promise<Chat | null> {
    const chat = await ChatModel.findOneAndUpdate(
      { _id: chatId, userId },
      { name, updatedAt: new Date() },
      { new: true }
    );

    if (chat) {
      console.log(`✏️ Updated chat name for session ${chatId}`);
    }
    
    return chat;
  }

  public async updateChatPinStatus(chatId: string, userId: string, isPinned: boolean): Promise<Chat | null> {
    const chat = await ChatModel.findOneAndUpdate(
      { _id: chatId, userId },
      { isPinned, updatedAt: new Date() },
      { new: true }
    );

    if (chat) {
      console.log(`📌 Updated pin status for session ${chatId}: ${isPinned}`);
    }
    
    return chat;
  }

  public async clearChatMemory(chatId: string): Promise<void> {
    try {
      console.log(`🧹 Clearing memory for chat ${chatId}`);
      
      // Clear LangChain memory (includes Redis and tool registry)
      await langchainChatService.clearChatMemory(chatId);
      
      // Clear additional memory services
      memoryService.clearChatMemory(chatId);
      
      console.log(`✅ Memory cleared for chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to clear memory for chat ${chatId}:`, error);
    }
  }

  // Memory management methods are now handled by langchainChatService
  // These methods are kept for backward compatibility but delegate to LangChain

  public getStats(): any {
    return {
      totalChats: 0, // TODO: Implement actual stats
      activeSessions: 0, // TODO: Implement active session count
      totalMessages: 0
    };
  }
}

export const chatService = new ChatService(); 