import { BedrockTool, bedrockService } from './bedrock';
import { chromaService } from './chroma';
import { webSearchService } from './webSearch';
import { CollectionModel } from '../models/Collection';
import { DocumentModel, DocumentStatus } from '../models/Document';

interface CollectionQueryResult {
  context: string;
  sources: Array<{
    modelId: string;
    collectionName: string;
    filename: string;
    similarity: number;
    searchType?: string;
    reranked?: boolean;
  }>;
  compressionStats?: {
    originalLength: number;
    compressedLength: number;
    compressionRatio: number;
    documentsUsed: number;
  };
}

export class KnowledgeTool implements BedrockTool {
  name = 'knowledge_search';
  description =
    "Searches the knowledge base for specific information, documents, or data. Use this to answer questions about internal topics.";
  inputSchema = {
    json: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "The user's query to search for.",
        },
      },
      required: ['query'],
    }
  };

  public async execute(input: { query: string }): Promise<any> {
    console.log(`KnowledgeTool executing with query: ${input.query}`);
    try {
      const contextData = await this.improvedSearch(input.query);
      if (!contextData || !contextData.context) {
        console.log('KnowledgeTool: No relevant information found');
        return { success: true, content: 'No relevant information found in the knowledge base.' };
      }
      console.log(`KnowledgeTool: Found ${contextData.sources.length} sources`);
      return { success: true, content: contextData.context, sources: contextData.sources };
    } catch (error) {
      console.error('Error executing KnowledgeTool:', error);
      return { success: false, content: 'An error occurred while searching the knowledge base.' };
    }
  }

  // Simplified search approach
  private async improvedSearch(query: string): Promise<CollectionQueryResult> {
    try {
      console.log('KnowledgeTool: Starting improved search');
      
      // Get all available collections (remove strict summary requirement)
      const allCollections = await CollectionModel.find({}).lean();
      console.log(`KnowledgeTool: Found ${allCollections.length} total collections`);
      
      if (allCollections.length === 0) {
        console.log('KnowledgeTool: No collections found');
        return { context: '', sources: [] };
      }

      let allChunksText: string[] = [];
      let allSources: any[] = [];

      // Search in all collections directly (skip L2 routing if few collections)
      const collectionsToSearch = allCollections.length <= 5 ? 
        allCollections : 
        await this.selectRelevantCollections(query);

      console.log(`KnowledgeTool: Searching in ${collectionsToSearch.length} collections`);

      for (const collection of collectionsToSearch) {
        try {
          console.log(`KnowledgeTool: Searching collection: ${collection.name}`);
          
          // Direct ChromaDB search without document filtering
          const hybridResult = await chromaService.hybridSearchWithReRanking(
            collection.name,
            query, 
            8, // Increase results per collection
            {} // No document filter
          );

          if (hybridResult?.documents && hybridResult.documents.length > 0) {
            allChunksText.push(...hybridResult.documents);
            const sources = hybridResult.metadatas.map((metadata, index) => ({
                modelId: metadata.modelId || 'unknown',
                collectionName: collection.name,
                filename: metadata.filename || 'unknown',
                similarity: hybridResult.scores[index] || 0,
            }));
            allSources.push(...sources);
            console.log(`KnowledgeTool: Found ${hybridResult.documents.length} chunks in ${collection.name}`);
          }
        } catch (collectionError) {
          console.error(`KnowledgeTool: Error searching collection ${collection.name}:`, collectionError);
          // Continue with other collections
        }
      }

      if (allChunksText.length === 0) {
        console.log('KnowledgeTool: No chunks found across all collections');
        return { context: '', sources: [] };
      }

      console.log(`KnowledgeTool: Total chunks found: ${allChunksText.length}`);

      // Context compression
      const compressionResult = await chromaService.selectAndCompressContext(
        query,
        allChunksText,
        [],
        [],
        4000
      );
      
      return {
        context: compressionResult.compressedContext,
        sources: allSources,
        compressionStats: compressionResult.compressionStats
      };

    } catch (error) {
      console.error('KnowledgeTool: Error in improved search:', error);
      throw error;
    }
  }

  protected async selectRelevantCollections(query: string): Promise<any[]> {
    const allCollections = await CollectionModel.find({}).lean(); // Remove summary requirement
    
    if (allCollections.length <= 3) {
      return allCollections;
    }

    // Create a simpler collection selection prompt
    const collectionsString = allCollections
      .map(c => `  - ${c.name}: ${c.description || c.summary || 'No description'}`)
      .join('\n');
    
    const prompt = `Select the most relevant collections for this query: "${query}"

Available Collections:
${collectionsString}

Return only a JSON array of collection names: ["name1", "name2"]`;

    try {
      const response = await bedrockService.invokeForText(prompt);
      // Parse JSON from response
      const jsonMatch = response.match(/\[(.*?)\]/);
      if (jsonMatch) {
        const selectedNames = JSON.parse(jsonMatch[0]);
        console.log('KnowledgeTool: L2 Router selected collections:', selectedNames);
        return allCollections.filter(c => selectedNames.includes(c.name));
      }
      
      // Fallback: return all collections
      console.log('KnowledgeTool: L2 Router failed, using all collections');
      return allCollections;
    } catch (error) {
      console.error('Error in L2 collection selection:', error);
      return allCollections;
    }
  }
}

export class WebSearchTool implements BedrockTool {
  name = 'web_search';
  description = "Searches the web for up-to-date information. Use this for current events or general knowledge questions.";
  inputSchema = {
    json: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' },
      },
      required: ['query'],
    }
  };

  async execute(input: { query: string }): Promise<any> {
    console.log(`WebSearchTool executing with query: ${input.query}`);
    try {
      const searchResultText = await webSearchService.searchWeb(input.query);
      if (!searchResultText || searchResultText.trim() === '') {
        console.log('WebSearchTool: No results found');
        return { success: true, content: 'No search results found for your query. Please try rephrasing your question.' };
      }
      console.log(`WebSearchTool: Successfully found search results (${searchResultText.length} characters)`);
      return { success: true, content: searchResultText };
    } catch (error) {
      console.error('Error executing WebSearchTool:', error);
      return { 
        success: false, 
        content: 'Web search is currently unavailable. Please try again later or ask me something from my knowledge base.' 
      };
    }
  }
} 