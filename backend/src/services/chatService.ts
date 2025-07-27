import { ChatModel, ChatMessage } from '../models/chat';
import { LangChainAgent, LangChainAgentConfig } from '../agent/langchainAgent';
import { ChainFactory, ChainConfig } from '../agent/chainFactory';
import { agentService } from './agentService';
import { wsManager } from '../utils/websocketManager';
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

export class ChatService {
  private agentInstances: Map<string, LangChainAgent> = new Map();
  private chainInstances: Map<string, ChainFactory> = new Map();

  constructor() {
    console.log('✅ Chat service initialized');
  }

  public async createChat(userId: string, name: string, agentId?: string): Promise<any> {
    try {
      const chat = new ChatModel({
        userId,
        name,
        agentId: agentId || '000000000000000000000001',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false,
      });

      await chat.save();
      console.log(`✅ Created chat: ${chat.name} for user: ${userId}`);
      return this.normalizeChat(chat.toObject());
    } catch (error) {
      console.error('Error creating chat:', error);
      throw new Error(`Failed to create chat: ${error}`);
    }
  }

  public async getChat(chatId: string, userId: string): Promise<any | null> {
    try {
      const chat = await ChatModel.findOne({ _id: chatId, userId }).lean();
      return chat ? this.normalizeChat(chat) : null;
    } catch (error) {
      console.error(`Error fetching chat ${chatId}:`, error);
      return null;
    }
  }

  public async getUserChats(userId: string): Promise<any[]> {
    try {
      const chats = await ChatModel.find({ userId })
        .sort({ isPinned: -1, updatedAt: -1 })
        .lean()
        .exec();
      
      return chats.map(chat => this.normalizeChat(chat));
    } catch (error) {
      console.error('Error fetching user chats:', error);
      return [];
    }
  }

  public async updateChatName(chatId: string, userId: string, name: string): Promise<any | null> {
    try {
      const chat = await ChatModel.findOneAndUpdate(
        { _id: chatId, userId },
        { name, updatedAt: new Date() },
        { new: true }
      ).lean();
      
      return chat ? this.normalizeChat(chat) : null;
    } catch (error) {
      console.error(`Error updating chat name ${chatId}:`, error);
      return null;
    }
  }

  public async updateChatPinStatus(chatId: string, userId: string, isPinned: boolean): Promise<any | null> {
    try {
      const chat = await ChatModel.findOneAndUpdate(
        { _id: chatId, userId },
        { isPinned, updatedAt: new Date() },
        { new: true }
      ).lean();
      
      return chat ? this.normalizeChat(chat) : null;
    } catch (error) {
      console.error(`Error updating chat pin status ${chatId}:`, error);
      return null;
    }
  }

  public async deleteChat(chatId: string, userId: string): Promise<boolean> {
    try {
      const result = await ChatModel.findOneAndDelete({ _id: chatId, userId });
      return !!result;
    } catch (error) {
      console.error(`Error deleting chat ${chatId}:`, error);
      return false;
    }
  }

  public async clearChatMemory(chatId: string): Promise<void> {
    try {
      // Clear memory from agent/chain instances
      const agent = this.agentInstances.get(chatId);
      if (agent) {
        // Clear memory (implementation depends on agent type)
        this.agentInstances.delete(chatId);
      }

      const chain = this.chainInstances.get(chatId);
      if (chain) {
        // Clear memory (implementation depends on chain type)
        this.chainInstances.delete(chatId);
      }

      console.log(`✅ Cleared memory for chat: ${chatId}`);
    } catch (error) {
      console.error(`Error clearing chat memory ${chatId}:`, error);
    }
  }

