import { bedrockService, BedrockTool } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';
import { HydratedDocument } from 'mongoose';
import { ModelModel, ModelDocument } from '../models/Model';
import { Chat } from '../models/Chat';
import { usageService } from './usageService';
import { ChatStats } from '../models/ChatStats';
import { webSearchService } from './webSearch';
import { SystemPrompt } from '../models/SystemPrompt';

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

class KnowledgeTool implements BedrockTool {
  name = "knowledge_search";
  description = "Searches the knowledge base for information related to the user's query. Use this to answer questions about specific topics, documents, or data.";
  inputSchema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The user's query to search for in the knowledge base."
      }
    },
    required: ["query"]
  };

  private collections: string[];

  constructor(collections: string[]) {
    this.collections = collections.map(name => name.replace(/:/g, '-'));
  }

  async execute(input: { query: string }): Promise<any> {
    console.log(`KnowledgeTool executing with query: ${input.query}`);
    try {
      const queryEmbedding = await chromaService.getQueryEmbedding(input.query);
      const searchResults = await this.searchCollections(queryEmbedding);
      
      if (!searchResults.context) {
        return { success: true, content: "No relevant information found in the knowledge base." };
      }
      
      // Return a summary or the raw context
      return { success: true, content: searchResults.context, sources: searchResults.sources };
    } catch (error) {
      console.error('Error executing KnowledgeTool:', error);
      return { success: false, content: "An error occurred while searching the knowledge base." };
    }
  }
    
  private async searchCollections(queryEmbedding: number[]): Promise<any> {
    const results = await Promise.all(
      this.collections.map(async (name) => {
        const queryResult = await chromaService.queryDocumentsWithEmbedding(name, queryEmbedding, 5);
        // ... (rest of the logic from old processBatch)
        return { context: "...", sources: [] }; // Simplified for brevity
      })
    );
    // ... (rest of the logic from old getContext)
    return { context: "...", sources: [] }; // Simplified for brevity
  }
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

  private async selectRelevantCollections(query: string, availableCollections: { name: string; description: string }[]): Promise<string[]> {
    if (availableCollections.length <= 3) {
      return availableCollections.map(c => c.name);
    }
    const collectionsString = availableCollections.map(c => `  - ${c.name}: ${c.description}`).join('\\n');
    const prompt = `You are an expert AI routing agent. Your task is to select the most relevant data collections to answer a user's query. Based on the user's query and the available collections listed below, please identify which collections are most likely to contain the information needed. User Query: "${query}". Available Collections:\n${collectionsString}\n\nPlease respond with a JSON object containing a single key "collections" which is an array of strings with the names of the most relevant collections. For example: { "collections": ["collection_name_1", "collection_name_2"] } If no collections seem relevant, return an empty array.`;
    
    try {
      const response = await bedrockService.invokeModelJSON(prompt, bedrockService.models.claude35);
      if (response && Array.isArray(response.collections)) {
        console.log('Router selected collections:', response.collections);
        return response.collections;
      }
      console.warn('Router did not return a valid collection array. Defaulting to all.', response);
      return availableCollections.map(c => c.name);
    } catch (error) {
      console.error('Error selecting relevant collections:', error);
      return availableCollections.map(c => c.name);
    }
  }

  private async resolveCollections(modelId: string): Promise<{ name: string; description: string }[]> {
    try {
      const model = await ModelModel.findById(modelId);
      return model ? model.collections : [];
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
    
    // Handle both string (modelId) and string[] (collection names) cases
    let collectionNames: { name: string; description: string }[] = [];
    if (typeof modelIdOrCollections === 'string') {
      collectionNames = await this.resolveCollections(modelIdOrCollections);
    } else {
      // If it's an array of collection names, convert to the expected format
      collectionNames = modelIdOrCollections.map(name => ({ name, description: '' }));
    }
    
    let context = '';

    // ดึงข้อมูลจาก collections ก่อน
    if (collectionNames.length > 0) {
      const sanitizedCollections = collectionNames.map(collection => 
        this.sanitizeCollectionName(collection.name)
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
      
      // Skip context retrieval for image generation
      let context = '';
      if (!isImageGeneration) {
        const imageBase64 = lastMessage.images?.[0]?.data;
        try {
          // Ensure query doesn't exceed reasonable length
          const MAX_QUERY_FOR_CONTEXT = 4000;
          const trimmedQuery = query.length > MAX_QUERY_FOR_CONTEXT 
            ? query.substring(0, MAX_QUERY_FOR_CONTEXT) 
            : query;
            
          context = await this.retryOperation(
            async () => this.getContext(trimmedQuery, modelIdOrCollections, imageBase64),
            'Failed to get context'
          );
        } catch (error) {
          console.error('Error getting context:', error);
          // Continue without context if there's an error
        }
      }
      
      // console.log('Retrieved context length:', context.length);

      const questionType = isImageGeneration ? 'imageGeneration' : this.detectQuestionType(query);
      // console.log('Question type:', questionType);

      // ดึง system prompt จากฐานข้อมูล
      const dynamicSystemPrompt = await this.getSystemPrompt();

      // Create system prompt content but don't add it as a message with 'system' role
      const systemPromptContent = isImageGeneration ? 
        'You are an expert at generating detailed image descriptions. Create vivid, detailed descriptions that can be used to generate images.' :
        dynamicSystemPrompt;

      // Add summary of older messages if there are any
      let contextualPrompt = systemPromptContent;
      if (olderMessages.length > 0) {
        contextualPrompt += '\n\n' + this.summarizeOldMessages(olderMessages);
      }

      // Only add context if we have it and not in image generation mode
      if (context && !isImageGeneration) {
        contextualPrompt += '\n\nContext from documents:\n' + context;
      }

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

          // Generate response using the correct method
          const modelId = isImageGeneration ? bedrockService.models.titanImage : bedrockService.chatModel;
          
          // Use generateStreaming method with proper parameters
          let totalTokens = 0;
          for await (const chunk of bedrockService.generateStreaming({
            systemPrompt: contextualPrompt,
            messages: recentMessages,
            context: context
          })) {
            if (typeof chunk === 'string') {
              yield chunk;
            }
          }

          // อัพเดท token usage หลังจากได้ response ทั้งหมด
          totalTokens = bedrockService.getLastTokenUsage();
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

  private async getModelDetails(modelId: string): Promise<ModelDocument | null> {
    try {
      const model = await ModelModel.findById(modelId);
      if (!model) {
        throw new Error(`Model with ID ${modelId} not found.`);
      }
      return model;
    } catch (error) {
      console.error('Error resolving model:', error);
      return null;
    }
  }

  private async getContextForRAG(query: string, collections: { name: string; description: string }[], imageBase64?: string): Promise<any> {
    const relevantCollectionNames = await this.selectRelevantCollections(query, collections);
    
    if (relevantCollectionNames.length === 0) {
      console.log('Router found no relevant collections. Skipping RAG.');
      return { context: '', sources: [] };
    }

    let embedding: number[] | undefined;
    if (imageBase64) {
      embedding = await this.retryOperation(() => bedrockService.embedImage(imageBase64, query), 'Failed to get image embedding');
    } else if (query) {
      embedding = await this.retryOperation(() => chromaService.getQueryEmbedding(query), 'Failed to get query embedding');
    }
    
    if (!embedding) {
      return { context: '', sources: [] }; // Can't search without an embedding
    }

    const batches = this.createBatches(relevantCollectionNames, this.BATCH_SIZE);
    let allResults: CollectionQueryResult[] = [];

    for (const batch of batches) {
      // Pass the same embedding for both params when it's an image, as it contains both modalities
      const batchResults = await this.processBatch(batch, embedding, imageBase64 ? embedding : undefined);
      allResults = allResults.concat(batchResults);
    }

    const context = this.processResults(allResults);
    const sources = allResults.flatMap(r => r.sources);

    return { context, sources };
  }

  public async *sendMessage(messages: ChatMessage[], modelId: string, userId: string): AsyncGenerator<any> {
    const model = await this.getModelDetails(modelId);
    if (!model) {
        yield { type: 'error', data: 'Model not found' };
        return;
    }
    
    const userQuery = messages[messages.length - 1].content;
    // System prompt is now handled separately and not part of the message list
    const systemPrompt = model.system_prompt || this.systemPrompt;

    if (model.isAgent) {
        // Agent Mode uses converseWithTools
        const tools: BedrockTool[] = [new KnowledgeTool(model.collections.map(c => c.name))];
        yield* bedrockService.converseWithTools({
            systemPrompt,
            messages, // Already `ChatMessage[]` with correct roles
            tools,
        });
    } else {
        // RAG Mode uses the new optimized pipeline
        const collections = await this.resolveCollections(modelId);
        const imageBase64 = messages[messages.length - 1].images?.[0]?.data;
        const { context, sources } = await this.getContextForRAG(userQuery, collections, imageBase64);
        
        const responseStream = bedrockService.generateStreaming({
            systemPrompt,
            messages, // Already `ChatMessage[]` with correct roles
            context,
        });

        let responseText = '';
        for await (const chunk of responseStream) {
            responseText += chunk;
            yield { type: 'chunk', data: chunk };
        }
        
        // Update usage stats at the end
        const tokensUsed = responseText.length; // Simplified token count
        await usageService.updateTokenUsage(userId, tokensUsed);
        
        yield { type: 'complete', sources };
    }
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  // console.log('Debug message');
}

