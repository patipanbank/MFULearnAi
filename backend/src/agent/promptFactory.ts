import { ChatPromptTemplate, MessagesPlaceholder, PromptTemplate } from "@langchain/core/prompts";
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
    const messages = [];

    // System message
    messages.push(["system", this.config.systemPrompt]);

    // Chat history (ถ้าเปิดใช้งาน)
    if (this.config.includeHistory) {
      messages.push(new MessagesPlaceholder("chat_history"));
    }

    // Context (ถ้าเปิดใช้งาน)
    if (this.config.includeContext) {
      messages.push(["system", "Context: {context}"]);
    }

    // Human input
    messages.push(["human", "{input}"]);

    // Agent scratchpad (ถ้าเปิดใช้งาน tools)
    if (this.config.includeTools) {
      messages.push(new MessagesPlaceholder("agent_scratchpad"));
    }

    return ChatPromptTemplate.fromMessages(messages);
  }

  createAgentPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      ["system", this.config.systemPrompt],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);
  }

  createRAGPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      ["system", this.config.systemPrompt],
      ["system", "Use the following context to answer the question:\n{context}"],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
    ]);
  }

  createToolPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      ["system", this.config.systemPrompt],
      ["system", "Available tools: {tools}"],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
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

When you need to use a tool, do so appropriately. Always explain what you're doing and provide helpful responses.`;
  }

  static getRAGSystemPrompt(): string {
    return `You are an AI assistant with access to a knowledge base. You can:
- Search through documents and information
- Provide accurate answers based on available knowledge
- Cite sources when appropriate
- Ask for clarification when needed

Use the provided context to answer questions accurately and comprehensively.`;
  }
} 