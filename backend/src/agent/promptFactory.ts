import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { PromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

export interface PromptConfig {
  systemPrompt: string;
  includeHistory: boolean;
  includeTools: boolean;
  includeContext: boolean;
  maxHistoryLength: number;
}

export class PromptFactory {
  private config: PromptConfig;

  constructor(config: PromptConfig) {
    this.config = config;
  }

  createChatPrompt(): ChatPromptTemplate {
    const messages: any[] = [];

    // System message
    messages.push({ role: "system", content: this.config.systemPrompt });

    // Chat history (ถ้าเปิดใช้งาน)
    if (this.config.includeHistory) {
      messages.push(new MessagesPlaceholder("chat_history"));
    }

    // Context (ถ้าเปิดใช้งาน)
    if (this.config.includeContext) {
      messages.push({ role: "system", content: "Context: {context}" });
    }

    // Human input
    messages.push({ role: "human", content: "{input}" });

    // Agent scratchpad (ถ้าเปิดใช้งาน tools)
    if (this.config.includeTools) {
      messages.push(new MessagesPlaceholder("agent_scratchpad"));
    }

    return ChatPromptTemplate.fromMessages(messages);
  }

  createAgentPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      { role: "system", content: this.config.systemPrompt },
      new MessagesPlaceholder("chat_history"),
      { role: "human", content: "{input}" },
      new MessagesPlaceholder("agent_scratchpad"),
    ]);
  }

  createRAGPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      { role: "system", content: this.config.systemPrompt },
      { role: "system", content: "Use the following context to answer the question:\n{context}" },
      new MessagesPlaceholder("chat_history"),
      { role: "human", content: "{input}" },
    ]);
  }

  createToolPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      { role: "system", content: this.config.systemPrompt },
      { role: "system", content: "Available tools: {tools}" },
      new MessagesPlaceholder("chat_history"),
      { role: "human", content: "{input}" },
      new MessagesPlaceholder("agent_scratchpad"),
    ]);
  }

  createSimplePrompt(): PromptTemplate {
    return PromptTemplate.fromTemplate(
      `${this.config.systemPrompt}\n\nQuestion: {input}\nAnswer:`
    );
  }

  formatChatHistory(messages: any[]): any[] {
    if (!this.config.includeHistory) {
      return [];
    }

    const formattedMessages = messages
      .slice(-this.config.maxHistoryLength)
      .map(msg => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else if (msg.role === 'assistant') {
          return new AIMessage(msg.content);
        } else if (msg.role === 'system') {
          return new SystemMessage(msg.content);
        }
        return msg;
      });

    return formattedMessages;
  }

  formatContext(context: string[]): string {
    if (!this.config.includeContext || !context.length) {
      return '';
    }
    return context.join('\n\n');
  }

  formatTools(tools: any[]): string {
    if (!this.config.includeTools || !tools.length) {
      return '';
    }
    return tools.map(tool => `${tool.name}: ${tool.description}`).join('\n');
  }

  // Static methods for predefined prompts
  static getDefaultSystemPrompt(): string {
    return `You are a helpful AI assistant. You can help users with various tasks including:
- Answering questions
- Providing information
- Helping with calculations
- Searching for information
- Analyzing data

Please be helpful, accurate, and concise in your responses.`;
  }

  static getAgentSystemPrompt(): string {
    return `You are an AI agent with access to various tools. You can:
- Use tools to perform tasks
- Search for information
- Make calculations
- Access knowledge bases
- Remember conversation context

Please use the available tools when appropriate to provide the best possible assistance.`;
  }

  static getRAGSystemPrompt(): string {
    return `You are an AI assistant with access to a knowledge base. Use the provided context to answer questions accurately and comprehensively. If the context doesn't contain enough information, say so rather than making up information.`;
  }
} 