import { create } from 'zustand';
import { api } from '../lib/api';
import { agentManager, toolRegistry } from './agentService';
import { knowledgeEngine } from './knowledgeService';
import type { 
  Conversation, 
  Message, 
  ConversationContext, 
  User,
  Agent,
  AgentRuntime,
  SearchResult,
  ToolExecution 
} from '../types';

// Message Processor - handles message processing and tool usage
class MessageProcessor {
  async processMessage(
    message: string, 
    agentRuntime: AgentRuntime, 
    context: ConversationContext
  ): Promise<Message> {
    const startTime = Date.now();

    try {
      // Update agent status
      agentManager.updateStatus(agentRuntime.id, 'thinking');

      // Analyze message for tool usage
      const toolsNeeded = this.analyzeToolNeeds(message, agentRuntime.agent);
      
      let response = '';
      const toolUsage: Message['toolUsage'] = [];

      // Execute tools if needed
      if (toolsNeeded.length > 0) {
        agentManager.updateStatus(agentRuntime.id, 'processing', 'Using tools');
        
        for (const tool of toolsNeeded) {
          const execution = await this.executeTool(tool.id, tool.params, context);
          toolUsage.push({
            type: execution.error ? 'error' : 'result',
            toolName: tool.name,
            input: JSON.stringify(tool.params),
            output: execution.result ? JSON.stringify(execution.result) : undefined,
            error: execution.error,
            duration: execution.duration,
            timestamp: execution.timestamp
          });
          
          // Include tool result in response context
          if (execution.result) {
            response += `Tool ${tool.name} result: ${JSON.stringify(execution.result)}\n\n`;
          }
        }
      }

      // Generate AI response
      agentManager.updateStatus(agentRuntime.id, 'processing', 'Generating response');
      
      const aiResponse = await this.generateResponse(
        message, 
        agentRuntime.agent, 
        context, 
        response
      );

      // Update metrics
      const responseTime = Date.now() - startTime;
      agentManager.updateMetrics(agentRuntime.id, responseTime, true);
      agentManager.updateStatus(agentRuntime.id, 'idle');

      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        agentId: agentRuntime.agent.id,
        toolUsage: toolUsage.length > 0 ? toolUsage : undefined,
        isComplete: true
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      agentManager.updateMetrics(agentRuntime.id, responseTime, false);
      agentManager.updateStatus(agentRuntime.id, 'error');

      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your message. Please try again.',
        timestamp: new Date(),
        agentId: agentRuntime.agent.id,
        isComplete: true
      };
    }
  }

  // Analyze if message needs tool usage
  private analyzeToolNeeds(message: string, agent: Agent): Array<{id: string, name: string, params: any}> {
    const tools = [];
    const lowerMessage = message.toLowerCase();

    // Knowledge search detection
    if (lowerMessage.includes('search') || 
        lowerMessage.includes('find') || 
        lowerMessage.includes('document') ||
        lowerMessage.includes('what is') ||
        lowerMessage.includes('tell me about')) {
      tools.push({
        id: 'knowledge_search',
        name: 'Knowledge Search',
        params: { query: message, collections: agent.collections }
      });
    }

    // Web search detection
    if (lowerMessage.includes('current') || 
        lowerMessage.includes('latest') || 
        lowerMessage.includes('news') ||
        lowerMessage.includes('today')) {
      tools.push({
        id: 'web_search',
        name: 'Web Search',
        params: { query: message }
      });
    }

    // Calculator detection
    if (message.match(/[\d+\-*/()=]/)) {
      const mathExpression = message.match(/[\d+\-*/().\s]+/)?.[0];
      if (mathExpression) {
        tools.push({
          id: 'calculator',
          name: 'Calculator',
          params: { expression: mathExpression.trim() }
        });
      }
    }

    return tools.filter(tool => agent.tools.includes(tool.id));
  }

  // Execute tool
  private async executeTool(
    toolId: string, 
    params: any, 
    context: ConversationContext
  ): Promise<ToolExecution> {
    return await toolRegistry.execute(toolId, params);
  }

  // Generate AI response
  private async generateResponse(
    message: string,
    agent: Agent,
    context: ConversationContext,
    toolContext: string
  ): Promise<string> {
    const prompt = this.buildPrompt(message, agent, context, toolContext);
    
    try {
      const response = await api.post('/chat/generate', {
        prompt,
        model: agent.modelId,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens
      });
      
      return response.content || 'I apologize, but I could not generate a response.';
    } catch (error) {
      console.error('Failed to generate response:', error);
      throw error;
    }
  }

  // Build prompt with context
  private buildPrompt(
    message: string,
    agent: Agent,
    context: ConversationContext,
    toolContext: string
  ): string {
    let prompt = agent.systemPrompt + '\n\n';
    
    if (context.summary) {
      prompt += `Conversation Summary: ${context.summary}\n\n`;
    }
    
    if (toolContext) {
      prompt += `Tool Results:\n${toolContext}\n`;
    }
    
    prompt += `User Message: ${message}\n\nResponse:`;
    
    return prompt;
  }
}

