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

  /**
   * Returns a Bedrock-compatible JSON schema or **undefined** when the input is invalid.
   * Bedrock currently supports only three top-level keys on the input schema: `type`,
   * `properties`, and `required` (see AWS documentation).
   * – `type` must be the literal string "object".
   * – `properties` must contain at least **one** property definition.
   * – `required` must be an array with at least one entry and must reference only keys
   *   that exist in `properties`. The field is omitted when empty to avoid Bedrock
   *   runtime errors.
   */
  private cleanInputSchema(schema: any): any {
    // Validate basic structure
    if (!schema || typeof schema !== 'object' || !schema.properties || Object.keys(schema.properties).length === 0) {
      return undefined;
    }

    const cleanSchema: any = {
      type: 'object',
      properties: {}
    };

    // Sanitize each property definition
    for (const [key, value] of Object.entries(schema.properties)) {
      if (!value || typeof value !== 'object') continue;
      cleanSchema.properties[key] = this.cleanPropertySchema(value);
    }

    // Ensure at least one property remains after cleaning
    if (Object.keys(cleanSchema.properties).length === 0) {
      return undefined;
    }

    // Ensure a valid, non-empty `required` array (Bedrock runtime can error otherwise)
    if (Array.isArray(schema.required)) {
      const filteredRequired = schema.required.filter(
        (item: any) => typeof item === 'string' && item in cleanSchema.properties
      );
      if (filteredRequired.length > 0) {
        cleanSchema.required = filteredRequired;
      }
    }

    // If no `required` field was provided or all entries were filtered out, default
    // to making every property required to satisfy the non-empty constraint.
    if (!cleanSchema.required || cleanSchema.required.length === 0) {
      cleanSchema.required = Object.keys(cleanSchema.properties);
    }

    return cleanSchema;
  }

  private cleanPropertySchema(property: any): any {
    if (!property || typeof property !== 'object') {
      return { type: 'string' };
    }

    const cleanProperty: any = {
      type: property.type || 'string'
    };

    if (property.description && typeof property.description === 'string') {
      cleanProperty.description = property.description;
    }

    // Handle other property attributes if needed
    if (property.enum && Array.isArray(property.enum)) {
      cleanProperty.enum = property.enum.filter((item: any) => item !== null && item !== undefined);
    }

    return cleanProperty;
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
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while processing your message.';
      yield { type: 'error', data: errorMessage };
    }
  }

  private async createToolsForModel(model: ModelDocument): Promise<BedrockTool[]> {
    const tools: BedrockTool[] = [];

    try {
      // Add KnowledgeTool if model has collections
      if (model && model.collections && Array.isArray(model.collections) && model.collections.length > 0) {
        const collectionNames = model.collections
          .filter(c => c && c.name && typeof c.name === 'string')
          .map(c => c.name);
        
        if (collectionNames.length > 0) {
          const knowledgeTool = new KnowledgeToolForModel(collectionNames);
          tools.push(knowledgeTool);
        }
      }

      // Always add WebSearchTool
      tools.push(new WebSearchTool());

      console.log(`Created ${tools.length} tools for model ${model?._id}: ${tools.map(t => t.name).join(', ')}`);
      
      // Debug: Log tool schemas
      tools.forEach(tool => {
        console.log(`Tool ${tool.name} schema:`, JSON.stringify(tool.inputSchema, null, 2));
      });
      
      return tools;
    } catch (error) {
      console.error('Error creating tools for model:', error);
      // Return at least WebSearchTool as fallback
      return [new WebSearchTool()];
    }
  }

  private async *agentLoop(
    messages: any[],
    systemPrompt: string,
    tools: BedrockTool[],
    userId: string
  ): AsyncGenerator<any> {
    // Validate and clean tool configuration
    const validTools = tools.filter(tool => 
      tool && 
      tool.name && 
      tool.description && 
      tool.inputSchema &&
      typeof tool.name === 'string' &&
      typeof tool.description === 'string' &&
      typeof tool.inputSchema === 'object'
    );

    const toolConfig = {
      tools: validTools.map(tool => {
        const cleanInputSchema = this.cleanInputSchema(tool.inputSchema);
        
        if (!cleanInputSchema) {
          console.warn(`Tool ${tool.name} has an invalid or empty input schema. Skipping.`);
          return null; 
        }

        console.log(`Cleaned schema for ${tool.name}:`, JSON.stringify(cleanInputSchema, null, 2));

        return {
          toolSpec: {
            name: tool.name,
            description: tool.description,
            inputSchema: {
              json: cleanInputSchema
            }
          }
        };
      }).filter(Boolean) as any[]
    };

    if (!toolConfig.tools || toolConfig.tools.length === 0) {
      console.log('Agent Loop: No valid tools with schemas available.');
      // Handle the case with no tools, maybe run without toolConfig
      // For now, let's proceed and see if converse API handles an empty toolConfig.tools array
    } else {
      console.log(`Agent Loop: Using ${toolConfig.tools.length} valid tools with schemas.`);
    }

    let conversationMessages = [...messages];
    let iterationCount = 0;
    const maxIterations = 10;

    while (iterationCount < maxIterations) {
      iterationCount++;

      try {
        const converseInput: any = {
          modelId: bedrockService.chatModel,
          messages: conversationMessages,
          system: [{ text: systemPrompt }],
          inferenceConfig: {
            maxTokens: 4096,
            temperature: 0.7,
            topP: 0.9
          }
        };

        // Add toolConfig only if we have valid tools
        if (toolConfig && toolConfig.tools.length > 0) {
          converseInput.toolConfig = toolConfig;
        }

        // Debug: log the toolConfig we are about to send (only in non-production mode)
        if (process.env.NODE_ENV !== 'production') {
          try {
            console.debug('[Bedrock] toolConfig sent to model:', JSON.stringify(toolConfig, null, 2));
          } catch {}
        }

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
          const tool = validTools.find(t => t.name === toolUse.name);
          if (tool) {
            try {
              yield { type: 'tool_use', data: `Using ${tool.name}...` };
              const result = await tool.execute(toolUse.input);
              
              // Ensure result is not undefined and has proper structure
              const safeResult = result || { success: false, content: 'Tool returned no result' };
              
              toolResults.push({
                toolUseId: toolUse.toolUseId,
                content: [{ text: JSON.stringify(safeResult) }]
              });
            } catch (toolError) {
              console.error(`Error executing tool ${tool.name}:`, toolError);
              toolResults.push({
                toolUseId: toolUse.toolUseId,
                content: [{ text: JSON.stringify({ 
                  success: false, 
                  content: `Error executing ${tool.name}: ${toolError instanceof Error ? toolError.message : 'Unknown error'}` 
                }) }]
              });
            }
          } else {
            console.error(`Tool not found: ${toolUse.name}`);
            toolResults.push({
              toolUseId: toolUse.toolUseId,
              content: [{ text: JSON.stringify({ 
                success: false, 
                content: `Tool ${toolUse.name} not found` 
              }) }]
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
        const errorMessage = error instanceof Error ? error.message : 'An error occurred during processing.';
        yield { type: 'error', data: errorMessage };
        break;
      }
    }

    if (iterationCount >= maxIterations) {
      yield { type: 'error', data: 'Maximum iterations reached.' };
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
  }

  protected async selectRelevantCollections(query: string): Promise<any[]> {
    try {
      // Validate input
      if (!query || typeof query !== 'string') {
        console.error('Invalid query provided to selectRelevantCollections');
        return [];
      }

      if (!this.allowedCollections || !Array.isArray(this.allowedCollections) || this.allowedCollections.length === 0) {
        console.error('No allowed collections configured for this model');
        return [];
      }

      // Override to only search in allowed collections
      const allCollections = await CollectionModel.find({ 
        name: { $in: this.allowedCollections },
        $and: [
          { summary: { $ne: null } },
          { summary: { $ne: '' } }
        ]
      }).lean();

      if (!allCollections || allCollections.length === 0) {
        console.log('No collections found with summaries for allowed collections:', this.allowedCollections);
        return [];
      }

      if (allCollections.length <= 3) {
        return allCollections;
      }

      const collectionsString = allCollections
        .map(c => `  - ${c.name} (ID: ${(c as any)._id}): ${c.summary}`)
        .join('\\n');
      
      const prompt = `You are an AI routing agent. Select the most relevant data collections for the user's query. User Query: "${query}". Available Collections:\\n${collectionsString}\\n\\nRespond with a JSON object containing a list of collection names, like this: { "collections": ["collection_name_1", "collection_name_2"] }`;

      try {
        const response = await bedrockService.invokeModelJSON(prompt);
        if (response && Array.isArray(response.collections)) {
          console.log('L2 Router selected collections:', response.collections);
          return allCollections.filter(c => response.collections.includes(c.name));
        }
        return allCollections;
      } catch (error) {
        console.error('Error in L2 collection selection:', error);
        return allCollections;
      }
    } catch (error) {
      console.error('Error in selectRelevantCollections:', error);
      return [];
    }
  }
}

export const chatService = new ChatService();

// ใน production mode บางครั้ง console จะถูก strip ออกโดยอัตโนมัติ
if (process.env.NODE_ENV !== 'production') {
  // console.log('Debug message');
}

