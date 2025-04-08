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
   * Generate an optimized context query based on intent and topic classification
   */
  private getContextQueryByIntentAndTopic(
    message: string, 
    intentName: string, 
    topicName: string,
    intentConfidence: number,
    topicConfidence: number,
    entities?: {[key: string]: any}
  ): string {
    // For low confidence intents/topics or no recognized intent, use the original message
    if ((intentConfidence < 0.5 && topicConfidence < 0.5) || 
        (!intentName && !topicName) || 
        (intentName === 'other' && topicName === 'other')) {
      return message;
    }
    
    // Extract key entities for query enhancement
    const entityValues = entities ? Object.values(entities).join(' ') : '';
    
    // Combine intent and topic for better query
    // Use the higher confidence one as primary focus
    const isPrimaryIntent = intentConfidence >= topicConfidence;
    
    // Build specialized queries based on intent-topic combinations
    if (isPrimaryIntent) {
      // Intent-focused queries with topic enrichment
      switch (intentName) {
        case 'course_inquiry':
          return `${topicName} course information ${entityValues} ${message}`.trim();
          
        case 'enrollment_inquiry':
          return `${topicName} enrollment registration process ${entityValues} ${message}`.trim();
          
        case 'schedule_inquiry':
          return `${topicName} schedule timetable ${entityValues} ${message}`.trim();
          
        case 'facility_inquiry':
          return `${topicName} campus facilities locations ${entityValues} ${message}`.trim();
          
        case 'academic_help':
          return `${topicName} academic information ${entityValues} ${message}`.trim();
          
        case 'technical_help':
          return `${topicName} technical support ${entityValues} ${message}`.trim();
          
        default:
          // For other intents, combine with topic
          return `${intentName} ${topicName} ${entityValues} ${message}`.trim();
      }
    } else {
      // Topic-focused queries with intent enrichment
      switch (topicName) {
        case 'admission':
          return `university admission ${intentName} ${entityValues} ${message}`.trim();
          
        case 'tuition':
          return `tuition fees financial ${intentName} ${entityValues} ${message}`.trim();
          
        case 'academic_programs':
          return `academic programs majors ${intentName} ${entityValues} ${message}`.trim();
          
        case 'courses':
          return `course details ${intentName} ${entityValues} ${message}`.trim();
          
        case 'examinations':
          return `exams assessment ${intentName} ${entityValues} ${message}`.trim();
          
        case 'registration':
          return `course registration ${intentName} ${entityValues} ${message}`.trim();
          
        case 'academic_calendar':
          return `academic calendar schedule ${intentName} ${entityValues} ${message}`.trim();
          
        case 'campus_facilities':
          return `campus facilities ${intentName} ${entityValues} ${message}`.trim();
          
        case 'student_services':
          return `student services ${intentName} ${entityValues} ${message}`.trim();
          
        case 'housing':
          return `student housing dormitory ${intentName} ${entityValues} ${message}`.trim();
          
        case 'technology':
          return `university technology systems ${intentName} ${entityValues} ${message}`.trim();
          
        case 'extracurricular':
          return `student activities clubs ${intentName} ${entityValues} ${message}`.trim();
          
        case 'international':
          return `international students exchange ${intentName} ${entityValues} ${message}`.trim();
          
        case 'research':
          return `research opportunities ${intentName} ${entityValues} ${message}`.trim();
          
        case 'faculty':
          return `university faculty professors ${intentName} ${entityValues} ${message}`.trim();
          
        case 'graduation':
          return `graduation requirements ${intentName} ${entityValues} ${message}`.trim();
          
        default:
          // For other topics, combine with intent
          return `${topicName} ${intentName} ${entityValues} ${message}`.trim();
      }
    }
  }

  private async getContext(
    query: string, 
    modelIdOrCollections: string | string[], 
    imageBase64?: string,
    intentName?: string,
    intentConfidence?: number,
    topicName?: string,
    topicConfidence?: number,
    entities?: {[key: string]: any}
  ): Promise<string> {
    // Use intent name to select prompt template, defaulting to 'general' if not found
    const promptTemplate = intentName && this.promptTemplates[intentName as keyof typeof this.promptTemplates] 
      ? this.promptTemplates[intentName as keyof typeof this.promptTemplates]
      : this.promptTemplates['general'];
    
    // Use intent and topic for query optimization
    const optimizedQuery = (intentName && intentConfidence) || (topicName && topicConfidence)
      ? this.getContextQueryByIntentAndTopic(
          query, 
          intentName || '', 
          topicName || '', 
          intentConfidence || 0, 
          topicConfidence || 0, 
          entities
        )
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

  /**
   * Generate response using tool calling to classify and respond in a single API call
   * This reduces API calls and provides more consistent responses
   */
  async *generateResponse(
    messages: ChatMessage[],
    query: string,
    modelIdOrCollections: string | string[],
    userId: string
  ): AsyncGenerator<string> {
    try {
      console.log("Starting unified response generation with tool calling");
      
      const lastMessage = messages[messages.length - 1];
      
      // ถ้าเป็นการสร้างภาพให้ใช้วิธีเดิมเพราะต้องใช้ image generation model
      if (lastMessage.isImageGeneration || (lastMessage.content && lastMessage.content.toLowerCase().includes("create image") || lastMessage.content.toLowerCase().includes("generate image"))) {
        console.log("Detected image generation request, using standard image generation");
        lastMessage.isImageGeneration = true;
        
        // Process the message to capture intent and metadata
        try {
          const processedMessage = await this.processMessage(lastMessage);
          messages[messages.length - 1] = processedMessage;
        } catch (error) {
          console.error('Error in intent classification for image generation:', error);
        }
        
        // Use the image generation specific logic
        const systemPrompt = 'You are an expert at generating detailed image descriptions. Create vivid, detailed descriptions that can be used to generate images.';
        const systemMessages: ChatMessage[] = [
          {
            role: 'system',
            content: systemPrompt
          }
        ];
        
        // If there are older messages, add their summary
        if (messages.length > 1) {
          const olderMessages = messages.slice(0, -1);
          systemMessages.push({
            role: 'system',
            content: this.summarizeOldMessages(olderMessages)
          });
        }
        
        // Combine system messages with the latest user message
        const augmentedMessages = [...systemMessages, lastMessage];
        
        // Update stats
        await this.updateDailyStats(userId);
        
        // Generate image description using the specialized model
        const selectedModel = bedrockService.models.titanImage;
        
        for await (const chunk of bedrockService.chat(augmentedMessages, selectedModel)) {
          if (typeof chunk === 'string') {
            yield chunk;
          }
        }
        
        // Update token usage
        const totalTokens = bedrockService.getLastTokenUsage();
        if (totalTokens > 0) {
          const usage = await usageService.updateTokenUsage(userId, totalTokens);
          console.log(`[Chat] Token usage updated for ${userId}:`, {
            used: totalTokens,
            daily: usage.dailyTokens,
            remaining: usage.remainingTokens
          });
          
          // Update token stats
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
      }

      // ดึง system prompt จากฐานข้อมูล
      const systemPrompt = await this.getSystemPrompt();

      // ตรวจสอบว่ามีข้อความประวัติ (history) หรือไม่
      let contextualSystemPrompt = systemPrompt;
        
      // ถ้ามีข้อความประวัติหลายข้อความ สร้าง context เพิ่มเติม
      if (messages.length > 1) {
        // สร้างสรุปประวัติการสนทนา
        const messageHistory = messages.slice(0, -1); // ทุกข้อความยกเว้นข้อความล่าสุด
        const conversationSummary = this.summarizeOldMessages(messageHistory);
        contextualSystemPrompt += `\n\n${conversationSummary}`;
      }
        
      // ใช้ tool calling เพื่อวิเคราะห์และสร้างคำตอบในคราวเดียว
      const result = await this.retryOperation(
        async () => intentClassifierService.classifyAndRespond(query, contextualSystemPrompt, 0.7),
        'Failed to classify and respond with tool calling'
      );
      
      // บันทึกข้อมูลการวิเคราะห์ลงใน metadata ของข้อความล่าสุด
      lastMessage.metadata = lastMessage.metadata || {};
      lastMessage.metadata.primaryIntent = result.intent;
      lastMessage.metadata.intentConfidence = result.intentConfidence;
      lastMessage.metadata.primaryTopic = result.topic;
      lastMessage.metadata.topicConfidence = result.topicConfidence;
      
      // บันทึกข้อมูลการวิเคราะห์ลงใน sources ของข้อความล่าสุด
      lastMessage.sources = lastMessage.sources || [];
      lastMessage.sources.push({
        modelId: 'intent-classifier',
        collectionName: 'intents',
        filename: 'tool-calling-analysis',
        similarity: result.intentConfidence,
        metadata: {
          intent: result.intent,
          intentConfidence: result.intentConfidence,
          topic: result.topic,
          topicConfidence: result.topicConfidence,
          entities: result.entities
        }
      });
      
      if (result.entities) {
        lastMessage.metadata.entities = result.entities;
      }
      
      // อัพเดทสถิติพร้อมจำนวนข้อความ
      await this.updateDailyStats(userId);
      
      // อัพเดท token usage ด้วยค่าประมาณ
      // หมายเหตุ: เป็นการประมาณเนื่องจากเราไม่ได้รับค่า token usage จริงจาก Claude ผ่าน tool calling
      const estimatedTokens = Math.ceil(query.length / 4) + Math.ceil(result.response.length / 4);
      
      try {
        const usage = await usageService.updateTokenUsage(userId, estimatedTokens);
        
        console.log(`[Chat] Token usage updated for ${userId}:`, {
          used: estimatedTokens,
          daily: usage.dailyTokens,
          remaining: usage.remainingTokens
        });
        
        // อัปเดตข้อมูล token ในสถิติรายวัน
        const today = new Date();
        today.setHours(today.getHours() + 7); // แปลงเป็นเวลาไทย
        today.setHours(0, 0, 0, 0); // รีเซ็ตเวลาเป็นต้นวัน

        await ChatStats.findOneAndUpdate(
          { date: today },
          { $inc: { totalTokens: estimatedTokens } },
          { upsert: true }
        );
      } catch (error) {
        console.error('Error updating token usage:', error);
      }
      
      // ส่งคำตอบกลับทั้งหมดในครั้งเดียว หรือแบ่งเป็น chunks
      // เพื่อความเข้ากันได้กับ UI ปัจจุบัน เราจะกระจายคำตอบเป็น chunks
      const chunkSize = 10; // จำนวนตัวอักษรต่อ chunk
      const text = result.response;
      
      // ทางเลือก 1: ส่งคำตอบทั้งหมดในครั้งเดียว (เร็วที่สุด)
      // yield text;
      
      // ทางเลือก 2: ส่งคำตอบแบบแบ่ง chunks (เพื่อให้ UI แสดงผลเหมือนกำลังพิมพ์)
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        yield chunk;
        
        // หน่วงเวลาเล็กน้อยเพื่อให้ดูเหมือนกำลังพิมพ์
        if (i + chunkSize < text.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
    } catch (error) {
      console.error('Error in unified response generation:', error);
      yield "I apologize, but I encountered an error processing your message. Could you please try again?";
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

  /**
   * Generate response using tool calling to classify and respond in a single API call
   * This reduces API calls and provides more consistent responses
   */
  async *generateResponseWithToolCalling(
    messages: ChatMessage[],
    query: string,
    modelIdOrCollections: string | string[],
    userId: string
  ): AsyncGenerator<string> {
    // Use the main implementation to avoid duplication
    for await (const chunk of this.generateResponse(messages, query, modelIdOrCollections, userId)) {
      yield chunk;
    }
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
      // Classify the intent and topic of the user message
      const classification = await intentClassifierService.classifyMessageWithTopics(message.content);
      const intents = classification.intents;
      const topics = classification.topics;
      
      // Log the classification results
      console.log('Intent classification results:', JSON.stringify(intents, null, 2));
      console.log('Topic classification results:', JSON.stringify(topics, null, 2));
      console.log('Primary intent:', intents[0].name, 'with confidence:', intents[0].confidence);
      console.log('Primary topic:', topics[0].name, 'with confidence:', topics[0].confidence);
      
      if (intents[0].entities) {
        console.log('Extracted entities:', JSON.stringify(intents[0].entities, null, 2));
      }
      
      // Initialize message metadata if not exists
      message.metadata = message.metadata || {};
      
      // Add intent information
      message.metadata.intents = intents;
      message.metadata.primaryIntent = intents[0].name;
      message.metadata.intentConfidence = intents[0].confidence;
      
      // Add topic information
      message.metadata.topics = topics;
      message.metadata.primaryTopic = topics[0].name;
      message.metadata.topicConfidence = topics[0].confidence;
      
      // Add the classification to the message sources
      message.sources = message.sources || [];
      message.sources.push({
        modelId: 'intent-classifier',
        collectionName: 'intents',
        filename: 'intent-topic-analysis',
        similarity: intents[0].confidence,
        metadata: {
          intents,
          primaryIntent: intents[0].name,
          topics,
          primaryTopic: topics[0].name
        }
      });
      
      // Perform specialized handling based on the top intent
      const topIntent = intents[0];
      const topTopic = topics[0];
      const highIntentConfidence = topIntent.confidence > 0.7;
      const highTopicConfidence = topTopic.confidence > 0.7;
      
      // Add intent-specific flags to message metadata
      if (highIntentConfidence) {
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
      
      // Add topic-specific metadata
      if (highTopicConfidence) {
        message.metadata.topicArea = topTopic.name;
        
        switch (topTopic.name) {
          case "admission":
            message.metadata.isAboutAdmission = true;
            break;
            
          case "tuition":
            message.metadata.isAboutTuition = true;
            break;
            
          case "academic_programs":
            message.metadata.isAboutPrograms = true;
            break;
            
          case "courses":
            message.metadata.isAboutCourses = true;
            break;
            
          case "examinations":
            message.metadata.isAboutExams = true;
            break;
            
          case "registration":
            message.metadata.isAboutRegistration = true;
            break;
            
          case "academic_calendar":
            message.metadata.isAboutCalendar = true;
            break;
            
          case "campus_facilities":
            message.metadata.isAboutFacilities = true;
            break;
            
          case "student_services":
            message.metadata.isAboutServices = true;
            break;
            
          case "housing":
            message.metadata.isAboutHousing = true;
            break;
            
          case "technology":
            message.metadata.isAboutTechnology = true;
            break;
        }
        
        console.log(`Topic area detected: ${topTopic.name} with confidence ${topTopic.confidence}`);
      }
      
      // Store intent entities if available
      if (topIntent.entities && Object.keys(topIntent.entities).length > 0) {
        message.metadata.entities = topIntent.entities;
      }
      
      return message;
    } catch (error) {
      console.error("Error processing message intent and topic:", error);
      // Fallback to basic intent classification if combined classification fails
      try {
        const intents = await intentClassifierService.classifyIntent(message.content);
        
        message.metadata = message.metadata || {};
        message.metadata.intents = intents;
        message.metadata.primaryIntent = intents[0].name;
        message.metadata.intentConfidence = intents[0].confidence;
        
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
        
        if (intents[0].name === "image_generation" && intents[0].confidence > 0.7) {
          message.isImageGeneration = true;
        }
      } catch (fallbackError) {
        console.error("Fallback intent classification also failed:", fallbackError);
      }
      
      return message;
    }
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  // console.log('Debug message');
}

