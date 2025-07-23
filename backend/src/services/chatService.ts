import { ChatModel, Chat, ChatMessage } from '../models/chat';
import { wsManager } from '../utils/websocketManager';
import { agentService } from './agentService';
import { usageService } from './usageService';
import { getLLM } from '../agent/llmFactory';
import { toolRegistry, createMemoryTool, ToolFunction } from '../agent/toolRegistry';
import { createPromptTemplate } from '../agent/promptFactory';
import { createAgent } from '../agent/agentFactory';
import { redis } from '../lib/redis';
import { memoryService } from './memoryService';

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
    if (!message.content || message.content.trim() === '') {
      message.content = 'กำลังประมวลผล...';
    }

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
    try {
      // Add user message first (like in legacy)
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

      // Process with AI agent using legacy-style processing (no placeholder message)
      await this.processWithAILegacy(chatId, content, images, {
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

  private async processWithAILegacy(chatId: string, userMessage: string, images?: Array<{ url: string; mediaType: string }>, config?: {
    modelId?: string | null;
    collectionNames?: string[];
    systemPrompt?: string | null;
    temperature?: number;
    maxTokens?: number;
    agentId?: string;
  }, userId?: string): Promise<void> {
    try {
      // Simulate thinking time
      await this.delay(1000);

      // === LangChain agent graph logic ===
      const agentId = config?.agentId;
      if (!agentId) throw new Error('No agentId');
      // 1. เตรียม LLM instance
      const llm = getLLM(config?.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0', {
        temperature: config?.temperature,
        maxTokens: config?.maxTokens
      });
      // 2. เตรียม tools (รวม memory tool)
      const sessionTools = createMemoryTool(chatId);
      // map ToolMeta เป็น ToolFunction
      const allTools: { [name: string]: ToolFunction } = {};
      for (const [k, v] of Object.entries(toolRegistry)) allTools[k] = v.func;
      for (const [k, v] of Object.entries(sessionTools)) allTools[k] = v.func;
      // 3. เตรียม prompt template
      const promptTemplate = createPromptTemplate(config?.systemPrompt || '', true);
      // 4. สร้าง agent executor
      const agent = createAgent(llm, allTools, config?.systemPrompt || '');
      // 5. วน loop agent graph (multi-turn)
      // ดึงข้อความทั้งหมดจากฐานข้อมูลมาเป็นบริบท
      const chatFromDb = await ChatModel.findById(chatId);
      if (!chatFromDb) {
        throw new Error(`Chat session ${chatId} not found during AI processing`);
      }
      let messages: ChatMessage[] = chatFromDb.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        id: msg.id,
        timestamp: msg.timestamp
      }));
      // ลบข้อความล่าสุดของผู้ใช้ที่เราเพิ่งเพิ่มไป (เพราะ agent จะประมวลผลจาก prompt ที่สร้างจาก messages นี้)
      // และเราจะเพิ่มมันเข้าไปใหม่เมื่อ LLM ให้คำตอบ
      const userMessageInDb = messages[messages.length - 1];
      messages = messages.slice(0, messages.length - 1);
      // เพิ่ม userMessageInDb กลับเข้า messages (user message ล่าสุด)
      messages.push(userMessageInDb);

      // เพิ่มข้อความผู้ใช้ล่าสุดเข้า Redis (recent history)
      await memoryService.addRecentMessage(chatId, userMessageInDb);

      // ตรวจสอบและฝังข้อความลง long-term memory (ChromaDB) ทุกๆ 10 ข้อความ
      const currentMessageCount = chatFromDb.messages.length;
      if (this.shouldEmbedMessages(currentMessageCount)) {
        // Note: ให้ LLM เรียก tool memory_embed เพื่อสร้าง embeddings
      }

      // สร้าง assistant message และเพิ่มเข้า messages
      const assistantMessage = await this.addMessage(chatId, {
        role: 'assistant',
        content: '',
      });
      messages.push(assistantMessage);
      let fullContent = '';
      let turn = 0;
      let done = false;
      while (!done && turn < 5) {
        turn++;
        // 5.1 สร้าง prompt
        const prompt = promptTemplate(messages);
        // 5.2 เรียก LLM แบบ streaming
        let output = '';
        let isToolCall = false;
        let toolMatch: RegExpMatchArray | null = null;
        let chunkBuffer = '';
        try {
          for await (const chunk of llm.stream(prompt)) {
            chunkBuffer += chunk;
            toolMatch = chunkBuffer.match(/\[TOOL:([\w_]+)\](.*)/s);
            if (toolMatch) {
              isToolCall = true;
              break;
            }
            output += chunk;
            fullContent += chunk;
            await ChatModel.updateOne(
              { _id: chatId, 'messages.id': assistantMessage.id },
              { $set: { 'messages.$.content': fullContent, updatedAt: new Date() } }
            );
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'chunk',
                data: chunk
              }));
            }
          }
        } catch (err) {
          console.error('❌ Error during LLM streaming:', err);
          break;
        }
        // 5.3 Parse output: ถ้ามี [TOOL:name] ให้เรียก tool นั้น
        if (isToolCall && toolMatch) {
          const toolName = toolMatch[1];
          const toolInput = toolMatch[2]?.trim() || '';
          if (allTools[toolName]) {
            // Broadcast tool_start event
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'tool_start',
                data: {
                  tool_name: toolName,
                  tool_input: toolInput
                }
              }));
            }

            const toolResult = await allTools[toolName](toolInput, chatId);
            // Broadcast tool_result event
            if (wsManager.getSessionConnectionCount(chatId) > 0) {
              wsManager.broadcastToSession(chatId, JSON.stringify({
                type: 'tool_result',
                data: {
                  tool_name: toolName,
                  output: toolResult
                }
              }));
            }
            // เพิ่ม tool result message (user) ที่สมบูรณ์เข้า messages
            const toolResultMessage = await this.addMessage(chatId, {
              role: 'user',
              content: `[TOOL_RESULT:${toolName}] ${toolResult}`,
            });
            messages.push(toolResultMessage);
            continue;
          } else {
            messages.push({ ...assistantMessage, content: `[Error: Tool ${toolName} not found]` });
            done = true;
            fullContent += `[Error: Tool ${toolName} not found]`;
            break;
          }
        } else {
          // ไม่มี tool call, ถือว่าเป็น final answer
          messages.push({ ...assistantMessage, content: output });
          fullContent += output;
          done = true;
        }
        // หลังจาก LLM ตอบกลับหรือ tool ทำงาน: อัปเดต Redis ด้วยข้อความล่าสุดของผู้ช่วย
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
          await memoryService.addRecentMessage(chatId, lastMessage);
        } else if (lastMessage && lastMessage.role === 'user' && lastMessage.content && lastMessage.content.startsWith('[TOOL_RESULT:')) {
          await memoryService.addRecentMessage(chatId, lastMessage);
        }
      }
      // Calculate tokens and update usage
      const inputTokens = Math.floor(userMessage.length / 4);
      const outputTokens = Math.floor(fullContent.length / 4);
      if (userId) {
        await usageService.updateUsage(userId, inputTokens, outputTokens);
      }
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'end',
          data: {
            sessionId: chatId,
            inputTokens,
            outputTokens
          }
        }));
      }
    } catch (error) {
      console.error('❌ Error in AI processing:', error);
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({
          type: 'error',
          data: 'Failed to process AI response'
        }));
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
      content: ''
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
    
    if (images && images.length > 0) {
      return `${baseResponse} ฉันเห็นว่าคุณได้แนบรูปภาพมาด้วย ฉันจะวิเคราะห์ทั้งข้อความและรูปภาพเพื่อให้คำตอบที่ครบถ้วนที่สุด. ${this.generateDetailedResponse()}`;
    }

    return `${baseResponse} ${this.generateDetailedResponse()}`;
  }

  private generateDetailedResponse(): string {
    const details = [
      `ข้อมูลนี้จะช่วยให้คุณเข้าใจแนวคิดได้ดีขึ้น และสามารถนำไปประยุกต์ใช้ในสถานการณ์จริงได้.`,
      `หากคุณต้องการข้อมูลเพิ่มเติมหรือมีคำถามอื่นๆ อย่าลังเลที่จะถามได้เลย.`,
      `ฉันหวังว่าคำตอบนี้จะช่วยให้คุณเข้าใจประเด็นนี้ได้ชัดเจนขึ้น.`,
      `หากมีส่วนไหนที่ยังไม่ชัดเจน กรุณาแจ้งให้ฉันทราบเพื่อที่ฉันจะได้อธิบายเพิ่มเติม.`
    ];

    return details[Math.floor(Math.random() * details.length)];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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
      // Clear Redis memory
      await redis.del(`chat:history:${chatId}`);
      // Clear memory tool (ถ้ามี)
      if (typeof (global as any).clearChatMemoryTool === 'function') {
        await (global as any).clearChatMemoryTool(chatId);
      }
      console.log(`✅ Memory cleared for chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to clear memory for chat ${chatId}:`, error);
    }
  }

  private async getRecentMessagesFromRedis(chatId: string): Promise<any[]> {
    try {
      const data = await redis.get(`chat:history:${chatId}`);
      if (!data) return [];
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  private async setRecentMessagesToRedis(chatId: string, messages: any[]): Promise<void> {
    try {
      await redis.set(`chat:history:${chatId}`,
        JSON.stringify(messages), 'EX', 86400 // TTL 24 ชม.
      );
    } catch (e) {
      // fallback เงียบ ๆ
    }
  }

  private async restoreRecentContextIfNeeded(chatId: string, allMessages: any[]): Promise<void> {
    const redisMessages = await this.getRecentMessagesFromRedis(chatId);
    if (!redisMessages || redisMessages.length === 0) {
      // Restore recent 10 messages
      const recent = allMessages.slice(-10);
      await this.setRecentMessagesToRedis(chatId, recent);
      console.log(`🔄 Restored recent context to Redis for chat ${chatId}`);
    }
  }

  private async embedMessagesIfNeeded(chatId: string, allMessages: any[]): Promise<void> {
    if (allMessages.length % 10 === 0 && allMessages.length > 0) {
      // ฝัง embedding ทุก 10 ข้อความ (mock call memory tool)
      if (typeof (global as any).addChatMemoryTool === 'function') {
        await (global as any).addChatMemoryTool(chatId, allMessages);
        console.log(`📚 Embedded ${allMessages.length} messages to memory tool for chat ${chatId}`);
      }
    }
  }

  private shouldUseMemoryTool(messageCount: number): boolean {
    // Use memory tool when there are more than 10 messages
    return messageCount > 10;
  }

  private shouldUseRedisMemory(messageCount: number): boolean {
    // Always use Redis memory for recent conversations (last 10 messages)
    return true;
  }

  private shouldEmbedMessages(messageCount: number): boolean {
    // Embed messages every 10 messages (10, 20, 30, etc.)
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