// Conversation Orchestrator - main chat coordination
class ConversationOrchestrator {
  private messageProcessor = new MessageProcessor();
  private activeRuntimes = new Map<string, AgentRuntime>();

  // Process incoming message
  async processMessage(
    conversationId: string,
    message: string,
    agent: Agent,
    context: ConversationContext
  ): Promise<Message> {
    // Get or create runtime for agent
    let runtime = this.activeRuntimes.get(`${conversationId}_${agent.id}`);
    if (!runtime) {
      runtime = agentManager.createRuntime(agent);
      this.activeRuntimes.set(`${conversationId}_${agent.id}`, runtime);
    }

    return await this.messageProcessor.processMessage(message, runtime, context);
  }

  // Switch agent in conversation
  async switchAgent(conversationId: string, newAgent: Agent, context: ConversationContext): Promise<void> {
    // Clean up old runtime
    const oldKey = Array.from(this.activeRuntimes.keys()).find(key => 
      key.startsWith(`${conversationId}_`)
    );
    if (oldKey) {
      this.activeRuntimes.delete(oldKey);
    }

    // Create new runtime
    const newRuntime = agentManager.createRuntime(newAgent);
    this.activeRuntimes.set(`${conversationId}_${newAgent.id}`, newRuntime);
  }

  // Get contextual suggestions
  async getContextualSuggestions(
    conversationId: string,
    context: ConversationContext
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Based on conversation topics
    if (context.topics.length > 0) {
      suggestions.push(`Tell me more about ${context.topics[0]}`);
      suggestions.push(`How does ${context.topics[0]} relate to other topics?`);
    }

    // Based on available knowledge
    if (context.entities.length > 0) {
      suggestions.push(`Search for information about ${context.entities[0]}`);
    }

    return suggestions;
  }

  // Clean up inactive runtimes
  cleanup(): void {
    agentManager.cleanup();
    // Clean up local runtime references
    const now = Date.now();
    for (const [key, runtime] of this.activeRuntimes.entries()) {
      const inactiveTime = now - runtime.metrics.lastUsed.getTime();
      if (inactiveTime > 30 * 60 * 1000) { // 30 minutes
        this.activeRuntimes.delete(key);
      }
    }
  }
}

// Global instance
export const conversationOrchestrator = new ConversationOrchestrator();

// Auto cleanup every 5 minutes
setInterval(() => {
  conversationOrchestrator.cleanup();
}, 5 * 60 * 1000);

// Chat Store - unified chat management
interface ChatState {
  // Data
  conversations: Conversation[];
  currentConversation: Conversation | null;
  
