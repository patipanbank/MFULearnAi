import { ChatModel, Chat, ChatMessage } from '../models/chat';
import { wsManager } from '../utils/websocketManager';
import { agentService } from './agentService';
import { usageService } from './usageService';
import { getLLM } from '../agent/llmFactory';
import { toolRegistry, createMemoryTool, createRetrievalTools, ToolFunction } from '../agent/toolRegistry';
import { createPromptTemplate } from '../agent/promptFactory';
import { createAgent } from '../agent/agentFactory';
import { redis } from '../lib/redis';
import { memoryService } from './memoryService';
import { chromaService } from './chromaService';

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
    console.log(`✅ Created chat session ${chat._id} for user ${userId}`);
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

  public async addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    // Ensure content is not empty
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      ...message,
      timestamp: new Date()
    };

    chat.messages.push(newMessage);
    chat.updatedAt = new Date();
    await chat.save();

    console.log(`✅ Added message to session ${chatId}`);

    return newMessage;
  }

  public async processMessage(chatId: string, userId: string, content: string, images?: Array<{ url: string; mediaType: string }>): Promise<void> {
    console.log(`🔧 processMessage called for chat ${chatId}, user ${userId}`);
    console.log(`🔧 Content: ${content.substring(0, 50)}...`);
    console.log(`🔧 Images: ${images?.length || 0}`);
    
    try {
      // Add user message first (like in legacy)
      console.log(`🔧 Adding user message to chat ${chatId}`);
      const userMessage = await this.addMessage(chatId, {
        role: 'user',
        content,
        images
      });

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
      let temperature: number = 0.7;
      let maxTokens: number = 4000;

      if (chat.agentId) {
        try {
          agentConfig = await agentService.getAgentById(chat.agentId);
          if (agentConfig) {
            modelId = agentConfig.modelId;
            collectionNames = agentConfig.collectionNames || [];
            systemPrompt = agentConfig.systemPrompt;
            temperature = agentConfig.temperature || 0.7;
            maxTokens = agentConfig.maxTokens || 4000;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to get agent config for ${chat.agentId}:`, error);
        }
      }

      // Process with AI (เหมือน Legacy)
      await this.processWithAILegacy(chatId, content, images, {
        modelId,
        collectionNames,
        systemPrompt,
        temperature,
        maxTokens,
        agentId: chat.agentId
      }, userId);

    } catch (error) {
      console.error('❌ Error in processMessage:', error);
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'error', data: 'Failed to process message' }));
      }
    }
  }

  private async processWithAILegacy(chatId: string, userMessage: string, images?: Array<{ url: string; mediaType: string }>, config?: {
    modelId?: string | null;
    collectionNames?: string[];
    systemPrompt?: string | null;
    temperature?: number;
    maxTokens?: number;
    agentId?: string;
  }, userId?: string): Promise<void> {
    try {
      console.log(`🤖 processWithAILegacy called for chat ${chatId}`);
      console.log(`🤖 User message: ${userMessage.substring(0, 100)}...`);
      console.log(`🤖 Config:`, config);

      // 1. Get chat history
      const chat = await ChatModel.findById(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }

      // 2. Smart Memory Management (เหมือน Legacy)
      const messageCount = chat.messages.length;
      const shouldUseMemoryTool = this.shouldUseMemoryTool(messageCount);
      const shouldUseRedisMemory = this.shouldUseRedisMemory(messageCount);
      const shouldEmbedMessages = this.shouldEmbedMessages(messageCount);

      console.log(`🧠 Memory Management: messageCount=${messageCount}, useMemoryTool=${shouldUseMemoryTool}, useRedisMemory=${shouldUseRedisMemory}, shouldEmbed=${shouldEmbedMessages}`);

      // 3. Embed messages if needed (เหมือน Legacy)
      if (shouldEmbedMessages && chat.messages.length > 0) {
        console.log(`📚 Embedding messages for chat ${chatId} (message count: ${messageCount})`);
        // Embedding is now handled by hybrid memory management
      }

      // 4. Setup hybrid memory management (เหมือน Legacy)
      if (shouldUseRedisMemory) {
        console.log(`💾 Setting up hybrid memory for chat ${chatId}`);
        await memoryService.setupHybridMemory(chatId, chat.messages);
      }

      // 5. เตรียม LLM instance (เหมือน Legacy)
      console.log(`🤖 Creating LLM instance with model ${config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0'}`);
      const llm = getLLM(config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', {
        temperature: config?.temperature,
        maxTokens: config?.maxTokens,
        streaming: true
      });

      // 6. เตรียม tools (รวม memory tool และ retrieval tools)
      const sessionTools = createMemoryTool(chatId);
      const allTools: { [name: string]: ToolFunction } = {};
      
      // Add static tools
      for (const [k, v] of Object.entries(toolRegistry)) allTools[k] = v.func;
      
      // Add session-specific memory tools
      for (const [k, v] of Object.entries(sessionTools)) allTools[k] = v.func;

      // Add retrieval tools for collections (เหมือน Legacy)
      if (config?.collectionNames && config.collectionNames.length > 0) {
        const retrievalTools = createRetrievalTools(config.collectionNames);
        for (const [name, tool] of Object.entries(retrievalTools)) {
          allTools[name] = (tool as any).func;
          console.log(`🔧 Added retrieval tool: ${name}`);
        }
      }

      // 7. เตรียม prompt template (เหมือน Legacy)
      const defaultSystemPrompt = "You are a helpful assistant. You have access to a number of tools and must use them when appropriate. Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.";
      const finalSystemPrompt = config?.systemPrompt || defaultSystemPrompt;
      const promptTemplate = createPromptTemplate(finalSystemPrompt, true);

      // 8. สร้าง agent executor (ใหม่) - ใช้ LangChain Agent
      const agent = await createAgent(llm, allTools, finalSystemPrompt, {
        modelId: config?.modelId || undefined,
        sessionId: chatId,
        temperature: config?.temperature,
        maxTokens: config?.maxTokens
      });

      // 9. ดึงข้อความทั้งหมดจากฐานข้อมูลมาเป็นบริบท
      const chatFromDb = await ChatModel.findById(chatId);
      if (!chatFromDb) throw new Error(`Chat session ${chatId} not found during AI processing`);
      let messages: ChatMessage[] = chatFromDb.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        id: msg.id,
        timestamp: msg.timestamp
      }));

      // เพิ่ม user message ล่าสุด (ถ้ายังไม่มี)
      if (!messages.length || messages[messages.length - 1].role !== 'user') {
        const userMsg = await this.addMessage(chatId, { role: 'user', content: userMessage });
        messages.push(userMsg);
      }

      // 10. เรียก agent.run พร้อม onEvent สำหรับ stream event
      console.log(`🤖 Starting agent.run with ${messages.length} messages`);
      let fullContent = '';
      let assistantMessageId: string | null = null;
      let inputTokens = 0;
      let outputTokens = 0;
      
      await agent.run(messages, {
        onEvent: async (event) => {
          console.log(`🤖 Agent event: ${event.type}`, event.data);
          if (event.type === 'chunk') {
            fullContent += event.data;
            
            // สร้าง assistant message เมื่อได้รับ chunk แรก
            if (!assistantMessageId) {
              const assistantMessage = await this.addMessage(chatId, {
                role: 'assistant',
                content: fullContent,
              });
              assistantMessageId = assistantMessage.id;
              
              // ส่ง event แจ้ง frontend ว่าสร้าง assistant message ใหม่
              if (wsManager.getSessionConnectionCount(chatId) > 0) {
                wsManager.broadcastToSession(chatId, JSON.stringify({ 
                  type: 'assistant_created', 
                  data: { 
                    messageId: assistantMessage.id,
                    content: fullContent 
                  } 
                }));
              }
            } else {
              // อัปเดต assistant message ที่มีอยู่
              await ChatModel.updateOne(
                { _id: chatId, 'messages.id': assistantMessageId },
                { $set: { 'messages.$.content': fullContent, updatedAt: new Date() } }
              );
            }
            
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'chunk', data: event.data }));
            }
          } else if (event.type === 'tool_start') {
            console.log(`🔧 Tool started: ${event.data.tool_name}`);
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'tool_start', data: event.data }));
            }
          } else if (event.type === 'tool_result') {
            console.log(`🔧 Tool completed: ${event.data.tool_name} with result: ${event.data.output.substring(0, 100)}...`);
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'tool_result', data: event.data }));
            }
          } else if (event.type === 'tool_error') {
            console.error(`❌ Tool error: ${event.data.error}`);
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'tool_error', data: event.data }));
            }
          } else if (event.type === 'end') {
            console.log(`🤖 Agent finished with answer: ${event.data.answer.substring(0, 50)}...`);
            
            // อัปเดต assistant message สุดท้าย
            if (assistantMessageId) {
              await ChatModel.updateOne(
                { _id: chatId, 'messages.id': assistantMessageId },
                { $set: { 'messages.$.content': event.data.answer, updatedAt: new Date() } }
              );
            }
            
            // Update usage statistics
            if (event.data.inputTokens || event.data.outputTokens) {
              inputTokens = event.data.inputTokens || 0;
              outputTokens = event.data.outputTokens || 0;
              if (userId && (inputTokens > 0 || outputTokens > 0)) {
                await usageService.updateUsage(userId, inputTokens, outputTokens);
              }
            }
            
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify({ 
                type: 'end', 
                data: { 
                  answer: event.data.answer,
                  inputTokens,
                  outputTokens
                } 
              }));
            }
          }
        },
        maxSteps: 5
      });
    } catch (error) {
      console.error('❌ Error in processWithAILegacy:', error);
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'error', data: 'Failed to process message' }));
      }
    }
  }

  private async streamResponse(chatId: string, messageId: string, response: string): Promise<void> {
    const words = response.split(' ');
    let fullContent = '';
    
    for (let i = 0; i < words.length; i++) {
      const chunk = (i > 0 ? ' ' : '') + words[i];
      fullContent += chunk;
      
      // Update message content in database
      await ChatModel.updateOne(
        { _id: chatId, 'messages.id': messageId },
        { 
          $set: { 
            'messages.$.content': fullContent,
            updatedAt: new Date()
          }
        }
      );
      
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'chunk',
          data: chunk
        }));
      }

      await this.delay(100);
    }
  }

  private async streamResponseLegacy(chatId: string, response: string): Promise<void> {
    const words = response.split(' ');
    let fullContent = '';
    
    // Create assistant message first (like in legacy)
    const assistantMessage = await this.addMessage(chatId, {
      role: 'assistant',
      content: 'กำลังคิด...'
    });
    
    for (let i = 0; i < words.length; i++) {
      const chunk = (i > 0 ? ' ' : '') + words[i];
      fullContent += chunk;
      
      // Update message content in database
      await ChatModel.updateOne(
        { _id: chatId, 'messages.id': assistantMessage.id },
        { 
          $set: { 
            'messages.$.content': fullContent,
            updatedAt: new Date()
          }
        }
      );
      
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'chunk',
          data: chunk
        }));
      }

      await this.delay(100);
    }
  }

  private generateResponse(userMessage: string, images?: Array<{ url: string; mediaType: string }>, config?: {
    modelId?: string | null;
    collectionNames?: string[];
    systemPrompt?: string | null;
    temperature?: number;
    maxTokens?: number;
    agentId?: string;
  }): string {
    // Use system prompt if available
    if (config?.systemPrompt) {
      const responses = [
        `ตามที่กำหนดในระบบ: ${config.systemPrompt}\n\nสำหรับคำถาม "${userMessage}" นี่คือคำตอบ:`,
        `ตามแนวทางของ AI Assistant: ${config.systemPrompt}\n\nคำตอบสำหรับ "${userMessage}":`
      ];
      
      const baseResponse = responses[Math.floor(Math.random() * responses.length)];
      return `${baseResponse} ${this.generateDetailedResponse()}`;
    }

    // Default responses
    const responses = [
      `ฉันเข้าใจคำถามของคุณเกี่ยวกับ "${userMessage}" แล้ว นี่คือคำตอบที่ครอบคลุม:`,
      `ขอบคุณสำหรับคำถาม "${userMessage}" ฉันจะอธิบายให้คุณฟัง:`,
      `สำหรับคำถาม "${userMessage}" นี่คือข้อมูลที่เกี่ยวข้อง:`,
      `ฉันได้วิเคราะห์คำถาม "${userMessage}" ของคุณแล้ว และนี่คือสิ่งที่ฉันพบ:`
    ];

    const baseResponse = responses[Math.floor(Math.random() * responses.length)];
    return `${baseResponse} ${this.generateDetailedResponse()}`;
  }

  private generateDetailedResponse(): string {
    const responses = [
      "นี่คือข้อมูลที่ครอบคลุมและทันสมัยเกี่ยวกับเรื่องที่คุณถาม",
      "ฉันได้รวบรวมข้อมูลจากแหล่งที่เชื่อถือได้เพื่อตอบคำถามของคุณ",
      "ข้อมูลนี้ได้รับการอัปเดตล่าสุดและมีความแม่นยำสูง",
      "ฉันหวังว่าข้อมูลนี้จะช่วยตอบคำถามของคุณได้อย่างครบถ้วน"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async getUserChats(userId: string): Promise<Chat[]> {
    const chats = await ChatModel.find({ userId })
      .sort({ updatedAt: -1 })
      .exec();

    return chats;
  }

  public async deleteChat(chatId: string, userId: string): Promise<boolean> {
    const result = await ChatModel.deleteOne({ _id: chatId, userId });
    const success = result.deletedCount > 0;
    
    if (success) {
      console.log(`✅ Deleted chat ${chatId} for user ${userId}`);
    } else {
      console.log(`❌ Failed to delete chat ${chatId} for user ${userId}`);
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
      console.log(`📝 Updated chat name for session ${chatId}: ${name}`);
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
      // Clear all memory using hybrid approach (เหมือน Legacy)
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
    // Use memory tool when there are more than 10 messages (เหมือน Legacy)
    return messageCount > 10;
  }

  private shouldUseRedisMemory(messageCount: number): boolean {
    // Always use Redis memory for recent conversations (เหมือน Legacy)
    return true;
  }

  private shouldEmbedMessages(messageCount: number): boolean {
    // Embed messages every 10 messages (10, 20, 30, etc.) - เหมือน Legacy
    return messageCount % 10 === 0;
  }

  public getStats(): any {
    return {
      totalChats: 0, // TODO: Implement actual stats
      activeSessions: 0, // TODO: Implement active session count
      totalMessages: 0
    };
  }
}

export const chatService = new ChatService(); 