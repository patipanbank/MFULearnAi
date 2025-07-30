import { BedrockChat } from "@langchain/community/chat_models/bedrock";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ChatMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { Tool } from "@langchain/core/tools";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { BedrockEmbeddings } from "@langchain/community/embeddings/bedrock";
import { toolRegistry } from "../services/toolRegistry";
import { chromaService } from "../services/chromaService";

export interface StreamingAgentConfig {
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  collectionNames: string[];
  sessionId: string;
}

export class StreamingAgent {
  private config: StreamingAgentConfig;
  private llm: BedrockChat;
  private tools: Tool[] = [];
  private memoryStore: MemoryVectorStore | null = null;
  private agentExecutor: AgentExecutor | null = null;

  constructor(config: StreamingAgentConfig) {
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
      streaming: true, // เปิดใช้งาน streaming
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
      new Tool({
        name: "calculator",
        description: "Perform mathematical calculations",
        func: async (input: string) => {
          return toolRegistry.calculator(input, this.config.sessionId);
        },
      }),
      new Tool({
        name: "current_date",
        description: "Get the current date and time",
        func: async (input: string) => {
          return toolRegistry.current_date(input, this.config.sessionId);
        },
      }),
      new Tool({
        name: "web_search",
        description: "Search the web for current information",
        func: async (input: string) => {
          return toolRegistry.web_search(input, this.config.sessionId);
        },
      }),
    ];

    // Memory tools
    const memoryTools = [
      new Tool({
        name: "memory_search",
        description: "Search through chat memory for relevant context",
        func: async (input: string) => {
          return toolRegistry.memory_search(input, this.config.sessionId);
        },
      }),
      new Tool({
        name: "memory_embed",
        description: "Embed new message into chat memory",
        func: async (input: string) => {
          return toolRegistry.memory_embed(input, this.config.sessionId);
        },
      }),
    ];

    // Knowledge base tools
    const knowledgeTools: Tool[] = [];
    for (const collectionName of this.config.collectionNames) {
      try {
        const retriever = await this.createCollectionRetriever(collectionName);
        if (retriever) {
          knowledgeTools.push(
            new Tool({
              name: `knowledge_${collectionName}`,
              description: `Search knowledge base: ${collectionName}`,
              func: async (input: string) => {
                const docs = await retriever.getRelevantDocuments(input);
                return docs.map((doc: any) => doc.pageContent).join('\n\n');
              },
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
      verbose: true,
      maxIterations: 5,
    });
  }

  async processMessageStream(
    messages: ChatMessage[],
    onEvent: (event: { type: string; data?: any }) => void
  ): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error("Agent not initialized");
    }

    try {
      const userMessage = messages[messages.length - 1];
      if (userMessage instanceof HumanMessage) {
        // Add user message to memory
        if (this.memoryStore) {
          await this.memoryStore.addDocuments([{
            pageContent: userMessage.content,
            metadata: { type: "user", timestamp: new Date().toISOString() }
          }]);
        }

        // Process with streaming
        const stream = await this.agentExecutor.stream({
          input: userMessage.content,
          chat_history: messages.slice(0, -1),
        });

        let fullResponse = '';
        let isToolCalling = false;
        let currentTool = '';

        for await (const chunk of stream) {
          if (chunk.intermediateSteps && chunk.intermediateSteps.length > 0) {
            // Tool calling
            const step = chunk.intermediateSteps[chunk.intermediateSteps.length - 1];
            if (step.action && !isToolCalling) {
              isToolCalling = true;
              currentTool = step.action.tool;
              onEvent({
                type: 'tool_start',
                data: {
                  tool_name: currentTool,
                  tool_input: step.action.toolInput
                }
              });
            } else if (step.observation && isToolCalling) {
              isToolCalling = false;
              onEvent({
                type: 'tool_result',
                data: {
                  tool_name: currentTool,
                  output: step.observation
                }
              });
            }
          } else if (chunk.output) {
            // Text output
            const chunkText = chunk.output;
            fullResponse += chunkText;
            onEvent({
              type: 'chunk',
              data: chunkText
            });
          }
        }

        // Add assistant response to memory
        if (this.memoryStore && fullResponse) {
          await this.memoryStore.addDocuments([{
            pageContent: fullResponse,
            metadata: { type: "assistant", timestamp: new Date().toISOString() }
          }]);
        }

        onEvent({
          type: 'end',
          data: { answer: fullResponse }
        });
      }
    } catch (error) {
      console.error("Error processing message stream:", error);
      onEvent({
        type: 'error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
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

  getTools(): Tool[] {
    return this.tools;
  }
} 