import { BedrockChat } from "@langchain/community/chat_models/bedrock";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { createRetrieverTool } from "langchain/tools/retriever";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { BedrockEmbeddings } from "@langchain/community/embeddings/bedrock";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { toolRegistry } from "../services/toolRegistry";
import { chromaService } from "../services/chromaService";

export interface LangChainAgentConfig {
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  collectionNames: string[];
  sessionId: string;
}

export class LangChainAgent {
  private config: LangChainAgentConfig;
  private llm: BedrockChat;
  private tools: DynamicTool[] = [];
  private memoryStore: MemoryVectorStore | null = null;
  private agentExecutor: AgentExecutor | null = null;

  constructor(config: LangChainAgentConfig) {
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
    await this.setupTools();
    await this.setupMemory();
    await this.createAgent();
  }

  private async setupTools(): Promise<void> {
    // Static tools
    const staticTools = [
      new DynamicTool({
        name: "calculator",
        description: "Perform mathematical calculations",
        func: async (input: string) => {
          return toolRegistry.calculator(input, this.config.sessionId);
        },
      }),
      new DynamicTool({
        name: "current_date",
        description: "Get the current date and time",
        func: async (input: string) => {
          return toolRegistry.current_date(input, this.config.sessionId);
        },
      }),
      new DynamicTool({
        name: "web_search",
        description: "Search the web for current information",
        func: async (input: string) => {
          return toolRegistry.web_search(input, this.config.sessionId);
        },
      }),
    ];

    // Memory tools
    const memoryTools = [
      new DynamicTool({
        name: "memory_search",
        description: "Search through chat memory for relevant context",
        func: async (input: string) => {
          return toolRegistry.memory_search(input, this.config.sessionId);
        },
      }),
      new DynamicTool({
        name: "memory_embed",
        description: "Embed new message into chat memory",
        func: async (input: string) => {
          return toolRegistry.memory_embed(input, this.config.sessionId);
        },
      }),
    ];

    // Knowledge base tools
    const knowledgeTools: DynamicTool[] = [];
    for (const collectionName of this.config.collectionNames) {
      try {
        const retriever = await this.createCollectionRetriever(collectionName);
        if (retriever) {
          knowledgeTools.push(
            createRetrieverTool(retriever, {
              name: `knowledge_${collectionName}`,
              description: `Search knowledge base: ${collectionName}`,
            })
          );
        }
      } catch (error) {
        console.warn(`Failed to create retriever for collection ${collectionName}:`, error);
      }
    }

    this.tools = [...staticTools, ...memoryTools, ...knowledgeTools];
  }

  private async createCollectionRetriever(collectionName: string) {
    try {
      // สร้าง custom retriever สำหรับ ChromaDB
      return {
        getRelevantDocuments: async (query: string) => {
          const embeddings = new BedrockEmbeddings({
            region: process.env.AWS_REGION,
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
          });

          const queryEmbedding = await embeddings.embedQuery(query);
          const result = await chromaService.queryCollection(collectionName, [queryEmbedding], 5);
          
          if (result && result.documents && result.documents.length > 0) {
            return result.documents.map((doc: any) => ({
              pageContent: doc.document,
              metadata: { source: collectionName, id: doc.id }
            }));
          }
          return [];
        }
      };
    } catch (error) {
      console.error(`Error creating retriever for ${collectionName}:`, error);
      return null;
    }
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

  private async createAgent(): Promise<void> {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", this.config.systemPrompt],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    const agent = await createOpenAIFunctionsAgent({
      llm: this.llm,
      tools: this.tools,
      prompt,
    });

    this.agentExecutor = new AgentExecutor({
      agent,
      tools: this.tools,
      maxIterations: 5,
    });
  }

  async processMessage(
    messages: ChatMessage[],
    onEvent?: (event: { type: string; data?: any }) => void
  ): Promise<string> {
    if (!this.agentExecutor) {
      throw new Error("Agent not initialized");
    }

    try {
      // แยก user message ออกมา
      const userMessage = messages[messages.length - 1];
      if (userMessage instanceof HumanMessage) {
        // เพิ่ม user message ลงใน memory
        if (this.memoryStore) {
          await this.memoryStore.addDocuments([{
            pageContent: userMessage.content,
            metadata: { type: "user", timestamp: new Date().toISOString() }
          }]);
        }

        // เรียกใช้ agent
        const result = await this.agentExecutor.invoke({
          input: userMessage.content,
          chat_history: messages.slice(0, -1), // ไม่รวม user message ล่าสุด
        });

        const response = result.output;

        // เพิ่ม assistant response ลงใน memory
        if (this.memoryStore) {
          await this.memoryStore.addDocuments([{
            pageContent: response,
            metadata: { type: "assistant", timestamp: new Date().toISOString() }
          }]);
        }

        return response;
      }

      return "Invalid message format";
    } catch (error) {
      console.error("Error processing message:", error);
      throw error;
    }
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

  getTools(): DynamicTool[] {
    return this.tools;
  }
} 