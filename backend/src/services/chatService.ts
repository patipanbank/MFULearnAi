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

  async createChat(userId: string, agentId: string, name?: string): Promise<typeof ChatModel> {
    try {
      const chat = new ChatModel({
        userId,
        agentId,
        name: name || `Chat with ${agentId}`,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await chat.save();
      return chat;
    } catch (error) {
      console.error('❌ Error creating chat:', error);
      throw error;
    }
  }

  async getChat(chatId: string): Promise<typeof ChatModel | null> {
    try {
      return await ChatModel.findById(chatId);
    } catch (error) {
      console.error('❌ Error getting chat:', error);
      return null;
    }
  }

  async getUserChats(userId: string): Promise<typeof ChatModel[]> {
    try {
      return await ChatModel.find({ userId }).sort({ updatedAt: -1 });
    } catch (error) {
      console.error('❌ Error getting user chats:', error);
      return [];
    }
  }

  async updateChatName(chatId: string, name: string): Promise<boolean> {
    try {
      const result = await ChatModel.findByIdAndUpdate(chatId, { name });
      return !!result;
    } catch (error) {
      console.error('❌ Error updating chat name:', error);
      return false;
    }
  }

  async updateChatPinStatus(chatId: string, isPinned: boolean): Promise<boolean> {
    try {
      const result = await ChatModel.findByIdAndUpdate(chatId, { isPinned });
      return !!result;
    } catch (error) {
      console.error('❌ Error updating chat pin status:', error);
      return false;
    }
  }

  async deleteChat(chatId: string): Promise<boolean> {
    try {
      const result = await ChatModel.findByIdAndDelete(chatId);
      
      // Clear instances
      this.agentInstances.delete(chatId);
      this.chainInstances.delete(chatId);
      
      return !!result;
    } catch (error) {
      console.error('❌ Error deleting chat:', error);
      return false;
    }
  }

  async clearChatMemory(chatId: string): Promise<boolean> {
    try {
      // Clear instances
      this.agentInstances.delete(chatId);
      this.chainInstances.delete(chatId);
      
      // Clear messages in database
      const result = await ChatModel.findByIdAndUpdate(chatId, { messages: [] });
      return !!result;
    } catch (error) {
      console.error('❌ Error clearing chat memory:', error);
      return false;
    }
  }

  public async processMessage(
    chatId: string,
    userId: string,
    message: string,
    images?: Array<{ url: string; mediaType: string }>
  ): Promise<void> {
    try {
      const chat = await this.getChat(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date(),
        images,
      };

      chat.messages.push(userMessage);
      chat.updatedAt = new Date();
      await chat.save();

      // Broadcast user message
      wsManager.broadcastToSession(chatId, JSON.stringify({
        type: 'user_message',
        data: userMessage
      }));

      const agent = await agentService.getAgentById(chat.agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const useLangChainAgent = agent.tools && agent.tools.length > 0;

      let response: string;

      if (useLangChainAgent) {
        response = await this.processWithLangChainAgent(chatId, agent, message, images);
      } else {
        response = await this.processWithChain(chatId, agent, message, images);
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      chat.messages.push(assistantMessage);
      chat.updatedAt = new Date();
      await chat.save();

      // Increment usage
      await agentService.incrementUsageCount(agent.id);

      // Broadcast assistant message
      wsManager.broadcastToSession(chatId, JSON.stringify({
        type: 'assistant_message',
        data: assistantMessage
      }));

    } catch (error) {
      console.error(`Error processing message in chat ${chatId}:`, error);
      wsManager.broadcastToSession(chatId, JSON.stringify({ type: 'error', data: 'Failed to process message' }));
    }
  }

  private async processWithLangChainAgent(
    chatId: string,
    agent: any,
    message: string,
    images?: Array<{ url: string; mediaType: string }>
  ): Promise<string> {
    let agentInstance = this.agentInstances.get(chatId);
    
    if (!agentInstance) {
      const config: LangChainAgentConfig = {
        modelId: agent.modelId,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        tools: agent.tools || [],
        collectionNames: agent.collectionNames || [],
        sessionId: chatId,
      };

      agentInstance = new LangChainAgent(config);
      await agentInstance.initialize();
      this.agentInstances.set(chatId, agentInstance);
    }

    const messages = this.convertToLangChainMessages(agent.messages || []);
    messages.push(new HumanMessage(message));

    return await agentInstance.processMessage(messages);
  }

  private async processWithChain(
    chatId: string,
    agent: any,
    message: string,
    images?: Array<{ url: string; mediaType: string }>
  ): Promise<string> {
    let chainInstance = this.chainInstances.get(chatId);
    
    if (!chainInstance) {
      const config: ChainConfig = {
        modelId: agent.modelId,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        chainType: 'conversational',
        collectionNames: agent.collectionNames || [],
        sessionId: chatId,
      };

      chainInstance = new ChainFactory(config);
      await chainInstance.initialize();
      this.chainInstances.set(chatId, chainInstance);
    }

    const messages = this.convertToLangChainMessages(agent.messages || []);
    messages.push(new HumanMessage(message));

    return await chainInstance.processMessage(messages);
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
      return msg;
    });
  }

  private normalizeChat(chat: any): any {
    return {
      id: chat._id,
      userId: chat.userId,
      agentId: chat.agentId,
      name: chat.name,
      messages: chat.messages || [],
      isPinned: chat.isPinned || false,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  }
}

export const chatService = new ChatService(); 