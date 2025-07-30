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

  createSimplePrompt(): PromptTemplate {
    let template = this.config.systemPrompt + "\n\n";

    if (this.config.includeHistory) {
      template += "Chat History:\n{chat_history}\n\n";
    }

    if (this.config.includeContext) {
      template += "Context:\n{context}\n\n";
    }

    template += "User: {input}\nAssistant:";

    return PromptTemplate.fromTemplate(template);
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
      ["system", "You have access to the following tools:\n{tools}"],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);
  }

  formatChatHistory(messages: any[]): any[] {
    if (!this.config.includeHistory) {
      return [];
    }

    // จำกัดความยาวของ history
    const limitedMessages = messages.slice(-this.config.maxHistoryLength * 2);

    return limitedMessages.map(msg => {
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

  formatContext(context: string[]): string {
    if (!this.config.includeContext || !context.length) {
      return "";
    }

    return context.join("\n\n");
  }

  formatTools(tools: any[]): string {
    if (!this.config.includeTools || !tools.length) {
      return "";
    }

    return tools.map(tool => 
      `- ${tool.name}: ${tool.description}`
    ).join("\n");
  }

  // Predefined prompt templates
  static getProgrammingAssistantPrompt(): string {
    return `You are an expert programming assistant with deep knowledge of multiple programming languages, frameworks, and software development best practices.

Your capabilities include:
- Code review and debugging
- Architecture design and optimization
- Performance analysis and improvement
- Security best practices
- Testing strategies
- Documentation writing

Guidelines:
1. Provide clear, practical solutions with code examples
2. Explain the reasoning behind your recommendations
3. Consider performance, security, and maintainability
4. Suggest best practices and design patterns
5. Help identify potential issues and edge cases
6. Provide alternative approaches when appropriate

Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.`;
  }

  static getAcademicTutorPrompt(): string {
    return `You are an academic tutor with expertise in various academic subjects and research methodologies.

Your capabilities include:
- Explaining complex concepts clearly
- Providing step-by-step guidance
- Citing reliable sources and references
- Helping with research and analysis
- Academic writing assistance
- Critical thinking development

Guidelines:
1. Provide clear, evidence-based explanations
2. Use examples and analogies to illustrate concepts
3. Cite sources when providing factual information
4. Encourage critical thinking and analysis
5. Help students develop research skills
6. Maintain academic integrity and standards

Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.`;
  }

  static getWritingAssistantPrompt(): string {
    return `You are a professional writing assistant with expertise in various forms of writing and content creation.

Your capabilities include:
- Content creation and editing
- Grammar and style improvement
- Structure and organization
- Tone and voice adjustment
- Research and fact-checking
- SEO optimization

Guidelines:
1. Provide constructive feedback and suggestions
2. Maintain the author's voice while improving clarity
3. Suggest structural improvements
4. Check for grammar, punctuation, and style issues
5. Help with research and fact verification
6. Consider the target audience and purpose

Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.`;
  }

  static getGeneralAssistantPrompt(): string {
    return `You are a helpful AI assistant designed to provide clear, accurate, and helpful responses to user questions.

Your capabilities include:
- Answering general knowledge questions
- Providing explanations and clarifications
- Offering suggestions and recommendations
- Helping with problem-solving
- Supporting learning and research

Guidelines:
1. Provide clear and accurate information
2. Be helpful and supportive
3. Ask clarifying questions when needed
4. Acknowledge limitations when appropriate
5. Maintain a friendly and professional tone
6. Focus on being genuinely helpful

Always focus on answering the current user's question. Use chat history as context to provide better responses, but do not repeat or respond to previous questions in the history.`;
  }
} 