import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';
import { HydratedDocument } from 'mongoose';
import { ModelModel } from '../models/Model';
import { Chat } from '../models/Chat';
import { usageService } from './usageService';
import { ChatStats } from '../models/ChatStats';
import { webSearchService } from './webSearch';
import { SystemPrompt } from '../models/SystemPrompt';
import { CollectionModel } from '../models/Collection';
import { CollectionPermission } from '../models/Collection';

interface QueryResult {
  text: string;
  metadata: {
    modelId: string;
    filename: string;
    [key: string]: any;
  };
  similarity: number;
}

interface ChromaQueryResult {
  documents: string[];
  metadatas: Array<{
    modelId: string;
    filename: string;
    [key: string]: any;
  }>;
  distances?: number[];
}

interface CollectionQueryResult {
  context: string;
  sources: Array<{
    modelId: string;
    collectionName: string;
    filename: string;
    similarity: number;
  }>;
}

interface IChatHistory {
  sources: Array<{
    modelId: string;
    collectionName: string;
    filename: string;
    similarity: number;
  }>;
  save(): Promise<void>;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

class ChatService {
  private readonly questionTypes = {
    FACTUAL: 'factual',
    ANALYTICAL: 'analytical',
    CONCEPTUAL: 'conceptual',
    PROCEDURAL: 'procedural',
    CLARIFICATION: 'clarification'
  };

  private systemPrompt = `You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.

  Response Style 🎯:
  - Be concise, friendly and conversational
  - Always respond in the same language the user is using
  - Use appropriate emojis to make responses engaging
  - Never say "I don't know" or "I'm not sure"
  - Always provide answers using your knowledge and reasoning
  - Break down complex topics into clear steps
  - Use markdown formatting effectively
  
  Knowledge Approach 📚:
  - Use provided context first, then general knowledge
  - Can analyze images, read files, search web
  - Provide step-by-step solutions for issues
  - Cite sources when referencing specific information
  - For MFU questions without specific data, provide helpful general information
  
  Remember: Keep responses friendly, use emojis, answer every question positively without refusing, and maintain a conversational tone.`;

  private readonly promptTemplates = {
    [this.questionTypes.FACTUAL]: 'Provide a direct and accurate answer based on the following context:',
    [this.questionTypes.ANALYTICAL]: 'Analyze the following information and provide insights:',
    [this.questionTypes.CONCEPTUAL]: 'Explain the concept using the following context:',
    [this.questionTypes.PROCEDURAL]: 'Describe the process or steps based on:',
    [this.questionTypes.CLARIFICATION]: 'To better answer your question, let me clarify based on:'
  };

  private chatModel = bedrockService.chatModel;
  private currentChatHistory?: HydratedDocument<IChatHistory>;
  private readonly BATCH_SIZE = 3; // Number of collections to query simultaneously
  private readonly MIN_SIMILARITY_THRESHOLD = 0.1; // Lowered from 0.6 to match ChromaService
  private readonly retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000
  };

