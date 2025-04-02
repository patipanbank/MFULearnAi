import { chromaService } from './chroma';
import { webSearchService } from './webSearch';
import { bedrockService } from './bedrock'; // Needed for image embedding
import { ModelModel } from '../models/Model'; // Needed for resolving collections by model ID
import { chatConfig, getPromptTemplate } from '../config/chatConfig'; // Import config

// --- Interfaces (copied/adapted from original chatService) ---

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
  sources: Source[]; // Use Source type
}

// Define a clear Source type
export interface Source {
  modelId: string;
  collectionName: string;
  filename: string;
  similarity: number;
}

// Result type for getContext
export interface ContextResult {
  contextString: string;
  sources: Source[];
  promptTemplate: string;
}

// --- RAG Service Class ---

class RAGService {

  /**
   * Sanitizes a collection name for ChromaDB compatibility.
   */
  private sanitizeCollectionName(name: string): string {
    return name.replace(/:/g, '-');
  }

  /**
   * Gets collection names for a model ID or returns the names if directly provided.
   */
  private async resolveCollections(modelIdOrCollections: string | string[]): Promise<string[]> {
    try {
      if (Array.isArray(modelIdOrCollections)) {
        return modelIdOrCollections;
      }

      const model = await ModelModel.findById(modelIdOrCollections).select('collections').lean();
      if (!model || !Array.isArray(model.collections)) {
        console.warn('Model not found or collections missing for:', modelIdOrCollections);
        return [];
      }
      return model.collections.map(String); // Ensure strings
    } catch (error) {
      console.error('Error resolving collections:', error);
      return [];
    }
  }

  /**
   * Processes a batch of collections, querying ChromaDB for each.
   */
  private async processBatch(
    batch: string[],
    queryEmbedding: number[],
    imageEmbedding?: number[]
  ): Promise<CollectionQueryResult[]> {
    return Promise.all(
      batch.map(async (name): Promise<CollectionQueryResult> => {
        try {
          // Use image embedding if available, otherwise query embedding
          const embeddingToUse = imageEmbedding || queryEmbedding;
          const queryResult = await chromaService.queryDocumentsWithEmbedding(
            name,
            embeddingToUse,
            4 // Number of results per collection
          ) as ChromaQueryResult;

          if (!queryResult?.documents || !queryResult?.metadatas) {
            return { context: '', sources: [] };
          }

          const results = queryResult.documents
            .map((doc: string, index: number): QueryResult => ({
              text: doc,
              metadata: queryResult.metadatas[index],
              // Ensure distance exists before calculating similarity
              similarity: queryResult.distances ? (1 - (queryResult.distances[index] || 0)) : 0
            }));

          const filteredResults = results
            .filter(result => result.similarity >= chatConfig.MIN_SIMILARITY_THRESHOLD)
            .sort((a, b) => b.similarity - a.similarity);

          const sources: Source[] = filteredResults.map(result => ({
            modelId: result.metadata.modelId,
            collectionName: name,
            filename: result.metadata.filename,
            similarity: result.similarity,
          }));

          return {
            context: filteredResults.map(r => r.text).join("\n\n"), // Combine text of filtered results
            sources
          };
        } catch (error) {
          console.error(`Error querying collection ${name}:`, error);
          return { context: '', sources: [] }; // Return empty on error
        }
      })
    );
  }

  /**
   * Creates batches from a list of collection names.
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Detects the type of question based on keywords (simple version).
   */
  private detectQuestionType(query: string): string {
    const lowerQuery = query.toLowerCase();
    const patterns: { [key: string]: RegExp } = {
      [chatConfig.QUESTION_TYPES.FACTUAL]: /^(what|when|where|who|which|how many|how much)/i,
      [chatConfig.QUESTION_TYPES.ANALYTICAL]: /^(why|how|what if|what are the implications|analyze|compare|contrast)/i,
      [chatConfig.QUESTION_TYPES.CONCEPTUAL]: /^(explain|describe|define|what is|what are|how does)/i,
      [chatConfig.QUESTION_TYPES.PROCEDURAL]: /^(how to|how do|what steps|how can|show me how)/i,
      [chatConfig.QUESTION_TYPES.CLARIFICATION]: /^(can you clarify|what do you mean|please explain|could you elaborate)/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(lowerQuery)) {
        return type;
      }
    }
    return chatConfig.QUESTION_TYPES.FACTUAL; // Default
  }

  /**
   * Retrieves relevant context from ChromaDB collections and potentially web search.
   */
  async getContext(query: string, modelIdOrCollections: string | string[], imageBase64?: string): Promise<ContextResult> {
    const questionType = this.detectQuestionType(query);
    const promptTemplate = getPromptTemplate(questionType); // Use helper from config
    
    const collectionNames = await this.resolveCollections(modelIdOrCollections);
    let sources: Source[] = [];
    let context = '';

    // 1. Retrieve context from ChromaDB collections
    if (collectionNames.length > 0) {
      const sanitizedCollections = collectionNames.map(this.sanitizeCollectionName);
      
      // Truncate query for embedding models if necessary
      const truncatedQuery = query.slice(0, 512);
      let queryEmbedding: number[] | null = null;
      let imageEmbedding: number[] | undefined;

      try {
        queryEmbedding = await chromaService.getQueryEmbedding(truncatedQuery);
      } catch(embedError) {
          console.error("Failed to get query embedding:", embedError);
          // Decide how to proceed - maybe skip RAG or rely only on image?
      }
      
      if (imageBase64 && queryEmbedding) { // Need query embedding even for image context sometimes
        try {
          imageEmbedding = await bedrockService.embedImage(imageBase64, truncatedQuery);
        } catch (error) {
          console.error('Error generating image embedding:', error);
        }
      }

      if (queryEmbedding || imageEmbedding) { // Only proceed if we have at least one embedding
          const batches = this.createBatches(sanitizedCollections, chatConfig.BATCH_SIZE);
          let allResults: CollectionQueryResult[] = [];
          for (const batch of batches) {
            // Pass queryEmbedding even if null, processBatch handles it
            const batchResults = await this.processBatch(batch, queryEmbedding || [], imageEmbedding);
            allResults = allResults.concat(batchResults);
          }
    
          // Combine context and sources from all batches
          context = allResults.map(r => r.context).filter(Boolean).join('\n\n');
          sources = allResults.flatMap(r => r.sources);
    
          // Sort sources by similarity descending
          sources.sort((a, b) => b.similarity - a.similarity);
      }
    }

    // 2. Optionally augment with web search results (example logic)
    // This condition should be refined based on actual needs
    if (!context || sources.length < 2) { 
      console.log('Insufficient context from RAG, attempting web search...');
      try {
        // Call the correct method name
        const webSearchResultString = await webSearchService.searchWeb(query);
        
        // Check if the returned string is not empty
        if (webSearchResultString) {
          context = context 
            ? `${context}\n\n--- Web Search Results ---\n${webSearchResultString}` 
            : webSearchResultString;
          
          // Add web search as a source
          sources.push({
            modelId: 'web',
            collectionName: 'web-search',
            filename: chatConfig.WEB_SEARCH_SOURCE_FILENAME,
            similarity: 1.0 // Assign max similarity or handle differently
          });
        }
      } catch (webError) {
        console.error('Web search failed:', webError);
      }
    }

    return {
      contextString: context,
      sources,
      promptTemplate
    };
  }
}

export const ragService = new RAGService(); 