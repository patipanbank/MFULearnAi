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
import { intentClassifierService } from './intentClassifier';

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
    'general': 'Provide a direct and accurate answer based on the following context:',
    'educational': 'Explain the concept thoroughly using the following context:',
    'academic_help': 'Provide a clear educational explanation using the following context:',
    'technical_help': 'Provide technical assistance based on:',
    'course_inquiry': 'Provide course information based on:',
    'enrollment_inquiry': 'Provide enrollment information based on:',
    'schedule_inquiry': 'Provide schedule information based on:',
    'facility_inquiry': 'Provide facility information based on:',
    'image_analysis': 'Analyze the image using the following context:',
    'feedback': 'Address the feedback using the following information:',
    'location': 'Provide location information based on:',
    'schedule': 'Provide schedule details based on:',
    'financial': 'Provide financial information based on:'
  };

  private chatModel = bedrockService.chatModel;
  private currentChatHistory?: HydratedDocument<IChatHistory>;
  private readonly BATCH_SIZE = 3; // Number of collections to query simultaneously
  private readonly MIN_SIMILARITY_THRESHOLD = 0.1;
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

  /**
   * Generate an optimized context query based on intent classification
   */
  private getContextQueryByIntent(message: string, intentName: string, intentConfidence: number, entities?: {[key: string]: any}): string {
    // For low confidence intents or no recognized intent, use the original message
    if (intentConfidence < 0.5 || !intentName || intentName === 'other') {
      return message;
    }
    
    // Extract key entities for query enhancement
    const entityValues = entities ? Object.values(entities).join(' ') : '';
    
    // Build intent-specific queries
    switch (intentName) {
      case 'course_inquiry':
        return `course information ${entityValues} ${message}`.trim();
        
      case 'enrollment_inquiry':
        return `enrollment registration process ${entityValues} ${message}`.trim();
        
      case 'schedule_inquiry':
        return `class schedule timetable ${entityValues} ${message}`.trim();
        
      case 'facility_inquiry':
        return `campus facilities locations ${entityValues} ${message}`.trim();
        
      case 'academic_help':
        return `academic information ${entityValues} ${message}`.trim();
        
      case 'technical_help':
        return `technical support ${entityValues} ${message}`.trim();
        
      default:
        // For other intents, use the original message with entity enhancement
        return entityValues ? `${message} ${entityValues}` : message;
    }
  }

  private async getContext(
    query: string, 
    modelIdOrCollections: string | string[], 
    imageBase64?: string,
    intentName?: string,
    intentConfidence?: number,
    entities?: {[key: string]: any}
  ): Promise<string> {
    // Use intent name to select prompt template, defaulting to 'general' if not found
    const promptTemplate = intentName && this.promptTemplates[intentName as keyof typeof this.promptTemplates] 
      ? this.promptTemplates[intentName as keyof typeof this.promptTemplates]
      : this.promptTemplates['general'];
    
    // Use intent-based query optimization if intent information is available
    const optimizedQuery = intentName && intentConfidence 
      ? this.getContextQueryByIntent(query, intentName, intentConfidence, entities)
      : query;
      
    if (optimizedQuery !== query) {
      console.log(`Using optimized query for context retrieval: "${optimizedQuery}"`);
    }
    
    const collectionNames = await this.resolveCollections(modelIdOrCollections);
    let context = '';

    // ดึงข้อมูลจาก collections ก่อน
    if (collectionNames.length > 0) {
      const sanitizedCollections = collectionNames.map(name => 
        this.sanitizeCollectionName(name)
      );

      const truncatedQuery = optimizedQuery.slice(0, 512);
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
      let detectedIntent = 'general';
      let intentConfidence = 0;
      let intentEntities: {[key: string]: any} = {};
      
      // Apply intent classification to the last message
      try {
        const processedMessage = await this.processMessage(lastMessage);
        // Replace the last message with the processed one that includes intent information
        messages[messages.length - 1] = processedMessage;
        
        // Extract intent information for specialized handling
        if (processedMessage.sources && processedMessage.sources.length > 0) {
          const intentSource = processedMessage.sources.find(source => 
            source.modelId === 'intent-classifier' && source.metadata?.primaryIntent
          );
          
          if (intentSource) {
            detectedIntent = intentSource.metadata.primaryIntent;
            intentConfidence = intentSource.similarity || 0;
            
            // Extract entities if available
            if (intentSource.metadata?.intents?.[0]?.entities) {
              intentEntities = intentSource.metadata.intents[0].entities;
            }
            
            console.log(`Intent information extracted: ${detectedIntent} (${intentConfidence})`);
            console.log('Intent entities:', JSON.stringify(intentEntities, null, 2));
          }
        }
        
        // If the message was classified as an image generation request with high confidence,
        // update the isImageGeneration flag
        if (processedMessage.isImageGeneration) {
          lastMessage.isImageGeneration = true;
        }
      } catch (error) {
        console.error('Error in intent classification:', error);
        // Continue with original message if there's an error in intent classification
      }
      
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
      
      // Skip context retrieval for image generation or when not needed based on intent
      let context = '';
      const skipContextIntents = ['greeting', 'farewell', 'gratitude', 'image_generation'];
      const shouldSkipContext = isImageGeneration || 
        (skipContextIntents.includes(detectedIntent) && intentConfidence > 0.7);
      
      if (!shouldSkipContext) {
        const imageBase64 = lastMessage.images?.[0]?.data;
        try {
          // Ensure query doesn't exceed reasonable length
          const MAX_QUERY_FOR_CONTEXT = 4000;
          const trimmedQuery = query.length > MAX_QUERY_FOR_CONTEXT 
            ? query.substring(0, MAX_QUERY_FOR_CONTEXT) 
            : query;
            
          context = await this.retryOperation(
            async () => this.getContext(trimmedQuery, modelIdOrCollections, imageBase64, detectedIntent, intentConfidence, intentEntities),
            'Failed to get context'
          );
        } catch (error) {
          console.error('Error getting context:', error);
          // Continue without context if there's an error
        }
      } else {
        console.log(`Skipping context retrieval for intent: ${detectedIntent}`);
      }
      
      // Use intent information to determine model selection
      let selectedModel = isImageGeneration ? bedrockService.models.titanImage : bedrockService.chatModel;
      
      console.log('Using intent for response generation:', detectedIntent, 'with confidence:', intentConfidence);

      // ดึง system prompt จากฐานข้อมูล
      const dynamicSystemPrompt = await this.getSystemPrompt();

      // Customize system prompt based on intent when confidence is high
      let systemPrompt = isImageGeneration ? 
        'You are an expert at generating detailed image descriptions. Create vivid, detailed descriptions that can be used to generate images.' :
        dynamicSystemPrompt;
        
      // Enhance system prompt with intent information when confidence is high
      if (intentConfidence > 0.7) {
        systemPrompt += `\n\nI've detected that the user's message has the intent: ${detectedIntent}`;
        
        if (Object.keys(intentEntities).length > 0) {
          systemPrompt += ` with these specific entities: ${JSON.stringify(intentEntities)}`;
        }
        
        // Add specific instructions based on intent
        switch (detectedIntent) {
          case 'greeting':
            systemPrompt += '\nRespond with a warm, friendly greeting appropriate for a university assistant.';
            break;
          case 'academic_help':
            systemPrompt += '\nProvide clear, educational responses that help the student understand academic concepts.';
            break;
          case 'technical_help':
            systemPrompt += '\nOffer precise technical guidance to resolve the user\'s issue.';
            break;
          case 'course_inquiry':
            systemPrompt += '\nProvide detailed information about courses, requirements, and educational programs.';
            break;
          // Add more customizations for other intents
        }
      }

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
      if (context && !shouldSkipContext) {
        systemMessages.push({
          role: 'system',
          content: `Context from documents:\n${context}`
        });
      }

      // Combine system messages with recent user messages only
      const augmentedMessages = [...systemMessages, ...recentMessages];

      // Ensure the last message has proper intent metadata set
      if (augmentedMessages.length > 0) {
        const lastAugmentedMessage = augmentedMessages[augmentedMessages.length - 1];
        if (lastAugmentedMessage.role === 'user') {
          lastAugmentedMessage.metadata = lastAugmentedMessage.metadata || {};
          
          // Set intent information for model configuration
          if (detectedIntent && intentConfidence > 0) {
            lastAugmentedMessage.metadata.primaryIntent = detectedIntent;
            lastAugmentedMessage.metadata.intentConfidence = intentConfidence;
            
            if (Object.keys(intentEntities).length > 0) {
              lastAugmentedMessage.metadata.entities = intentEntities;
            }
          }
        }
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

          // Generate response and send chunks
          let totalTokens = 0;
          for await (const chunk of bedrockService.chat(augmentedMessages, selectedModel)) {
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

  /**
   * Process a user message to classify intent and perform specialized handling
   */
  async processMessage(message: ChatMessage): Promise<ChatMessage> {
    try {
      // Classify the intent of the user message
      const intents = await intentClassifierService.classifyIntent(message.content);
      
      // Log the intent classification results
      console.log('Intent classification results:', JSON.stringify(intents, null, 2));
      console.log('Primary intent:', intents[0].name, 'with confidence:', intents[0].confidence);
      if (intents[0].entities) {
        console.log('Extracted entities:', JSON.stringify(intents[0].entities, null, 2));
      }
      
      // Initialize message metadata if not exists
      message.metadata = message.metadata || {};
      message.metadata.intents = intents;
      message.metadata.primaryIntent = intents[0].name;
      message.metadata.intentConfidence = intents[0].confidence;
      
      // Add the intent classification to the message metadata or sources
      message.sources = message.sources || [];
      message.sources.push({
        modelId: 'intent-classifier',
        collectionName: 'intents',
        filename: 'intent-analysis',
        similarity: intents[0].confidence,
        metadata: {
          intents,
          primaryIntent: intents[0].name
        }
      });
      
      // Perform specialized handling based on the top intent
      const topIntent = intents[0];
      const highConfidence = topIntent.confidence > 0.7;
      
      // Add intent-specific flags to message metadata
      if (highConfidence) {
        switch (topIntent.name) {
          case "image_generation":
            message.isImageGeneration = true;
            message.metadata.requiresImageGeneration = true;
            console.log('Image generation request detected with high confidence');
            break;
            
          case "image_analysis":
            message.metadata.requiresImageAnalysis = true;
            console.log('Image analysis request detected with high confidence');
            break;
            
          case "greeting":
            message.metadata.isGreeting = true;
            console.log('Greeting detected with high confidence');
            break;
            
          case "farewell":
            message.metadata.isFarewell = true;
            console.log('Farewell detected with high confidence');
            break;
            
          case "gratitude":
            message.metadata.isGratitude = true;
            console.log('Gratitude detected with high confidence');
            break;
            
          case "academic_help":
            message.metadata.isAcademicHelp = true;
            console.log('Academic help request detected with high confidence');
            break;
            
          case "technical_help":
            message.metadata.isTechnicalHelp = true;
            console.log('Technical help request detected with high confidence');
            break;
            
          case "course_inquiry":
          case "enrollment_inquiry":
          case "schedule_inquiry":
            message.metadata.isEducationalInquiry = true;
            console.log('Educational inquiry detected with high confidence');
            break;
            
          case "facility_inquiry":
            message.metadata.isFacilityInquiry = true;
            console.log('Facility inquiry detected with high confidence');
            break;
            
          case "feedback":
            message.metadata.isFeedback = true;
            console.log('Feedback detected with high confidence');
            break;
        }
      }
      
      // Store intent entities if available
      if (topIntent.entities && Object.keys(topIntent.entities).length > 0) {
        message.metadata.entities = topIntent.entities;
      }
      
      return message;
    } catch (error) {
      console.error("Error processing message intent:", error);
      return message;
    }
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  // console.log('Debug message');
}