  private getTools(): any[] {
    return [
      {
        toolSpec: {
          name: 'query_knowledge_base',
          description: 'Search the knowledge base (vector database) for relevant documents and information. Use this when the user asks questions that might be answered by uploaded documents or training data.',
          inputSchema: {
            json: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query to find relevant documents'
                },
                collectionNames: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of collection names to search in. If empty, search all available collections.'
                },
                topK: {
                  type: 'number',
                  description: 'Number of top results to return (default: 5)',
                  default: 5
                }
              },
              required: ['query']
            }
          }
        }
      },
      {
        toolSpec: {
          name: 'search_web',
          description: 'Search the web for current information, news, or information not available in the knowledge base. Use this for real-time information, recent events, or when knowledge base search doesn\'t provide sufficient results.',
          inputSchema: {
            json: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query to search the web'
                }
              },
              required: ['query']
            }
          }
        }
      }
    ];
  }

  private async executeTool(toolName: string, input: any, userId: string, modelIdOrCollections: string | string[]): Promise<string> {
    try {
      switch (toolName) {
        case 'query_knowledge_base': {
          const { query, collectionNames, topK = 5 } = input;
          const collectionsToSearch = collectionNames && collectionNames.length > 0 
            ? collectionNames 
            : await this.resolveCollections(modelIdOrCollections);
          
          if (collectionsToSearch.length === 0) {
            return 'No collections available to search.';
          }

          const sanitizedCollections = collectionsToSearch.map(name => 
            this.sanitizeCollectionName(name)
          );

          const queryEmbedding = await chromaService.getQueryEmbedding(query.slice(0, 512));
          const batches = this.createBatches(sanitizedCollections, this.BATCH_SIZE);
          let allResults: CollectionQueryResult[] = [];
          
          for (const batch of batches) {
            const batchResults = await this.processBatch(batch, queryEmbedding);
            allResults = allResults.concat(batchResults);
          }

          const context = this.processResults(allResults);
          
          if (!context || context.trim().length === 0) {
            return `No relevant documents found in the knowledge base for query: "${query}"`;
          }

          return `Found relevant information from knowledge base:\n\n${context}`;
        }

        case 'search_web': {
          const { query } = input;
          const webResults = await webSearchService.searchWeb(query);
          
          if (!webResults || webResults.trim().length === 0) {
            return `No web search results found for query: "${query}"`;
          }

          return `Web search results:\n\n${webResults}`;
        }

        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      return `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
  // You are DinDin, a male AI. Keep responses brief and to the point.

  private isRelevantQuestion(query: string): boolean {
    return true;
  }

  /**
   * Sanitizes a collection name by replacing invalid characters.
   * Here we replace any colon (:) with a hyphen (-) to conform to ChromaDB's requirements.
   */
  private sanitizeCollectionName(name: string): string {
    return name.replace(/:/g, '-');
  }

  /**
   * Gets collection names for a model ID or returns the collection names if directly provided
   */
  private async resolveCollections(modelIdOrCollections: string | string[]): Promise<string[]> {
    try {
      if (Array.isArray(modelIdOrCollections)) {
        // console.log('Collections provided directly:', modelIdOrCollections);
        return modelIdOrCollections;
      }

      // console.log('Looking up model by ID:', modelIdOrCollections);
      const model = await ModelModel.findById(modelIdOrCollections);
      if (!model) {
        console.error('Model not found:', modelIdOrCollections);
        return [];
      }

      // console.log('Found model:', {
      //   id: model._id,
      //   name: model.name,
      //   collections: model.collections
      // });
      return model.collections;
    } catch (error) {
      console.error('Error resolving collections:', error);
      return [];
    }
  }

  private async processBatch(
    batch: string[],
    queryEmbedding: number[],
    imageEmbedding?: number[]
  ): Promise<CollectionQueryResult[]> {
    return Promise.all(
      batch.map(async (name): Promise<CollectionQueryResult> => {
        try {
          const queryResult = await chromaService.queryDocumentsWithEmbedding(
            name,
            imageEmbedding || queryEmbedding,
            4
          ) as ChromaQueryResult;

          if (!queryResult?.documents || !queryResult?.metadatas) {
            return { context: '', sources: [] };
          }

          const results = queryResult.documents
            .map((doc: string, index: number): QueryResult => ({
              text: doc,
              metadata: queryResult.metadatas[index],
              similarity: 1 - (queryResult.distances?.[index] || 0)
            }));

          // กำหนดค่า threshold ที่สามารถปรับได้ตามความเหมาะสม
          // ค่าสูงขึ้นหมายถึงกรองเฉพาะข้อมูลที่เกี่ยวข้องมากขึ้น
          const MIN_SIMILARITY_THRESHOLD = 0.1; // เพิ่มจาก 0.1 เป็น 0.3

          const filteredResults = results
            .filter(result => result.similarity >= MIN_SIMILARITY_THRESHOLD)
            .sort((a, b) => b.similarity - a.similarity);

          const sources = filteredResults.map(result => ({
            modelId: result.metadata.modelId,
            collectionName: name,
            filename: result.metadata.filename,
            similarity: result.similarity
          }));

          // เพิ่ม logging เพื่อตรวจสอบ
          // console.log('Filtered results:', {
          //   name,
          //   resultCount: filteredResults.length,
          //   context: filteredResults.map(r => r.text).join("\n\n")
          // });

          return {
            context: filteredResults.map(r => r.text).join("\n\n"),
            sources
          };
        } catch (error) {
          console.error(`Error querying collection ${name}:`, error);
          return { context: '', sources: [] };
        }
      })
    );
  }

  private detectQuestionType(query: string): string {
    const patterns = {
      [this.questionTypes.FACTUAL]: /^(what|when|where|who|which|how many|how much)/i,
      [this.questionTypes.ANALYTICAL]: /^(why|how|what if|what are the implications|analyze|compare|contrast)/i,
      [this.questionTypes.CONCEPTUAL]: /^(explain|describe|define|what is|what are|how does)/i,
      [this.questionTypes.PROCEDURAL]: /^(how to|how do|what steps|how can|show me how)/i,
      [this.questionTypes.CLARIFICATION]: /^(can you clarify|what do you mean|please explain|could you elaborate)/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(query)) {
        return type;
      }
    }

    return this.questionTypes.FACTUAL; // Default to factual if no pattern matches
  }

  private async getContext(query: string, modelIdOrCollections: string | string[], imageBase64?: string): Promise<string> {
    const questionType = this.detectQuestionType(query);
    const promptTemplate = this.promptTemplates[questionType];
    
    const collectionNames = await this.resolveCollections(modelIdOrCollections);
    let context = '';

    // ดึงข้อมูลจาก collections ก่อน
    if (collectionNames.length > 0) {
      const sanitizedCollections = collectionNames.map(name => 
        this.sanitizeCollectionName(name)
      );

      const truncatedQuery = query.slice(0, 512);
      let queryEmbedding = await chromaService.getQueryEmbedding(truncatedQuery);
      let imageEmbedding: number[] | undefined;
      
      if (imageBase64) {
        try {
          imageEmbedding = await bedrockService.embedImage(imageBase64, truncatedQuery);
        } catch (error) {
          console.error('Error generating image embedding:', error);
        }
      }

      const batches = this.createBatches(sanitizedCollections, this.BATCH_SIZE);
      let allResults: CollectionQueryResult[] = [];
      
      for (const batch of batches) {
        const batchResults = await this.processBatch(batch, queryEmbedding, imageEmbedding);
        allResults = allResults.concat(batchResults);
      }

      // ประมวลผลข้อมูลจาก collections
      context = this.processResults(allResults);
    }

    // แก้ไขส่วนนี้: ใช้เฉพาะคำถามล่าสุดในการค้นหาเว็บ
    const lastQuestion = query.split('\n').pop() || query;
    try {
      const webResults = await webSearchService.searchWeb(lastQuestion);
      if (webResults) {
        if (context) {
          context += '\n\nAdditional supporting information:\n' + webResults;
        } else {
          context = 'Based on web search results:\n' + webResults;
        }
      }
    } catch (error) {
      console.error('Error fetching web results:', error);
    }

    return `${promptTemplate}\n\n${context}`;
  }

  private summarizeOldMessages(messages: ChatMessage[]): string {
    if (messages.length <= 0) {
      return '';
    }

    // Create a concise summary of the older messages
    const summary = messages.map(msg => {
      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      const content = msg.content.length > 100 
        ? `${msg.content.substring(0, 97)}...` 
        : msg.content;
      return `${role}: ${content}`;
    }).join('\n');

    return `Previous conversation summary:\n${summary}`;
  }

  private async updateDailyStats(userId: string): Promise<void> {
    try {
      // สร้างวันที่ปัจจุบันในโซนเวลาไทย (UTC+7)
      const today = new Date();
      today.setHours(today.getHours() + 7); // แปลงเป็นเวลาไทย
      today.setHours(0, 0, 0, 0); // รีเซ็ตเวลาเป็นต้นวัน

      const stats = await ChatStats.findOneAndUpdate(
        { date: today },
        {
          $addToSet: { uniqueUsers: userId },
          $inc: { totalChats: 1 }
        },
        { 
          upsert: true,
          new: true 
        }
      );

      // console.log(`Updated daily stats for ${userId}:`, {
      //   date: today.toISOString(),
      //   uniqueUsers: stats.uniqueUsers.length,
      //   totalChats: stats.totalChats
      // });
    } catch (error) {
      console.error('Error updating daily stats:', error);
    }
  }

  private async getSystemPrompt(): Promise<string> {
    try {
      const promptDoc = await SystemPrompt.findOne().sort({ updatedAt: -1 });
      return promptDoc ? promptDoc.prompt : this.systemPrompt;
    } catch (error) {
      console.error('Error fetching system prompt, using default:', error);
      return this.systemPrompt;
    }
  }

  async *generateResponse(
    messages: ChatMessage[],
    query: string,
    modelIdOrCollections: string | string[],
    userId: string
  ): AsyncGenerator<string> {
    try {
      // console.log("Starting generateResponse with:", modelIdOrCollections);
      
      const lastMessage = messages[messages.length - 1];
      const isImageGeneration = lastMessage.isImageGeneration;
      
      // Dynamically determine message limit based on message length
      const MAX_CHAR_THRESHOLD = 500; // Define threshold for "long" messages
      const DEFAULT_MESSAGE_LIMIT = 6;
      const LONG_MESSAGE_LIMIT = 2;
      
      // Calculate average message length
      const avgMessageLength = messages.reduce((sum, msg) => 
        sum + (msg.content?.length || 0), 0) / Math.max(1, messages.length);
      
      // Set message limit based on average length
      const MESSAGE_LIMIT = avgMessageLength > MAX_CHAR_THRESHOLD 
        ? LONG_MESSAGE_LIMIT 
        : DEFAULT_MESSAGE_LIMIT;
      
      let recentMessages: ChatMessage[] = [];
      let olderMessages: ChatMessage[] = [];
      
      if (messages.length > MESSAGE_LIMIT) {
        // Split messages into older and recent messages
        olderMessages = messages.slice(0, messages.length - MESSAGE_LIMIT);
        recentMessages = messages.slice(messages.length - MESSAGE_LIMIT);
      } else {
        recentMessages = [...messages];
      }
      
      // ดึง system prompt จากฐานข้อมูล
      const dynamicSystemPrompt = await this.getSystemPrompt();

      const systemMessages: ChatMessage[] = [
        {
          role: 'system',
          content: isImageGeneration ? 
            'You are an expert at generating detailed image descriptions. Create vivid, detailed descriptions that can be used to generate images.' :
            dynamicSystemPrompt
        }
      ];

      // Add summary of older messages if there are any
      if (olderMessages.length > 0) {
        systemMessages.push({
          role: 'system',
          content: this.summarizeOldMessages(olderMessages)
        });
      }

      // Combine system messages with recent user messages only
      const augmentedMessages = [...systemMessages, ...recentMessages];

      // นับจำนวนข้อความทั้งหมดในการสนทนานี้
      const messageCount = messages.length + 1; // รวมข้อความใหม่ด้วย
      
      // อัพเดทสถิติพร้อมจำนวนข้อความ
      await this.updateDailyStats(userId);
      
      let attempt = 0;
      while (attempt < this.retryConfig.maxRetries) {
        try {
          // ตรวจสอบว่ามีไฟล์หรือไม่
          const hasFiles = lastMessage.files && lastMessage.files.length > 0;
          
          // ถ้ามีไฟล์ ให้สร้างข้อความพิเศษบอก AI ว่ามีไฟล์แนบมา
          if (hasFiles && lastMessage.files) {
            const fileInfo = lastMessage.files.map(file => {
              let fileDetail = `- ${file.name} (${file.mediaType}, ${Math.round(file.size / 1024)} KB)`;
              if (file.content) {
                fileDetail += " - File content included";
              }
              return fileDetail;
            }).join('\n');
            
            // เพิ่มข้อความเกี่ยวกับไฟล์แนบในคำถาม
            query = `${query}\n\n[Attached files]\n${fileInfo}`;
          }

          // Get tools for tool calling
          const tools = this.getTools();
          let toolResults: any[] = [];
          let maxToolIterations = 5; // Prevent infinite loops
          let iteration = 0;

          while (iteration < maxToolIterations) {
            iteration++;
            
            // Generate response with tools
            const toolCalls: any[] = [];
            let responseText = '';
            let hasToolCalls = false;
            
            for await (const chunk of bedrockService.chat(
              augmentedMessages, 
              isImageGeneration ? bedrockService.models.titanImage : bedrockService.chatModel,
              iteration === 1 ? tools : undefined,
              toolResults.length > 0 ? toolResults : undefined
            )) {
              if (typeof chunk === 'string') {
                responseText += chunk;
                yield chunk;
              } else if (chunk && typeof chunk === 'object' && chunk.type === 'tool_use') {
                hasToolCalls = true;
                toolCalls.push(chunk);
              }
            }

            // If no tool calls, we're done
            if (!hasToolCalls || toolCalls.length === 0) {
              break;
            }

            // Execute tools
            const newToolResults: any[] = [];
            for (const toolCall of toolCalls) {
              const result = await this.executeTool(
                toolCall.name,
                toolCall.input,
                userId,
                modelIdOrCollections
              );
              
              newToolResults.push({
                toolUseId: toolCall.toolUseId,
                name: toolCall.name,
                input: toolCall.input,
                content: result,
                status: 'success'
              });
            }

            toolResults = newToolResults;
            
            // Prepare messages for next iteration with tool results
            // Don't modify augmentedMessages directly, create new array
            const messagesWithToolResults = [...augmentedMessages];
            
            // Add assistant message with tool use
            messagesWithToolResults.push({
              role: 'assistant',
              content: JSON.stringify(toolCalls.map(tc => ({ name: tc.name, input: tc.input })))
            });
            
            // Add user message with tool results
            messagesWithToolResults.push({
              role: 'user',
              content: toolResults.map(r => r.content).join('\n\n')
            });
            
            augmentedMessages.length = 0;
            augmentedMessages.push(...messagesWithToolResults);
          }

          // อัพเดท token usage หลังจากได้ response ทั้งหมด
          const totalTokens = bedrockService.getLastTokenUsage();
          if (totalTokens > 0) {
            const usage = await usageService.updateTokenUsage(userId, totalTokens);
            console.log(`[Chat] Token usage updated for ${userId}:`, {
              used: totalTokens,
              daily: usage.dailyTokens,
              remaining: usage.remainingTokens
            });
            
            // อัปเดตข้อมูล token ในสถิติรายวัน
            const today = new Date();
            today.setHours(today.getHours() + 7); // แปลงเป็นเวลาไทย
            today.setHours(0, 0, 0, 0); // รีเซ็ตเวลาเป็นต้นวัน

            await ChatStats.findOneAndUpdate(
              { date: today },
              { $inc: { totalTokens: totalTokens } },
              { upsert: true }
            );
          }
          return;
        } catch (error: unknown) {
          attempt++;
          if (error instanceof Error && error.name === 'InvalidSignatureException') {
            console.error(`Error in chat generation (Attempt ${attempt}/${this.retryConfig.maxRetries}):`, error);
            // รอสักครู่ก่อน retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(`${errorMessage} (Attempt ${attempt}/${this.retryConfig.maxRetries}):`, error);
        
        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
            this.retryConfig.maxDelay
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`${errorMessage} after ${this.retryConfig.maxRetries} attempts: ${lastError?.message}`);
  }

  async getChats(userId: string, page: number = 1, limit: number = 5) {
    const skip = (page - 1) * limit;
    const chats = await Chat.find({ userId })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Chat.countDocuments({ userId });
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return { chats, totalPages, hasMore };
  }

  private isValidObjectId(id: string | null): boolean {
    if (!id) return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  async getChat(userId: string, chatId: string) {
    try {
      if (!this.isValidObjectId(chatId)) {
        throw new Error('Invalid chat ID format');
      }

      const chat = await Chat.findOne({ _id: chatId, userId });
      if (!chat) {
        throw new Error('Chat not found');
      }
      return chat;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid chat ID format') {
          throw error;
        }
        if (error.message === 'Chat not found') {
          throw error;
        }
        console.error('Error getting chat:', error);
        throw new Error('Failed to get chat');
      }
      throw error;
    }
  }

  async saveChat(userId: string, modelId: string, messages: any[]) {
    try {
      // บันทึกสถิติก่อนที่จะบันทึกแชท
      await this.updateDailyStats(userId);

      // หาข้อความแรกของ user
      const firstUserMessage = messages.find(msg => msg.role === 'user');
      const chatname = firstUserMessage ? firstUserMessage.content.substring(0, 50) : 'Untitled Chat';
      
      const lastMessage = messages[messages.length - 1];
      const name = lastMessage.content.substring(0, 50);

      const processedMessages = messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp?.$date ? new Date(msg.timestamp.$date) : new Date(),
        images: msg.images || [],
        sources: msg.sources || [],
        isImageGeneration: msg.isImageGeneration || false,
        isComplete: msg.isComplete || false
      }));

      const chat = new Chat({
        userId,
        modelId,
        chatname,
        name,
        messages: processedMessages
      });

      await chat.save();
      return chat;
    } catch (error) {
      console.error('Error saving chat:', error);
      throw error;
    }
  }

  async updateChat(chatId: string, userId: string, messages: any[]) {
    try {
      if (!this.isValidObjectId(chatId)) {
        throw new Error('Invalid chat ID format');
      }

      const chat = await Chat.findOneAndUpdate(
        { _id: chatId, userId },
        {
          $set: {
            name: messages[messages.length - 1].content.substring(0, 50),
            messages: messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp?.$date ? new Date(msg.timestamp.$date) : new Date(),
              images: msg.images || [],
              sources: msg.sources || [],
              isImageGeneration: msg.isImageGeneration || false,
              isComplete: msg.isComplete || false
            }))
          }
        },
        { new: true }
      );

      if (!chat) {
        throw new Error('Chat not found');
      }

      return chat;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid chat ID format') {
          throw error;
        }
        if (error.message === 'Chat not found') {
          throw error;
        }
        console.error('Error updating chat:', error);
        throw new Error('Failed to update chat');
      }
      throw error;
    }
  }

  async deleteChat(chatId: string, userId: string) {
    try {
      if (!this.isValidObjectId(chatId)) {
        throw new Error('Invalid chat ID format');
      }

      const result = await Chat.deleteOne({ _id: chatId, userId });
      if (result.deletedCount === 0) {
        throw new Error('Chat not found or unauthorized');
      }
      return true;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Invalid chat ID format') {
          throw error;
        }
        if (error.message === 'Chat not found or unauthorized') {
          throw error;
        }
        console.error('Error deleting chat:', error);
        throw new Error('Failed to delete chat');
      }
      throw error;
    }
  }

  async togglePinChat(chatId: string, userId: string) {
    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      throw new Error('Chat not found');
    }

    chat.isPinned = !chat.isPinned;
    await chat.save();
    return chat;
  }

  // เพิ่มฟังก์ชันใหม่สำหรับประมวลผลข้อมูล
  private processResults(results: CollectionQueryResult[]): string {
    const MIN_COLLECTION_SIMILARITY = 0.4;
    
    const contexts = results
      .filter(r => {
        if (r.sources.length === 0) return false;
        const maxSimilarity = Math.max(...r.sources.map(s => s.similarity));
        return maxSimilarity >= MIN_COLLECTION_SIMILARITY;
      })
      .sort((a, b) => {
        const aMaxSim = Math.max(...a.sources.map(s => s.similarity));
        const bMaxSim = Math.max(...b.sources.map(s => s.similarity));
        return bMaxSim - aMaxSim;
      })
      .map(r => r.context);

    const MAX_CONTEXT_LENGTH = 6000;
    let context = '';
    
    for (const result of contexts) {
      if (result && result.length > 0) {
        let resultToAdd = result;
        if (resultToAdd.length > MAX_CONTEXT_LENGTH) {
          resultToAdd = resultToAdd.substring(0, MAX_CONTEXT_LENGTH);
          const lastPeriodIndex = resultToAdd.lastIndexOf('.');
          const lastNewlineIndex = resultToAdd.lastIndexOf('\n');
          const lastBreakIndex = Math.max(lastPeriodIndex, lastNewlineIndex);
          if (lastBreakIndex > MAX_CONTEXT_LENGTH * 0.8) {
            resultToAdd = resultToAdd.substring(0, lastBreakIndex + 1);
          }
        }
        
        if (context.length + resultToAdd.length > MAX_CONTEXT_LENGTH) {
          break;
        }
        context += resultToAdd + '\n';
      }
    }

    return context;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  // console.log('Debug message');
}

