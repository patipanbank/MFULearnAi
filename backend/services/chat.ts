import { bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { ChatMessage } from '../types/chat';
import { ChatHistory } from '../models/ChatHistory';
import { HydratedDocument } from 'mongoose';
import { CollectionModel } from '../models/Collection';
import { ModelModel } from '../models/Model';

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

export class ChatService {
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
        console.log('Collections provided directly:', modelIdOrCollections);
        return modelIdOrCollections;
      }

      console.log('Looking up model by ID:', modelIdOrCollections);
      const model = await ModelModel.findById(modelIdOrCollections);
      if (!model) {
        console.error('Model not found:', modelIdOrCollections);
        return [];
      }

      console.log('Found model:', {
        id: model._id,
        name: model.name,
        collections: model.collections
      });
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
            5
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

          // Calculate dynamic threshold based on result distribution
          const similarities = results.map(r => r.similarity);
          const mean = similarities.reduce((a, b) => a + b, 0) / similarities.length;
          const stdDev = Math.sqrt(
            similarities.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / similarities.length
          );
          const dynamicThreshold = Math.max(
            this.MIN_SIMILARITY_THRESHOLD,
            mean - stdDev
          );

          const filteredResults = results
            .filter(result => result.similarity >= dynamicThreshold)
            .sort((a, b) => b.similarity - a.similarity);

          const sources = filteredResults.map(result => ({
            modelId: result.metadata.modelId,
            collectionName: name,
            filename: result.metadata.filename,
            similarity: result.similarity
          }));

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
    console.log('Getting context for:', {
      query,
      modelIdOrCollections,
      hasImage: !!imageBase64
    });

    const questionType = this.detectQuestionType(query);
    const promptTemplate = this.promptTemplates[questionType];
    
    const collectionNames = await this.resolveCollections(modelIdOrCollections);
    if (collectionNames.length === 0) {
      console.error('No collections found for:', modelIdOrCollections);
      return '';
    }

    console.log('Resolved collection names:', collectionNames);
    console.log('Detected question type:', questionType);

    const sanitizedCollections = collectionNames.map(name => 
      this.sanitizeCollectionName(name)
    );
    console.log('Sanitized collection names:', sanitizedCollections);

    console.log('Getting query embedding...');
    let queryEmbedding = await chromaService.getQueryEmbedding(query);
    let imageEmbedding: number[] | undefined;
    
    if (imageBase64) {
      try {
        console.log('Generating image embedding...');
        imageEmbedding = await bedrockService.embedImage(imageBase64, query);
        console.log('Generated image embedding');
      } catch (error) {
        console.error('Error generating image embedding:', error);
      }
    }
    
    const batches: string[][] = [];
    for (let i = 0; i < sanitizedCollections.length; i += this.BATCH_SIZE) {
      batches.push(sanitizedCollections.slice(i, i + this.BATCH_SIZE));
    }
    console.log('Created batches:', batches);

    let allResults: CollectionQueryResult[] = [];
    for (const batch of batches) {
      console.log('Processing batch:', batch);
      const batchResults = await this.processBatch(batch, queryEmbedding, imageEmbedding);
      allResults = allResults.concat(batchResults);
    }

    console.log('All results:', allResults);

    const allSources = allResults
      .flatMap(r => r.sources)
      .sort((a, b) => b.similarity - a.similarity);

    console.log('All sources:', allSources);

    if (this.currentChatHistory) {
      this.currentChatHistory.sources = allSources;
      await this.currentChatHistory.save();
      console.log('Saved sources to chat history');
    }

    const contexts = allResults
      .filter(r => r.sources.length > 0)
      .sort((a, b) => {
        const aMaxSim = Math.max(...a.sources.map(s => s.similarity));
        const bMaxSim = Math.max(...b.sources.map(s => s.similarity));
        return bMaxSim - aMaxSim;
      })
      .map(r => r.context);

    console.log('Final context length:', contexts.join("\n\n").length);
    return `${promptTemplate}\n\n${contexts.join("\n\n")}`;
  }

  async *generateResponse(
    messages: ChatMessage[],
    query: string,
    modelIdOrCollections: string | string[]
  ): AsyncGenerator<string> {
    try {
      console.log("Starting generateResponse with:", modelIdOrCollections);
      
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
      
      console.log('Retrieved context length:', context.length);

      const questionType = isImageGeneration ? 'imageGeneration' : this.detectQuestionType(query);
      console.log('Question type:', questionType);

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

      let retryCount = 0;
      while (retryCount < this.retryConfig.maxRetries) {
        try {
          for await (const chunk of bedrockService.chat(augmentedMessages, isImageGeneration ? bedrockService.models.titanImage : bedrockService.chatModel)) {
            yield chunk;
          }
          return;
        } catch (error) {
          console.error(`Error in chat generation (Attempt ${retryCount + 1}/${this.retryConfig.maxRetries}):`, error);
          retryCount++;
          
          if (retryCount < this.retryConfig.maxRetries) {
            const delay = Math.min(
              this.retryConfig.baseDelay * Math.pow(2, retryCount),
              this.retryConfig.maxDelay
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            yield "\n[Retrying due to error...]\n";
          } else {
            throw error;
          }
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
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  console.log('Debug message');
}