  public async processMessage(
    chatId: string, 
    userId: string, 
    message: string, 
    images?: Array<{ url: string; mediaType: string }>
  ): Promise<void> {
    try {
      // Get chat
      const chat = await this.getChat(chatId, userId);
      if (!chat) {
        throw new Error('Chat not found');
      }

      // Add user message to chat
      const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date(),
        images: images || []
      };

      await ChatModel.findByIdAndUpdate(chatId, {
        $push: { messages: userMessage },
        $set: { updatedAt: new Date() }
      });

      // Send user message to WebSocket clients
      wsManager.broadcastToSession(chatId, JSON.stringify({
        type: 'user_message',
        data: userMessage
      }));

      // Get agent configuration
      const agent = await agentService.getAgentById(chat.agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Determine processing method based on agent configuration
      const useLangChainAgent = agent.tools && agent.tools.length > 0;
      
      let response: string;
      
      if (useLangChainAgent) {
        response = await this.processWithLangChainAgent(chatId, agent, message, images);
      } else {
        response = await this.processWithChain(chatId, agent, message, images);
      }

      // Add assistant message to chat
      const assistantMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      await ChatModel.findByIdAndUpdate(chatId, {
        $push: { messages: assistantMessage },
        $set: { updatedAt: new Date() }
      });

      // Increment agent usage count
      await agentService.incrementUsageCount(agent.id);

      // Send assistant message to WebSocket clients
      wsManager.broadcastToSession(chatId, JSON.stringify({
        type: 'assistant_message',
        data: assistantMessage
      }));

      console.log(`✅ Processed message in chat: ${chatId}`);

    } catch (error) {
      console.error(`Error processing message in chat ${chatId}:`, error);
      
      // Send error message to WebSocket clients
      wsManager.broadcastToSession(chatId, JSON.stringify({
        type: 'error',
        data: 'Failed to process message'
      }));
    }
  }

  private async processWithLangChainAgent(
    chatId: string, 
    agent: any, 
    message: string, 
    images?: Array<{ url: string; mediaType: string }>
  ): Promise<string> {
    try {
      // Get or create LangChain agent instance
      let langChainAgent = this.agentInstances.get(chatId);
      
      if (!langChainAgent) {
        const config: LangChainAgentConfig = {
          modelId: agent.modelId,
          systemPrompt: agent.systemPrompt,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          tools: agent.tools.map((tool: any) => tool.name),
          collectionNames: agent.collectionNames || [],
          sessionId: chatId
        };

        langChainAgent = new LangChainAgent(config);
        await langChainAgent.initialize();
        this.agentInstances.set(chatId, langChainAgent);
      }

      // Convert messages to LangChain format
      const chat = await this.getChat(chatId, '');
      const langChainMessages = this.convertToLangChainMessages(chat.messages);

      // Process message
      const response = await langChainAgent.processMessage(langChainMessages, (event) => {
        // Send streaming events to WebSocket
        wsManager.broadcastToSession(chatId, JSON.stringify(event));
      });

      return response;

    } catch (error) {
      console.error('Error processing with LangChain agent:', error);
      throw error;
    }
  }

  private async processWithChain(
    chatId: string, 
    agent: any, 
    message: string, 
    images?: Array<{ url: string; mediaType: string }>
  ): Promise<string> {
    try {
      // Get or create chain instance
      let chain = this.chainInstances.get(chatId);
      
      if (!chain) {
        const config: ChainConfig = {
          modelId: agent.modelId,
          systemPrompt: agent.systemPrompt,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          chainType: agent.collectionNames && agent.collectionNames.length > 0 ? 'rag' : 'conversational',
          collectionNames: agent.collectionNames || [],
          sessionId: chatId
        };

        chain = new ChainFactory(config);
        await chain.initialize();
        this.chainInstances.set(chatId, chain);
      }

      // Convert messages to LangChain format
      const chat = await this.getChat(chatId, '');
      const langChainMessages = this.convertToLangChainMessages(chat.messages);

      // Process message
      const response = await chain.processMessage(langChainMessages, (event) => {
        // Send streaming events to WebSocket
        wsManager.broadcastToSession(chatId, JSON.stringify(event));
      });

      return response;

    } catch (error) {
      console.error('Error processing with chain:', error);
      throw error;
    }
  }

  private convertToLangChainMessages(messages: any[]): any[] {
    return messages.map(msg => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      } else if (msg.role === 'system') {
        return new SystemMessage(msg.content);
      }
      return null;
    }).filter(Boolean);
  }

  private normalizeChat(chat: any): any {
    return {
      id: chat._id?.toString() || chat.id,
      userId: chat.userId,
      name: chat.name,
      agentId: chat.agentId,
      messages: chat.messages || [],
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      isPinned: chat.isPinned || false,
    };
  }

  public getStats(): any {
    return {
      totalChats: this.agentInstances.size + this.chainInstances.size,
      activeAgents: this.agentInstances.size,
      activeChains: this.chainInstances.size,
      uptime: process.uptime()
    };
  }
}

// Export singleton instance
export const chatService = new ChatService(); 