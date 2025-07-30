import { BedrockChat } from "@langchain/community/chat_models/bedrock";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { BedrockEmbeddings } from "@langchain/community/embeddings/bedrock";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { chromaService } from "../services/chromaService";

export interface ChainConfig {
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  chainType: 'simple' | 'rag' | 'conversational' | 'agent';
  collectionNames: string[];
  sessionId: string;
}

export class ChainFactory {
  private config: ChainConfig;
  private llm: BedrockChat;
  private memoryStore: MemoryVectorStore | null = null;

  constructor(config: ChainConfig) {
    this.config = config;
    this.llm = new BedrockChat({
      region: process.env.AWS_REGION,
      model: config.modelId,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });
  }

  async initialize(): Promise<void> {
    await this.setupMemory();
  }

  private async setupMemory(): Promise<void> {
    try {
      const embeddings = new BedrockEmbeddings({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      this.memoryStore = new MemoryVectorStore(embeddings);
    } catch (error) {
      console.error("Error setting up memory store:", error);
    }
  }

  createSimpleChain(): RunnableSequence {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", this.config.systemPrompt],
      ["human", "{input}"],
    ]);

    return RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);
  }

  createConversationalChain(): RunnableSequence {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", this.config.systemPrompt],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
    ]);

    return RunnableSequence.from([
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);
  }

  createRAGChain(): RunnableSequence {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", this.config.systemPrompt],
      ["system", "Use the following context to answer the question:\n{context}"],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
    ]);

    return RunnableSequence.from([
      {
        input: (input: any) => input.input,
        chat_history: (input: any) => input.chat_history,
        context: async (input: any) => {
          return await this.retrieveContext(input.input);
        },
      },
      prompt,
      this.llm,
      new StringOutputParser(),
    ]);
  }

  private async retrieveContext(query: string): Promise<string> {
    const contexts: string[] = [];

    // Search in memory store
    if (this.memoryStore) {
      try {
        const memoryDocs = await this.memoryStore.similaritySearch(query, 3);
        contexts.push(...memoryDocs.map((doc: any) => doc.pageContent));
      } catch (error) {
        console.error("Error searching memory:", error);
      }
    }

    // Search in knowledge collections
    for (const collectionName of this.config.collectionNames) {
      try {
        const embeddings = new BedrockEmbeddings({
          region: process.env.AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });

        const queryEmbedding = await embeddings.embedQuery(query);
        const result = await chromaService.queryCollection(collectionName, [queryEmbedding], 3);
        
        if (result && result.documents && result.documents.length > 0) {
          contexts.push(...result.documents.map((doc: any) => doc.document));
        }
      } catch (error) {
        console.warn(`Error searching collection ${collectionName}:`, error);
      }
    }

    return contexts.join("\n\n");
  }

  async processMessage(
    messages: ChatMessage[],
    onEvent?: (event: { type: string; data?: any }) => void
  ): Promise<string> {
    const chain = this.getChain();
    const userMessage = messages[messages.length - 1];

    if (userMessage instanceof HumanMessage) {
      // Add to memory
      if (this.memoryStore) {
        await this.memoryStore.addDocuments([{
          pageContent: userMessage.content,
          metadata: { type: "user", timestamp: new Date().toISOString() }
        }]);
      }

      // Prepare input
      const input: any = {
        input: userMessage.content,
        chat_history: this.formatChatHistory(messages.slice(0, -1))
      };

      // Process with chain
      const response = await chain.invoke(input);

      // Add response to memory
      if (this.memoryStore) {
        await this.memoryStore.addDocuments([{
          pageContent: response,
          metadata: { type: "assistant", timestamp: new Date().toISOString() }
        }]);
      }

      return response;
    }

    return "Invalid message format";
  }

  private getChain(): RunnableSequence {
    switch (this.config.chainType) {
      case 'simple':
        return this.createSimpleChain();
      case 'conversational':
        return this.createConversationalChain();
      case 'rag':
        return this.createRAGChain();
      default:
        return this.createConversationalChain();
    }
  }

  private formatChatHistory(messages: ChatMessage[]): ChatMessage[] {
    return messages.map(msg => {
      if (msg instanceof HumanMessage) {
        return new HumanMessage(msg.content);
      } else if (msg instanceof AIMessage) {
        return new AIMessage(msg.content);
      }
      return msg;
    });
  }

  async addToMemory(content: string, metadata?: any): Promise<void> {
    if (this.memoryStore) {
      await this.memoryStore.addDocuments([{
        pageContent: content,
        metadata: { ...metadata, timestamp: new Date().toISOString() }
      }]);
    }
  }

  async searchMemory(query: string, k: number = 5): Promise<any[]> {
    if (!this.memoryStore) {
      return [];
    }

    try {
      const docs = await this.memoryStore.similaritySearch(query, k);
      return docs;
    } catch (error) {
      console.error("Error searching memory:", error);
      return [];
    }
  }
} 