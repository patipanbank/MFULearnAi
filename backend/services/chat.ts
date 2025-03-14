import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';
import { HydratedDocument } from 'mongoose';
import { ModelModel } from '../models/Model';
import { Chat } from '../models/Chat';
import { usageService } from './usageService';
import { ChatStats } from '../models/ChatStats';
import { searchService } from './searchService';

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

  private systemPrompt = `You are DinDin, a male AI assistant for Mae Fah Luang University. Follow these guidelines:

  1. Response Style:
     - Be concise, clear and direct
     - Use Thai language when users ask in Thai
     - Use English when users ask in English
     - Maintain a professional yet friendly tone
     - Break complex topics into numbered steps
     - Use bullet points for lists when appropriate
  
  2. Knowledge Base:
     - Prioritize using provided context and documentation
     - Can answer general questions beyond the provided context
     - Can analyze and describe images
     - Can read and summarize files
     - For MFU-specific questions, clearly state if information is from official sources
     - When <SEARCH_RESULTS> are provided, use this real-time information from the internet for your response
  
  3. Interaction Guidelines:
     - Ask for clarification if the question is unclear
     - Provide relevant examples when helpful
     - If unsure, acknowledge limitations and suggest alternatives
     - Format code blocks with appropriate syntax highlighting
     - For long responses, use headers to organize information
  
  4. Special Instructions:
     - When citing sources, clearly indicate the reference
     - For technical topics, include brief explanations of key terms
     - When handling errors or issues, provide step-by-step troubleshooting
     - For data or statistics, specify the source and timeframe
     - When using search results, mention that the information is from recent internet sources
  
  Remember: Always prioritize accuracy and clarity in your responses while maintaining a helpful and educational approach.`;

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
    // console.log('Getting context for:', {
    //   query,
    //   modelIdOrCollections,
    //   hasImage: !!imageBase64
    // });

    const questionType = this.detectQuestionType(query);
    const promptTemplate = this.promptTemplates[questionType];
    
    const collectionNames = await this.resolveCollections(modelIdOrCollections);
    if (collectionNames.length === 0) {
      console.error('No collections found for:', modelIdOrCollections);
      return '';
    }

    // console.log('Resolved collection names:', collectionNames);
    // console.log('Detected question type:', questionType);

    const sanitizedCollections = collectionNames.map(name => 
      this.sanitizeCollectionName(name)
    );
    // console.log('Sanitized collection names:', sanitizedCollections);

    // console.log('Getting query embedding...');
    // Limit query length for embedding to stay within service limits (50,000 chars)
    const MAX_QUERY_LENGTH = 4000; // Conservative limit to ensure we stay well under the 50k limit
    const truncatedQuery = query.length > MAX_QUERY_LENGTH 
      ? query.substring(0, MAX_QUERY_LENGTH) 
      : query;
    
    let queryEmbedding = await chromaService.getQueryEmbedding(truncatedQuery);
    let imageEmbedding: number[] | undefined;
    
    if (imageBase64) {
      try {
        // console.log('Generating image embedding...');
        imageEmbedding = await bedrockService.embedImage(imageBase64, truncatedQuery);
        // console.log('Generated image embedding');
      } catch (error) {
        // console.error('Error generating image embedding:', error);
      }
    }
    
    const batches: string[][] = [];
    for (let i = 0; i < sanitizedCollections.length; i += this.BATCH_SIZE) {
      batches.push(sanitizedCollections.slice(i, i + this.BATCH_SIZE));
    }
    // console.log('Created batches:', batches);

    let allResults: CollectionQueryResult[] = [];
    for (const batch of batches) {
      // console.log('Processing batch:', batch);
      const batchResults = await this.processBatch(batch, queryEmbedding, imageEmbedding);
      allResults = allResults.concat(batchResults);
    }

    // console.log('All results:', allResults);

    const allSources = allResults
      .flatMap(r => r.sources)
      .sort((a, b) => b.similarity - a.similarity);

    // console.log('All sources:', allSources);

    if (this.currentChatHistory) {
      this.currentChatHistory.sources = allSources;
      await this.currentChatHistory.save();
      // console.log('Saved sources to chat history');
    }

    // กรองและจัดลำดับ context ตาม similarity score
    // เลือกเฉพาะ collection ที่มี similarity score สูงกว่าเกณฑ์
    const MIN_COLLECTION_SIMILARITY = 0.4; // เกณฑ์ขั้นต่ำสำหรับ collection
    
    const contexts = allResults
      .filter(r => {
        // กรองเฉพาะ collection ที่มีข้อมูลและมี similarity score สูงกว่าเกณฑ์
        if (r.sources.length === 0) return false;
        const maxSimilarity = Math.max(...r.sources.map(s => s.similarity));
        return maxSimilarity >= MIN_COLLECTION_SIMILARITY;
      })
      .sort((a, b) => {
        // จัดลำดับตาม similarity score สูงสุดของแต่ละ collection
        const aMaxSim = Math.max(...a.sources.map(s => s.similarity));
        const bMaxSim = Math.max(...b.sources.map(s => s.similarity));
        return bMaxSim - aMaxSim;
      })
      .map(r => r.context);

    // console.log('Final context length:', contexts.join("\n\n").length);

    // จำกัดจำนวนข้อมูลที่ส่งไปยัง model เพื่อลดการใช้ token
    const MAX_CONTEXT_LENGTH = 6000; // Reduced from 8000 to avoid token limit errors
    
    // รวม context จากทุก collection ที่มี similarity score ผ่านเกณฑ์
    let context = '';
    for (const result of contexts) {
      if (result && result.length > 0) {
        // If this single result is too large, truncate it
        let resultToAdd = result;
        if (resultToAdd.length > MAX_CONTEXT_LENGTH) {
          resultToAdd = resultToAdd.substring(0, MAX_CONTEXT_LENGTH);
          // Ensure we don't cut in the middle of a word or sentence
          const lastPeriodIndex = resultToAdd.lastIndexOf('.');
          const lastNewlineIndex = resultToAdd.lastIndexOf('\n');
          const lastBreakIndex = Math.max(lastPeriodIndex, lastNewlineIndex);
          if (lastBreakIndex > MAX_CONTEXT_LENGTH * 0.8) {
            resultToAdd = resultToAdd.substring(0, lastBreakIndex + 1);
          }
        }
        
        // ตรวจสอบว่าการเพิ่ม context นี้จะทำให้เกินขนาดหรือไม่
        if (context.length + resultToAdd.length > MAX_CONTEXT_LENGTH) {
          // ถ้าเกินขนาด ให้หยุดการเพิ่ม context
          break;
        }
        context += resultToAdd + '\n';
      }
    }
    
    // Double-check final context size doesn't exceed limits
    if (context.length > MAX_CONTEXT_LENGTH) {
      context = context.substring(0, MAX_CONTEXT_LENGTH);
      // Ensure we don't cut mid-sentence
      const lastPeriodIndex = context.lastIndexOf('.');
      if (lastPeriodIndex > MAX_CONTEXT_LENGTH * 0.8) {
        context = context.substring(0, lastPeriodIndex + 1);
      }
    }
    
    // หลังจากได้ context จาก Chroma เรียบร้อยแล้ว
    // เพิ่มการค้นหาข้อมูลจากอินเทอร์เน็ต
    const searchResults = await this.searchInternet(query);
    if (searchResults) {
      context += searchResults;
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

      console.log(`Updated daily stats for ${userId}:`, {
        date: today.toISOString(),
        uniqueUsers: stats.uniqueUsers.length,
        totalChats: stats.totalChats
      });
    } catch (error) {
      console.error('Error updating daily stats:', error);
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

      const systemMessages: ChatMessage[] = [
        {
          role: 'system',
          content: isImageGeneration ? 
            'You are an expert at generating detailed image descriptions. Create vivid, detailed descriptions that can be used to generate images.' :
            this.systemPrompt
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
          content: `Context from documents:\n${context}`
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

          // Generate response and send chunks
          let totalTokens = 0;
          for await (const chunk of bedrockService.chat(augmentedMessages, isImageGeneration ? bedrockService.models.titanImage : bedrockService.chatModel)) {
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

  private async searchInternet(query: string): Promise<string> {
    try {
      // ตรวจสอบว่าคำถามต้องการข้อมูลปัจจุบันหรือไม่
      const needsRealtimeInfo = this.needsRealtimeInformation(query);
      if (!needsRealtimeInfo) {
        return '';
      }
      
      // ดึงข้อมูลจากการค้นหา
      const searchResult = await searchService.searchAndFetchContent(query);
      
      // ส่งคืนผลการค้นหาพร้อมแท็ก
      return `\n\n<SEARCH_RESULTS>\n${searchResult}\n</SEARCH_RESULTS>`;
    } catch (error) {
      console.error('Error in searchInternet:', error);
      return '';
    }
  }

  // เพิ่มฟังก์ชันตรวจสอบว่าคำถามต้องการข้อมูลปัจจุบันหรือไม่
  private needsRealtimeInformation(query: string): boolean {
    const realtimeKeywords = [
      'ล่าสุด', 'ปัจจุบัน', 'วันนี้', 'เมื่อวาน', 'สัปดาห์นี้', 'เดือนนี้', 'ปีนี้',
      'ข่าว', 'เหตุการณ์', 'ล่าสุด', 'อัปเดต', 'เมื่อเร็วๆ นี้', 'เมื่อไม่นานมานี้',
      'ตอนนี้', 'วันที่', 'เวลา', 'สด', 'หุ้น', 'ราคา', 'สถานการณ์',
      'latest', 'current', 'today', 'yesterday', 'this week', 'this month', 'this year',
      'news', 'event', 'update', 'recent', 'now', 'date', 'time', 'live', 'stock', 'price'
    ];
    
    const lowerQuery = query.toLowerCase();
    return realtimeKeywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()));
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  // console.log('Debug message');
}
