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
import { titanEmbedService } from './titan';
import { splitTextIntoChunks } from '../utils/textUtils';

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

    // ค้นหาข้อมูลเพิ่มเติมจากเว็บเฉพาะเมื่อ:
    // 1. มีข้อมูลจาก collection แต่อาจจะไม่ครบถ้วน หรือ
    // 2. ไม่มีข้อมูลจาก collection เลย
    try {
      const webResults = await webSearchService.searchWeb(query);
      if (webResults) {
        // ถ้ามีข้อมูลจาก collection อยู่แล้ว
        if (context) {
          context += '\n\nAdditional supporting information:\n' + webResults;
        } else {
          // ถ้าไม่มีข้อมูลจาก collection เลย
          context = 'Based on web search results:\n' + webResults;
        }
      }
    } catch (error) {
      console.error('Error fetching web results:', error);
      // ถ้าเกิดข้อผิดพลาดในการค้นหาเว็บ ใช้แค่ข้อมูลจาก collection
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

  /**
   * Processes attachment embeddings from a message to provide additional context for response generation.
   * This includes both image embeddings and file content embeddings.
   *
   * @param message The message containing attachment embeddings
   * @param query The user's query text
   * @returns Additional context derived from attachments
   */
  private async processAttachmentEmbeddings(lastMessage: ChatMessage, query: string): Promise<string> {
    let contextBuilder: string[] = [];
    
    // Process image embeddings if available
    if (lastMessage.imageEmbeddings && lastMessage.imageEmbeddings.length > 0) {
      contextBuilder.push(`Observations from attached images:`);
      
      // Add a description based on available embeddings
      const imageCount = lastMessage.imageEmbeddings.length;
      contextBuilder.push(`There ${imageCount === 1 ? 'is' : 'are'} ${imageCount} image${imageCount > 1 ? 's' : ''} attached to this message.`);
      contextBuilder.push(`The images appear to contain visual information relevant to the query.`);
    }
    
    // Process file content if available - using chunking and batching
    if (lastMessage.files && lastMessage.files.length > 0) {
      try {
        // ประมวลผลเอกสารที่แนบมา
        const processedFiles = await this.processFilesForEmbedding(lastMessage.files);
        
        if (processedFiles && processedFiles.length > 0) {
          contextBuilder.push(`Information from attached documents:`);
          
          // กำหนดจำนวน chunks สูงสุดที่จะรวมเข้าไปในบริบท
          const MAX_CHUNKS_PER_FILE = 3; 
          
          // สร้างบริบทจากเอกสารที่ประมวลผล
          for (const file of processedFiles) {
            contextBuilder.push(`From document ${file.name}:`);
            
            // เพิ่มเนื้อหาจาก chunks
            const chunks = file.chunks.slice(0, MAX_CHUNKS_PER_FILE);
            for (const chunk of chunks) {
              contextBuilder.push(chunk.text);
            }
            
            if (file.chunks.length > MAX_CHUNKS_PER_FILE) {
              contextBuilder.push(`Note: Only showing ${MAX_CHUNKS_PER_FILE} most relevant segments from ${file.chunks.length} total segments in ${file.name}.`);
            }
          }
        }
      } catch (error) {
        console.error('Error processing document files:', error);
      }
    }
    
    return contextBuilder.length > 0 ? contextBuilder.join("\n") : "";
  }

  /**
   * ประมวลผลเอกสารแบบแบตช์และแบ่งชั้น
   */
  private async processFilesForEmbedding(files: { name: string; data: string; mediaType: string; size: number; content?: string }[]): Promise<{
    name: string;
    chunks: {
      text: string;
      embedding: number[];
    }[];
  }[]> {
    if (!files || files.length === 0) return [];

    const processedFiles = await Promise.all(
      files.map(async (file) => {
        if (!file.content) return null;
        
        // แบ่งเนื้อหาเอกสารเป็นชั้นๆ
        const chunks = splitTextIntoChunks(file.content);
        
        // คำนวณ embeddings สำหรับทุกชั้น
        const chunksWithEmbeddings = await Promise.all(
          chunks.map(async (chunk) => {
            try {
              const embedding = await titanEmbedService.embedText(chunk);
              return {
                text: chunk,
                embedding
              };
            } catch (error) {
              console.error(`Error embedding chunk for file ${file.name}:`, error);
              return null;
            }
          })
        );
        
        // กรอง chunksWithEmbeddings ที่เป็น null ออกและระบุ type ให้ชัดเจน
        const validChunks = chunksWithEmbeddings.filter((chunk): chunk is { text: string; embedding: number[] } => 
          chunk !== null
        );
        
        return {
          name: file.name,
          chunks: validChunks
        };
      })
    );
    
    // กรอง processedFiles ที่เป็น null ออกและระบุ type ให้ชัดเจน
    const result = processedFiles.filter((file): file is { 
      name: string; 
      chunks: { text: string; embedding: number[] }[] 
    } => file !== null);
    
    return result;
  }

  /**
   * สร้างบริบทจากเอกสารที่ประมวลผลแล้ว
   */
  private getDocumentContext(processedFiles: {
    name: string;
    chunks: {
      text: string;
      embedding: number[];
    }[];
  }[], query: string): string {
    if (!processedFiles || processedFiles.length === 0) return "";
    
    let documentContext = "";
    
    // รวบรวมบริบทจากทุกไฟล์
    for (const file of processedFiles) {
      if (file.chunks && file.chunks.length > 0) {
        documentContext += `\nInformation from document "${file.name}":\n`;
        // เพิ่มสูงสุด 3 chunks เพื่อไม่ให้บริบทยาวเกินไป
        for (let i = 0; i < Math.min(3, file.chunks.length); i++) {
          documentContext += `${file.chunks[i].text}\n`;
        }
      }
    }
    
    return documentContext;
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
      
      // Process attachment embeddings if available
      let attachmentContext = "";
      if (lastMessage && (lastMessage.imageEmbeddings || lastMessage.files)) {
        try {
          attachmentContext = await this.processAttachmentEmbeddings(lastMessage, query);
          
          // Add attachment context to main context
          if (attachmentContext) {
            if (context) context += '\n\n';
            context += attachmentContext;
          }
        } catch (attachmentError) {
          console.error('Error processing attachment embeddings:', attachmentError);
          // Continue without attachment context
        }
      }
      
      // console.log('Retrieved context length:', context.length);

      const questionType = isImageGeneration ? 'imageGeneration' : this.detectQuestionType(query);
      // console.log('Question type:', questionType);

      // ดึง system prompt จากฐานข้อมูล
      let systemPrompt = this.systemPrompt;
      try {
        const defaultPrompt = await SystemPrompt.findOne({ isDefault: true });
        if (defaultPrompt) {
          systemPrompt = defaultPrompt.prompt;
        }
      } catch (error) {
        console.error('Error fetching system prompt:', error);
        // Continue with default system prompt
      }

      // Prepare messages for the LLM
      const systemMessages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt
        }
      ];

      // Add summary of older messages if there are any
      if (olderMessages.length > 0) {
        systemMessages.push({
          role: 'system',
          content: this.summarizeOldMessages(olderMessages)
        });
      }

      // Only add context if we have it and not in image generation mode
      if (context && !isImageGeneration) {
        systemMessages.push({
          role: 'system',
          content: this.promptTemplates[questionType]
        });
      }

      // Combine system messages with recent user messages only
      const augmentedMessages = [...systemMessages, ...recentMessages];

      // นับจำนวนข้อความทั้งหมดในการสนทนานี้
      let totalMessages = messages.length + 1;

      // บันทึกสถิติการสนทนา
      try {
        // บันทึก token usage สำหรับการใช้งาน
        await usageService.updateTokenUsage(userId, query.length);
        
        // บันทึกสถิติการใช้งาน
        const chatStats = new ChatStats({
          userId,
          modelId: typeof modelIdOrCollections === 'string' ? modelIdOrCollections : 'multiple',
          timestamp: new Date(),
          numMessages: totalMessages,
          questionType
        });
        await chatStats.save();
      } catch (error) {
        console.error('Error saving chat stats:', error);
        // Continue without saving stats
      }

      // Process response based on type
      if (isImageGeneration) {
        try {
          const imageResult = await bedrockService.generateImage(query);
          yield imageResult;
        } catch (error) {
          console.error('Error generating image:', error);
          yield "I'm sorry, I wasn't able to generate that image. Please try a different description.";
        }
      } else {
        try {
          // Generate response and send chunks
          let totalTokens = 0;
          for await (const chunk of bedrockService.chat(augmentedMessages, isImageGeneration ? bedrockService.models.titanImage : bedrockService.chatModel)) {
            if (typeof chunk === 'string') {
              yield chunk;
            } else if (typeof chunk === 'object' && chunk !== null) {
              const tokenChunk = chunk as { token: string };
              if ('token' in tokenChunk) {
                totalTokens += 1;
                yield tokenChunk.token;
              }
            }
          }
        } catch (error) {
          console.error('Error generating response:', error);
          yield "I'm sorry, I encountered an error while generating a response. Please try again.";
        }
      }
    } catch (error) {
      console.error('Error in generateResponse:', error);
      yield "I apologize, but I'm having trouble processing your request. Please try again later.";
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

  /**
   * Determines whether the query might benefit from web search augmentation.
   * Examines query for patterns indicating need for real-time or external information.
   */
  private shouldAugmentWithWebSearch(query: string): boolean {
    // Convert to lowercase for case-insensitive matching
    const lowerQuery = query.toLowerCase();
    
    // Keywords suggesting current events or recent information
    const timeKeywords = [
      'latest', 'recent', 'current', 'today', 'yesterday', 'this week',
      'this month', 'this year', 'last week', 'last month', 'last year',
      'breaking news', 'update', 'new'
    ];
    
    // Keywords suggesting specific factual information
    const factKeywords = [
      'what is', 'who is', 'where is', 'when did', 'how many',
      'which', 'why', 'define', 'explain', 'information about',
      'data on', 'statistics', 'research'
    ];
    
    // Check for time-based keywords
    const hasTimeKeyword = timeKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    );
    
    // Check for fact-based keywords
    const hasFactKeyword = factKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    );
    
    // Additional patterns suggesting external information need
    const hasWebIndicator = lowerQuery.includes('website') || 
                            lowerQuery.includes('internet') ||
                            lowerQuery.includes('online') ||
                            lowerQuery.includes('search for');
    
    return hasTimeKeyword || hasFactKeyword || hasWebIndicator;
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  // console.log('Debug message');
}

