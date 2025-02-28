import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';
import { HydratedDocument } from 'mongoose';
import { ModelModel } from '../models/Model';
import { Chat } from '../models/Chat';

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

  private systemPrompt = `You are DinDin, a knowledgeable AI assistant. Follow these guidelines:
1. Be concise and direct in your responses
2. When citing information, mention the source document
3. If uncertain, acknowledge the limitations
4. For complex topics, break down explanations into steps
5. Use examples when helpful
6. If the question is unclear, ask for clarification
7. Stay within the context of provided documents
8. Maintain a professional and helpful tone

Remember: Your responses should be based on the provided context and documents.`;

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
  private readonly MIN_SIMILARITY_THRESHOLD = 0.3; // Lowered from 0.6 to match ChromaService
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

          // ลด threshold ลงเพื่อให้เก็บข้อมูลที่เกี่ยวข้องมากขึ้น
          const MIN_SIMILARITY_THRESHOLD = 0.2;

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
    let queryEmbedding = await chromaService.getQueryEmbedding(query);
    let imageEmbedding: number[] | undefined;
    
    if (imageBase64) {
      try {
        // console.log('Generating image embedding...');
        imageEmbedding = await bedrockService.embedImage(imageBase64, query);
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

    const contexts = allResults
      .filter(r => r.sources.length > 0)
      .sort((a, b) => {
        const aMaxSim = Math.max(...a.sources.map(s => s.similarity));
        const bMaxSim = Math.max(...b.sources.map(s => s.similarity));
        return bMaxSim - aMaxSim;
      })
      .map(r => r.context);

    // console.log('Final context length:', contexts.join("\n\n").length);

    // รวม context จากทุก collection ที่มี similarity score ผ่านเกณฑ์
    let context = '';
    for (const result of contexts) {
      if (result && result.length > 0) {
        context += result + '\n';
      }
    }
    
    return `${promptTemplate}\n\n${context}`;
  }

  async *generateResponse(
    messages: ChatMessage[],
    query: string,
    modelIdOrCollections: string | string[]
  ): AsyncGenerator<string> {
    try {
      // console.log("Starting generateResponse with:", modelIdOrCollections);
      
      const lastMessage = messages[messages.length - 1];
      const isImageGeneration = lastMessage.isImageGeneration;
      
      // Skip context retrieval for image generation
      let context = '';
      if (!isImageGeneration) {
        const imageBase64 = lastMessage.images?.[0]?.data;
        try {
          context = await this.retryOperation(
            async () => this.getContext(query, modelIdOrCollections, imageBase64),
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

      // Only add context if we have it and not in image generation mode
      if (context && !isImageGeneration) {
        systemMessages.push({
          role: 'system',
          content: `Context from documents:\n${context}`
        });
      }

      // Combine system messages with user messages
      const augmentedMessages = [...systemMessages, ...messages];

      let attempt = 0;
      while (attempt < this.retryConfig.maxRetries) {
        try {
          for await (const chunk of bedrockService.chat(augmentedMessages, isImageGeneration ? bedrockService.models.titanImage : bedrockService.chatModel)) {
            yield chunk;
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
      console.error("Error in generateResponse:", error);
      yield "\nI apologize, but I encountered an error while generating the response. Please try again or contact support if the issue persists.";
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

  async getChats(userId: string, page: number = 1, limit: number = 3) {
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
      chatname,  // เพิ่ม chatname
      name,
      messages: processedMessages
    });

    await chat.save();
    return chat;
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
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  // console.log('Debug message');
}
