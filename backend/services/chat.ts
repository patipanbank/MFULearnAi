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
import { KnowledgeTool, WebSearchTool } from './tools';
import { CollectionModel } from '../models/Collection';

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

  public async *sendMessage(
    messages: ChatMessage[],
    modelId: string,
    userId: string
  ): AsyncGenerator<any> {
    try {
      // Get the model and its collections
      const model = await ModelModel.findById(modelId);
      if (!model) {
        yield { type: 'error', data: 'Model not found' };
        return;
      }

      // Get system prompt
      const systemPrompt = await this.getSystemPrompt();
      
      // Update daily stats
      await this.updateDailyStats(userId);

      // Create tools array
      const tools = await this.createToolsForModel(model);

      // Prepare messages for Bedrock
      const conversationMessages = messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: [{ text: msg.content }]
      }));

      // Start the Agent Loop
      yield* this.agentLoop(conversationMessages, systemPrompt, tools, userId);

    } catch (error) {
      console.error('Error in sendMessage:', error);
      yield { type: 'error', data: 'An error occurred while processing your message.' };
    }
  }

  private async createToolsForModel(model: ModelDocument): Promise<BedrockTool[]> {
    const tools: BedrockTool[] = [];

    // Add KnowledgeTool if model has collections
    if (model.collections && model.collections.length > 0) {
      const knowledgeTool = new KnowledgeToolForModel(model.collections.map(c => c.name));
      tools.push(knowledgeTool);
    }

    // Always add WebSearchTool
    tools.push(new WebSearchTool());

    return tools;
  }

  private async *agentLoop(
    messages: any[],
    systemPrompt: string,
    tools: BedrockTool[],
    userId: string
  ): AsyncGenerator<any> {
    const toolConfig = tools.length > 0 ? {
      tools: tools.map(tool => ({
        toolSpec: {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }
      }))
    } : undefined;

    let conversationMessages = [...messages];
    let iterationCount = 0;
    const maxIterations = 10;
    let allSources: any[] = []; // Collect sources from all tool calls

    while (iterationCount < maxIterations) {
      iterationCount++;

      try {
        const converseInput = {
          modelId: bedrockService.chatModel,
          messages: conversationMessages,
          system: [{ text: systemPrompt }],
          toolConfig,
          inferenceConfig: {
            maxTokens: 4096,
            temperature: 0.7,
            topP: 0.9
          }
        };

        // Stream the response
        const responseStream = bedrockService.converseStream(converseInput);
        let currentContent = '';
        let toolUseBlocks: any[] = [];

        for await (const chunk of responseStream) {
          if (chunk.contentBlockDelta?.delta?.text) {
            const textDelta = chunk.contentBlockDelta.delta.text;
            currentContent += textDelta;
            yield { type: 'content', data: textDelta };
          } else if (chunk.contentBlockStart?.start?.toolUse) {
            toolUseBlocks.push(chunk.contentBlockStart.start.toolUse);
          } else if (chunk.contentBlockDelta?.delta?.toolUse) {
            const lastToolUse = toolUseBlocks[toolUseBlocks.length - 1];
            if (lastToolUse) {
              lastToolUse.input = { ...lastToolUse.input, ...chunk.contentBlockDelta.delta.toolUse.input };
            }
          }
        }

        // Add assistant's response to conversation
        const assistantMessage: any = { role: 'assistant', content: [] };
        
        if (currentContent) {
          assistantMessage.content.push({ text: currentContent });
        }

        if (toolUseBlocks.length > 0) {
          assistantMessage.content.push(...toolUseBlocks.map(toolUse => ({ toolUse })));
        }

        conversationMessages.push(assistantMessage);

        // If no tool use, we're done
        if (toolUseBlocks.length === 0) {
          // Update usage tracking
          await usageService.updateTokenUsage(userId, currentContent.length);
          break;
        }

        // Execute tools and add results
        const toolResults = [];
        for (const toolUse of toolUseBlocks) {
          const tool = tools.find(t => t.name === toolUse.name);
          if (tool) {
            yield { type: 'tool_use', data: `Using ${tool.name}...` };
            const result = await tool.execute(toolUse.input);
            
            // Extract sources if the tool provides them
            if (result.sources) {
              allSources = [...allSources, ...result.sources];
            }
            
            toolResults.push({
              toolUseId: toolUse.toolUseId,
              content: [{ text: JSON.stringify(result) }]
            });
          }
        }

        // Add tool results to conversation
        conversationMessages.push({
          role: 'user',
          content: toolResults.map(result => ({ toolResult: result }))
        });

      } catch (error) {
        console.error('Error in agent loop iteration:', error);
        yield { type: 'error', data: 'An error occurred during processing.' };
        break;
      }
    }

    if (iterationCount >= maxIterations) {
      yield { type: 'error', data: 'Maximum iterations reached.' };
    }
    
    // Yield all collected sources at the end
    if (allSources.length > 0) {
      yield { type: 'sources', data: allSources };
    }
  }

  private async getSystemPrompt(): Promise<string> {
    const prompt = await SystemPrompt.findOne();
    if (prompt) {
      return prompt.prompt;
    }
    const defaultPrompt = `You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.

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
    return defaultPrompt;
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
}

// Create a specialized KnowledgeTool that only searches specific collections
class KnowledgeToolForModel extends KnowledgeTool {
  private allowedCollections: string[];

  constructor(allowedCollections: string[]) {
    super();
    this.allowedCollections = allowedCollections;
    console.log(`KnowledgeToolForModel: Created for collections: ${allowedCollections.join(', ')}`);
  }

  // Override the improved search to only use allowed collections
  private async modelSpecificSearch(query: string): Promise<CollectionQueryResult> {
    try {
      console.log('KnowledgeToolForModel: Starting search with allowed collections');
      
      // Get only allowed collections
      const allCollections = await CollectionModel.find({ 
        name: { $in: this.allowedCollections }
      }).lean();
      
      console.log(`KnowledgeToolForModel: Found ${allCollections.length} allowed collections`);
      
      if (allCollections.length === 0) {
        console.log('KnowledgeToolForModel: No allowed collections found');
        return { context: '', sources: [] };
      }

      let allChunksText: string[] = [];
      let allSources: any[] = [];

      // Search in all allowed collections directly
      for (const collection of allCollections) {
        try {
          console.log(`KnowledgeToolForModel: Searching collection: ${collection.name}`);
          
          // Direct ChromaDB search
          const hybridResult = await chromaService.hybridSearchWithReRanking(
            collection.name,
            query, 
            10, // More results per collection for model-specific search
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
            console.log(`KnowledgeToolForModel: Found ${hybridResult.documents.length} chunks in ${collection.name}`);
          }
        } catch (collectionError) {
          console.error(`KnowledgeToolForModel: Error searching collection ${collection.name}:`, collectionError);
          // Continue with other collections
        }
      }

      if (allChunksText.length === 0) {
        console.log('KnowledgeToolForModel: No chunks found across allowed collections');
        return { context: '', sources: [] };
      }

      console.log(`KnowledgeToolForModel: Total chunks found: ${allChunksText.length}`);

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
      console.error('KnowledgeToolForModel: Error in model specific search:', error);
      throw error;
    }
  }

  // Override execute to use the model specific search
  public async execute(input: { query: string }): Promise<any> {
    console.log(`KnowledgeToolForModel executing with query: ${input.query}`);
    console.log(`KnowledgeToolForModel: Allowed collections: ${this.allowedCollections.join(', ')}`);
    
    try {
      const contextData = await this.modelSpecificSearch(input.query);
      if (!contextData || !contextData.context) {
        console.log('KnowledgeToolForModel: No relevant information found');
        return { success: true, content: `No relevant information found in the selected knowledge bases: ${this.allowedCollections.join(', ')}` };
      }
      console.log(`KnowledgeToolForModel: Found ${contextData.sources.length} sources`);
      return { success: true, content: contextData.context, sources: contextData.sources };
    } catch (error) {
      console.error('Error executing KnowledgeToolForModel:', error);
      return { success: false, content: 'An error occurred while searching the knowledge base.' };
    }
  }

  protected async selectRelevantCollections(query: string): Promise<any[]> {
    // Override to only search in allowed collections
    const allCollections = await CollectionModel.find({ 
      name: { $in: this.allowedCollections }
    }).lean();

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
        console.log('KnowledgeToolForModel: L2 Router selected collections:', selectedNames);
        return allCollections.filter(c => selectedNames.includes(c.name));
      }
      
      // Fallback: return all allowed collections
      console.log('KnowledgeToolForModel: L2 Router failed, using all allowed collections');
      return allCollections;
    } catch (error) {
      console.error('Error in L2 collection selection:', error);
      return allCollections;
    }
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  // console.log('Debug message');
}