  // WebSocket state
  wsConnection: WebSocket | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  
  // UI state
  isTyping: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  loadConversations: () => Promise<void>;
  createConversation: (agentId: string, name?: string) => Promise<Conversation>;
  switchConversation: (conversationId: string) => Promise<void>;
  sendMessage: (message: string, images?: any[]) => Promise<void>;
  switchAgent: (agentId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  
  // WebSocket actions
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  conversations: [],
  currentConversation: null,
  wsConnection: null,
  connectionStatus: 'disconnected',
  isTyping: false,
  loading: false,
  error: null,

  // Load conversations
  loadConversations: async () => {
    set({ loading: true, error: null });
    try {
      const conversations = await api.get<Conversation[]>('/conversations');
      set({ conversations });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load conversations' });
    } finally {
      set({ loading: false });
    }
  },

  // Create new conversation
  createConversation: async (agentId, name = 'New Chat') => {
    const conversation: Conversation = {
      id: `conv_${Date.now()}`,
      name,
      messages: [],
      agentId,
      context: {
        topics: [],
        entities: []
      },
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const created = await api.post<Conversation>('/conversations', conversation);
      set(state => ({
        conversations: [created, ...state.conversations],
        currentConversation: created
      }));
      return created;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create conversation');
    }
  },

  // Switch to conversation
  switchConversation: async (conversationId) => {
    set({ loading: true, error: null });
    try {
      const conversation = await api.get<Conversation>(`/conversations/${conversationId}`);
      set({ currentConversation: conversation });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load conversation' });
    } finally {
      set({ loading: false });
    }
  },

  // Send message
  sendMessage: async (message, images = []) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    // Add user message immediately
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      images: images.length > 0 ? images : undefined
    };

    set(state => ({
      currentConversation: state.currentConversation ? {
        ...state.currentConversation,
        messages: [...state.currentConversation.messages, userMessage],
        updatedAt: new Date()
      } : null,
      isTyping: true
    }));

    try {
      // Get active agent (you'll need to implement this based on your agent store)
      const agent: Agent = {
        id: currentConversation.agentId,
        name: 'Current Agent',
        description: '',
        systemPrompt: 'You are a helpful AI assistant.',
        modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        temperature: 0.7,
        maxTokens: 4000,
        tools: ['knowledge_search', 'web_search', 'calculator'],
        collections: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Process message through orchestrator
      const assistantMessage = await conversationOrchestrator.processMessage(
        currentConversation.id,
        message,
        agent,
        currentConversation.context
      );

      // Update conversation with assistant response
      set(state => ({
        currentConversation: state.currentConversation ? {
          ...state.currentConversation,
          messages: [...state.currentConversation.messages, assistantMessage],
          updatedAt: new Date()
        } : null,
        isTyping: false
      }));

      // Save conversation
      await api.put(`/conversations/${currentConversation.id}`, get().currentConversation);

    } catch (error) {
      set({ isTyping: false, error: error instanceof Error ? error.message : 'Failed to send message' });
    }
  },

  // Switch agent in current conversation
  switchAgent: async (agentId) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    try {
      // Get agent details
      const agent = await api.get<Agent>(`/agents/${agentId}`);
      
      // Update conversation
      const updated = {
        ...currentConversation,
        agentId,
        updatedAt: new Date()
      };

      await conversationOrchestrator.switchAgent(currentConversation.id, agent, currentConversation.context);
      await api.put(`/conversations/${currentConversation.id}`, updated);
      
      set({ currentConversation: updated });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to switch agent' });
    }
  },

  // Delete conversation
  deleteConversation: async (conversationId) => {
    try {
      await api.delete(`/conversations/${conversationId}`);
      set(state => ({
        conversations: state.conversations.filter(c => c.id !== conversationId),
        currentConversation: state.currentConversation?.id === conversationId ? null : state.currentConversation
      }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to delete conversation');
    }
  },

  // WebSocket connection (simplified)
  connectWebSocket: () => {
    const ws = new WebSocket('ws://localhost:8000/ws');
    
    ws.onopen = () => {
      set({ wsConnection: ws, connectionStatus: 'connected' });
    };
    
    ws.onclose = () => {
      set({ wsConnection: null, connectionStatus: 'disconnected' });
    };
    
    ws.onerror = () => {
      set({ connectionStatus: 'error' });
    };
  },

  disconnectWebSocket: () => {
    const { wsConnection } = get();
    if (wsConnection) {
      wsConnection.close();
      set({ wsConnection: null, connectionStatus: 'disconnected' });
    }
  }
}));