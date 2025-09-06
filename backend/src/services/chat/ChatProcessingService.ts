import { ChatModel } from '../../models/chat';
import { wsManager } from '../../utils/websocketManager';
import { agentService } from '../agentService';
import { usageService } from '../usageService';
import { getLLM } from '../../agent/llmFactory';
import { toolRegistry, createMemoryTool, createRetrievalTools, ToolFunction } from '../../agent/toolRegistry';
import { createAgent } from '../../agent/agentFactory';
import { chatMessageService } from './ChatMessageService';
import { chatMemoryService } from './ChatMemoryService';
import type { ChatConfig, ProcessingOptions, EventCallback, AgentCacheEntry } from './types/chat-service.types';

export class ChatProcessingService {
  private agentCache: Map<string, AgentCacheEntry> = new Map();

  constructor() {
    console.log('✅ Chat processing service initialized');
  }

  public async processMessage(
    chatId: string, 
    userId: string, 
    content: string, 
    images?: Array<{ url: string; mediaType: string }>
  ): Promise<void> {
    console.log(`🔧 Processing message for chat ${chatId}, user ${userId}`);
    
    try {
      // Add user message first
      await chatMessageService.addMessage(chatId, {
        role: 'user',
        content,
        images
      });

      // Get chat and agent configuration
      const chat = await ChatModel.findById(chatId);
      if (!chat) {
        throw new Error(`Chat session ${chatId} not found`);
      }

      let config: ChatConfig = {
        modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        collectionNames: [],
        systemPrompt: null,
        temperature: 0.7,
        maxTokens: 4000,
        agentId: chat.agentId
      };

      if (chat.agentId) {
        try {
          const agentConfig = await agentService.getAgentById(chat.agentId);
          if (agentConfig) {
            config.modelId = agentConfig.modelId;
            config.collectionNames = agentConfig.collectionNames || [];
            config.systemPrompt = agentConfig.systemPrompt;
            config.temperature = agentConfig.temperature || 0.7;
            config.maxTokens = agentConfig.maxTokens || 4000;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to get agent config for ${chat.agentId}:`, error);
        }
      }

      await this.processWithAI(chatId, content, images, config, userId);

    } catch (error) {
      console.error('❌ Error in processMessage:', error);
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'error', data: 'Failed to process message' }));
      }
    }
  }

  private async processWithAI(
    chatId: string, 
    userMessage: string, 
    images?: Array<{ url: string; mediaType: string }>, 
    config?: ChatConfig, 
    userId?: string
  ): Promise<void> {
    try {
      console.log(`🤖 Processing with AI for chat ${chatId}`);

      // Get chat history
      const chat = await ChatModel.findById(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }

      // Analyze memory needs
      const memoryConfig = chatMemoryService.analyzeMemoryNeeds(chat.messages.length);
      console.log(`🧠 Memory config:`, memoryConfig);

      // Setup agent with caching
      const agent = await this.getOrCreateAgent(chatId, config || {});

      // Prepare messages for processing
      const messages = chatMessageService.enrichMessagesWithImages(chat.messages);

      // Prepare images for multimodal
      const preparedImages = await chatMessageService.prepareImagesForMultimodal(images);

      // Check quota before processing
      if (userId) {
        const quotaCheck = await usageService.checkQuotaAndUsage(userId, 0, 100);
        if (!quotaCheck.canUse) {
          console.warn(`⚠️ Quota check failed for user ${userId}: ${quotaCheck.reason}`);
          
          if (wsManager.getSessionConnectionCount(chatId) > 0) {
            wsManager.broadcastToSession(chatId, JSON.stringify({
              type: 'quota_exceeded',
              data: {
                reason: quotaCheck.reason,
                timestamp: new Date().toISOString()
              }
            }));
          }
          
          throw new Error(`Token quota exceeded: ${quotaCheck.reason}`);
        }
      }

      // Process with agent
      await this.executeAgent(chatId, agent, messages, preparedImages, userId);

    } catch (error) {
      console.error('❌ Error in processWithAI:', error);
      if (wsManager.getSessionConnectionCount(chatId) > 0) {
        wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'error', data: 'Failed to process message' }));
      }
    }
  }

  private async getOrCreateAgent(chatId: string, config: ChatConfig): Promise<any> {
    const defaultSystemPrompt = "You are a helpful assistant. You have access to a number of tools and must use them when appropriate. Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.";
    const finalSystemPrompt = config.systemPrompt || defaultSystemPrompt;

    const signaturePayload = {
      modelId: config.modelId || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4000,
      systemPrompt: finalSystemPrompt,
      collections: (config.collectionNames || []).slice().sort(),
      agentId: config.agentId || null
    };

    const signature = JSON.stringify(signaturePayload);
    const cached = this.agentCache.get(chatId);

    if (cached && cached.signature === signature) {
      console.log(`⚡ Reusing cached agent for chat ${chatId}`);
      return cached.executor;
    }

    console.log(`🤖 Creating new agent for chat ${chatId}`);
    
    const llm = getLLM(signaturePayload.modelId, {
      temperature: signaturePayload.temperature,
      maxTokens: signaturePayload.maxTokens,
      streaming: true
    });

    // Prepare tools
    const sessionTools = createMemoryTool(chatId);
    const allTools: { [name: string]: ToolFunction } = {};
    
    for (const [k, v] of Object.entries(toolRegistry)) allTools[k] = v.func;
    for (const [k, v] of Object.entries(sessionTools)) allTools[k] = v.func;
    
    if (signaturePayload.collections && signaturePayload.collections.length > 0) {
      const retrievalTools = createRetrievalTools(signaturePayload.collections);
      for (const [name, tool] of Object.entries(retrievalTools)) {
        allTools[name] = (tool as any).func;
        console.log(`🔧 Added retrieval tool: ${name}`);
      }
    }

    const agent = await createAgent(llm, allTools, finalSystemPrompt, {
      modelId: signaturePayload.modelId,
      sessionId: chatId,
      temperature: signaturePayload.temperature,
      maxTokens: signaturePayload.maxTokens
    });

    this.agentCache.set(chatId, { signature, executor: agent });
    return agent;
  }

  private async executeAgent(
    chatId: string, 
    agent: any, 
    messages: any[], 
    preparedImages: any[], 
    userId?: string
  ): Promise<void> {
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let assistantMessageId: string | null = null;

    console.log(`🤖 Starting agent execution with ${messages.length} messages`);

    await agent.run(messages, {
      onEvent: async (event: { type: string; data?: any }) => {
        await this.handleAgentEvent(event, chatId, assistantMessageId, userId);
        
        if (event.type === 'chunk') {
          fullContent += event.data;
          if (fullContent === event.data) {
            // First chunk - create assistant message
            const assistantMessage = await chatMessageService.addMessage(chatId, {
              role: 'assistant',
              content: '',
            });
            assistantMessageId = assistantMessage.id;
          }
        } else if (event.type === 'end') {
          // Update final content and handle memory
          if (assistantMessageId) {
            await chatMessageService.updateMessage(chatId, assistantMessageId, {
              content: event.data.answer,
            });
          }

          // Setup hybrid memory
          const updatedChat = await ChatModel.findById(chatId);
          if (updatedChat) {
            await chatMemoryService.setupHybridMemory(chatId, updatedChat.messages);
          }

          // Update usage statistics
          if (event.data.inputTokens || event.data.outputTokens) {
            inputTokens = event.data.inputTokens || 0;
            outputTokens = event.data.outputTokens || 0;
            
            if (userId && (inputTokens > 0 || outputTokens > 0)) {
              const updateResult = await usageService.updateUsage(userId, inputTokens, outputTokens);
              if (!updateResult.success) {
                console.warn(`⚠️ Usage update failed for user ${userId}: ${updateResult.reason}`);
              }
            }
          }
        }
      },
      maxSteps: 5,
      images: preparedImages
    });
  }

  private async handleAgentEvent(
    event: { type: string; data?: any }, 
    chatId: string, 
    assistantMessageId: string | null, 
    userId?: string
  ): Promise<void> {
    console.log(`🤖 Agent event: ${event.type}`, event.data);

    if (wsManager.getSessionConnectionCount(chatId) > 0) {
      let wsMessage: any;

      switch (event.type) {
        case 'chunk':
          wsMessage = { 
            type: 'chunk', 
            data: { 
              messageId: assistantMessageId,
              delta: event.data
            }
          };
          break;
        
        case 'tool_start':
          wsMessage = { 
            type: 'tool_start', 
            data: {
              tool_name: event.data.tool_name,
              tool_input: event.data.tool_input
            }
          };
          break;
        
        case 'tool_result':
          wsMessage = { 
            type: 'tool_result', 
            data: {
              tool_name: event.data.tool_name,
              output: event.data.output || 'No output available'
            }
          };
          break;
        
        case 'tool_error':
          wsMessage = { 
            type: 'tool_error', 
            data: {
              tool_name: event.data.tool_name,
              error: event.data.error
            }
          };
          break;
        
        case 'assistant_created':
          wsMessage = { 
            type: 'assistant_created', 
            data: { 
              messageId: event.data.messageId,
              content: event.data.content 
            } 
          };
          break;
        
        case 'end':
          wsMessage = { 
            type: 'end', 
            data: { 
              messageId: assistantMessageId,
              answer: event.data.answer,
              inputTokens: event.data.inputTokens || 0,
              outputTokens: event.data.outputTokens || 0
            } 
          };
          break;
      }

      if (wsMessage) {
        wsManager.broadcastToSession(chatId, JSON.stringify(wsMessage));
      }
    }
  }

  public getStats(): any {
    return {
      cachedAgents: this.agentCache.size,
      totalChats: 0,
      activeSessions: 0,
      totalMessages: 0
    };
  }
}

export const chatProcessingService = new ChatProcessingService();