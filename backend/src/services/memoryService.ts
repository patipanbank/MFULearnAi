import { chromaService } from './chromaService';
import { embeddingService } from './embeddingService';
import { redis } from '../lib/redis';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Modern Memory Service with intelligent conversation management
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface MemorySearchResult {
  content: string;
  role: string;
  timestamp: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
}

export interface ConversationSummary {
  sessionId: string;
  summary: string;
  messageCount: number;
  lastUpdated: string;
  keyTopics: string[];
}

// Enhanced Context Switching Interfaces
export interface ContextSwitch {
  id: string;
  sessionId: string;
  fromContext: ConversationContext;
  toContext: ConversationContext;
  trigger: ContextSwitchTrigger;
  timestamp: Date;
  confidence: number;
  transitionType: 'smooth' | 'abrupt' | 'related' | 'unrelated';
}

export interface ConversationContext {
  id: string;
  topic: string;
  domain: string;
  entities: Entity[];
  sentiment: 'positive' | 'negative' | 'neutral';
  complexity: 'low' | 'medium' | 'high';
  intent: string;
  keywords: string[];
  startTime: Date;
  endTime?: Date;
  messageCount: number;
}

export interface Entity {
  text: string;
  type: 'person' | 'place' | 'organization' | 'concept' | 'technology' | 'other';
  confidence: number;
  mentions: number;
}

export interface ContextSwitchTrigger {
  type: 'user_intent' | 'topic_drift' | 'explicit_change' | 'time_gap' | 'entity_change';
  confidence: number;
  evidence: string[];
}

export interface TopicModel {
  sessionId: string;
  topics: Topic[];
  topicTransitions: TopicTransition[];
  lastUpdated: Date;
}

export interface Topic {
  id: string;
  name: string;
  keywords: string[];
  prevalence: number;
  coherence: number;
  messages: string[];
}

export interface TopicTransition {
  fromTopic: string;
  toTopic: string;
  frequency: number;
  averageGap: number;
  transitionProbability: number;
}

export interface ContextTransition {
  id: string;
  sessionId: string;
  messageIndex: number;
  previousContext: ConversationContext;
  newContext: ConversationContext;
  transitionScore: number;
  adaptationStrategy: AdaptationStrategy;
  timestamp: Date;
}

export interface AdaptationStrategy {
  type: 'maintain_context' | 'bridge_contexts' | 'reset_context' | 'merge_contexts';
  memoryRetention: number;
  contextBlending: number;
  priority: 'previous' | 'current' | 'balanced';
}

export class MemoryService {
  private bedrock: BedrockRuntimeClient;
  private readonly BUFFER_WINDOW_SIZE = 20; // Increased buffer
  private readonly TOKEN_LIMIT = 4000; // Context window limit
  private readonly SUMMARY_THRESHOLD = 30; // Messages before summarization
  private readonly MIN_RELEVANCE_SCORE = 0.7;

  // Enhanced Context Switching
  private contextSwitchCache: Map<string, ContextSwitch> = new Map();
  private topicModelCache: Map<string, TopicModel> = new Map();
  private contextTransitions: Map<string, ContextTransition[]> = new Map();

  constructor() {
    this.bedrock = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.setupContextSwitching();
  }

  // ===== MAIN API METHODS =====

  /**
   * Add message with intelligent management
   */
  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    try {
      // 1. Add to buffer
      await this.addToBuffer(sessionId, message);
      
      // 2. Check if we need summarization
      const bufferSize = await this.getBufferSize(sessionId);
      if (bufferSize >= this.SUMMARY_THRESHOLD) {
        await this.performSummarization(sessionId);
      }
      
      // 3. Add to vector store for semantic search
      await this.addToVectorStore(sessionId, message);
      
    } catch (error) {
      console.error(`❌ Error adding message: ${error}`);
      throw error;
    }
  }

  /**
   * Get conversation context with smart retrieval
   */
  async getConversationContext(sessionId: string, query?: string): Promise<ConversationMessage[]> {
    try {
      // 1. Get recent buffer messages
      const recentMessages = await this.getBufferMessages(sessionId);
      
      // 2. Get conversation summary if exists
      const summary = await this.getConversationSummary(sessionId);
      
      // 3. If query provided, get relevant messages
      let relevantMessages: ConversationMessage[] = [];
      if (query) {
        const searchResults = await this.semanticSearch(sessionId, query, 5);
        relevantMessages = searchResults.map(result => ({
          role: result.role as 'user' | 'assistant',
          content: result.content,
          timestamp: result.timestamp,
          metadata: { ...result.metadata, relevanceScore: result.relevanceScore }
        }));
      }
      
      // 4. Combine and optimize
      return this.combineMessages(recentMessages, relevantMessages, summary);
      
    } catch (error) {
      console.error(`❌ Error getting conversation context: ${error}`);
      return [];
    }
  }

  /**
   * Legacy compatibility - add recent message
   */
  async addRecentMessage(sessionId: string, message: any) {
    const msg: ConversationMessage = {
      role: message.role || 'user',
      content: message.content || '',
      timestamp: message.timestamp || new Date().toISOString(),
      metadata: message.metadata
    };
    await this.addMessage(sessionId, msg);
  }

  /**
   * Legacy compatibility - get recent messages
   */
  async getRecentMessages(sessionId: string): Promise<any[]> {
    const messages = await this.getBufferMessages(sessionId);
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      ...msg.metadata
    }));
  }

  /**
   * Search memory with semantic understanding
   */
  async searchMemory(sessionId: string, query: string, k: number = 3): Promise<any[]> {
    try {
      const results = await this.semanticSearch(sessionId, query, k);
      return results.map(result => ({
        content: result.content,
        role: result.role,
        timestamp: result.timestamp,
        relevanceScore: result.relevanceScore
      }));
    } catch (error) {
      console.error(`❌ Error searching memory: ${error}`);
      return [];
    }
  }

  // ===== BUFFER MANAGEMENT =====

  private async addToBuffer(sessionId: string, message: ConversationMessage): Promise<void> {
    const key = `memory:buffer:${sessionId}`;
    const messageStr = JSON.stringify(message);
    
    await redis.lpush(key, messageStr);
    await redis.ltrim(key, 0, this.BUFFER_WINDOW_SIZE - 1);
    await redis.expire(key, 86400); // 24 hours
  }

  private async getBufferMessages(sessionId: string): Promise<ConversationMessage[]> {
    const key = `memory:buffer:${sessionId}`;
    const items = await redis.lrange(key, 0, -1);
    
    return items.map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    }).filter(Boolean).reverse(); // Chronological order
  }

  private async getBufferSize(sessionId: string): Promise<number> {
    const key = `memory:buffer:${sessionId}`;
    return await redis.llen(key);
  }

  private async clearBuffer(sessionId: string): Promise<void> {
    const key = `memory:buffer:${sessionId}`;
    await redis.del(key);
  }

  // ===== SUMMARIZATION =====

  private async performSummarization(sessionId: string): Promise<void> {
    try {
      const messages = await this.getBufferMessages(sessionId);
      if (messages.length < 15) return;
      
      // Keep recent 10, summarize older ones
      const messagesToSummarize = messages.slice(0, -10);
      const remainingMessages = messages.slice(-10);
      
      // Generate summary
      const newSummary = await this.generateSummary(sessionId, messagesToSummarize);
      
      // Update summary
      await this.updateSummary(sessionId, newSummary);
      
      // Reset buffer
      await this.clearBuffer(sessionId);
      for (const msg of remainingMessages) {
        await this.addToBuffer(sessionId, msg);
      }
      
      console.log(`🧠 Summarized ${messagesToSummarize.length} messages for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Error in summarization: ${error}`);
    }
  }

  private async generateSummary(sessionId: string, messages: ConversationMessage[]): Promise<ConversationSummary> {
    try {
      const conversationText = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
      
      const prompt = `Summarize this conversation focusing on key points, decisions, and context needed for continuation:\n\n${conversationText}\n\nProvide a concise summary:`;

      const command = new InvokeModelCommand({
        modelId: 'amazon.titan-text-express-v1',
        body: JSON.stringify({
          inputText: prompt,
          textGenerationConfig: {
            maxTokenCount: 500,
            temperature: 0.3,
            topP: 0.9
          }
        }),
        contentType: 'application/json'
      });

      const response = await this.bedrock.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const summary = responseBody.results[0].outputText.trim();
      
      // Extract key topics
      const keyTopics = this.extractKeyTopics(conversationText);
      
      return {
        sessionId,
        summary,
        messageCount: messages.length,
        lastUpdated: new Date().toISOString(),
        keyTopics
      };
      
    } catch (error) {
      console.error(`❌ Error generating summary: ${error}`);
      return {
        sessionId,
        summary: `Conversation summary (${messages.length} messages)`,
        messageCount: messages.length,
        lastUpdated: new Date().toISOString(),
        keyTopics: []
      };
    }
  }

  private extractKeyTopics(text: string): string[] {
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'when', 'where', 'why', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can']);
    
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      if (word.length > 3 && !stopWords.has(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
    
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  // ===== SUMMARY MANAGEMENT =====

  private async updateSummary(sessionId: string, summary: ConversationSummary): Promise<void> {
    const key = `memory:summary:${sessionId}`;
    await redis.setex(key, 604800, JSON.stringify(summary)); // 7 days
  }

  private async getConversationSummary(sessionId: string): Promise<ConversationSummary | null> {
    const key = `memory:summary:${sessionId}`;
    const summaryStr = await redis.get(key);
    
    if (!summaryStr) return null;
    
    try {
      return JSON.parse(summaryStr);
    } catch {
      return null;
    }
  }

  // ===== VECTOR STORE OPERATIONS =====

  private async addToVectorStore(sessionId: string, message: ConversationMessage): Promise<void> {
    try {
      const contentHash = Buffer.from(message.content + message.timestamp).toString('base64');
      const collectionName = `memory_${sessionId}`;
      
      // Check if exists
      const exists = await chromaService.documentExists(collectionName, contentHash);
      if (exists) return;
      
      // Generate embedding
      const embedding = await embeddingService.embed(message.content);
      if (!embedding || embedding.length === 0) return;
      
      // Add to ChromaDB
      await chromaService.addToCollection(
        collectionName,
        [message.content],
        [embedding],
        [{
          role: message.role,
          timestamp: message.timestamp,
          sessionId,
          ...message.metadata
        }],
        [contentHash]
      );
      
    } catch (error) {
      console.error(`❌ Error adding to vector store: ${error}`);
    }
  }

  private async semanticSearch(sessionId: string, query: string, k: number = 5): Promise<MemorySearchResult[]> {
    try {
      const queryEmbedding = await embeddingService.embed(query);
      if (!queryEmbedding || queryEmbedding.length === 0) return [];
      
      const results = await chromaService.queryCollection(`memory_${sessionId}`, [queryEmbedding], k);
      if (!results) return [];
      
      const processedResults: MemorySearchResult[] = [];
      
      if (results.documents && results.distances && results.metadatas) {
        const documents = results.documents.flat();
        const distances = results.distances.flat();
        const metadatas = results.metadatas.flat();
        
        for (let i = 0; i < documents.length; i++) {
          const relevanceScore = Math.max(0, 1 - (distances[i] || 1));
          
          if (relevanceScore >= this.MIN_RELEVANCE_SCORE) {
            const metadata = metadatas[i];
            processedResults.push({
              content: String(documents[i] || ''),
              role: String(metadata?.role || 'user'),
              timestamp: String(metadata?.timestamp || ''),
              relevanceScore,
              metadata: metadata || undefined
            });
          }
        }
      }
      
      return processedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
    } catch (error) {
      console.error(`❌ Error in semantic search: ${error}`);
      return [];
    }
  }

  // ===== UTILITY METHODS =====

  private combineMessages(
    recentMessages: ConversationMessage[],
    relevantMessages: ConversationMessage[],
    summary: ConversationSummary | null
  ): ConversationMessage[] {
    const messages: ConversationMessage[] = [];
    
    // Add summary as context
    if (summary) {
      messages.push({
        role: 'system',
        content: `Previous conversation: ${summary.summary}`,
        timestamp: summary.lastUpdated,
        metadata: { type: 'summary', keyTopics: summary.keyTopics }
      });
    }
    
    // Deduplicate and combine
    const seen = new Set<string>();
    const allMessages = [...relevantMessages, ...recentMessages];
    
    for (const msg of allMessages) {
      const key = `${msg.content}_${msg.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        messages.push(msg);
      }
    }
    
    // Sort by timestamp and apply token limit
    const sorted = messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return this.trimToTokenLimit(sorted);
  }

  private trimToTokenLimit(messages: ConversationMessage[]): ConversationMessage[] {
    let totalTokens = 0;
    const result: ConversationMessage[] = [];
    
    // Process from most recent backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const estimatedTokens = Math.ceil(msg.content.length / 4);
      
      if (totalTokens + estimatedTokens <= this.TOKEN_LIMIT) {
        result.unshift(msg);
        totalTokens += estimatedTokens;
      } else if (msg.role === 'system') {
        // Always keep system messages (summaries)
        result.unshift(msg);
      } else {
        break;
      }
    }
    
    return result;
  }

  // ===== LEGACY COMPATIBILITY =====

  async embedMessage(sessionId: string, message: string) {
    const msg: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    await this.addMessage(sessionId, msg);
  }

  async getAllMessages(sessionId: string): Promise<any[]> {
    try {
      const results = await chromaService.getAllFromCollection(`memory_${sessionId}`);
      if (!Array.isArray(results)) return [];
      
      return results.map((r: { document: string | null; metadata: any }) => ({
        content: r.document ?? '',
        role: r.metadata?.role || 'user',
        timestamp: r.metadata?.timestamp || null
      }));
    } catch (error) {
      console.error(`❌ Error getting all messages: ${error}`);
      return [];
    }
  }

  async setupHybridMemory(sessionId: string, messages: any[]) {
    try {
      console.log(`🧠 Setting up memory for session ${sessionId}`);
      
      const recentMessages = messages.slice(-this.BUFFER_WINDOW_SIZE);
      await this.clearBuffer(sessionId);
      
      for (const msg of recentMessages) {
        const message: ConversationMessage = {
          role: msg.role || 'user',
          content: msg.content || '',
          timestamp: msg.timestamp || new Date().toISOString(),
          metadata: msg.metadata
        };
        await this.addToBuffer(sessionId, message);
      }
      
      console.log(`💾 Memory initialized with ${recentMessages.length} messages`);
    } catch (error) {
      console.error(`❌ Error setting up memory: ${error}`);
    }
  }

  async getMemoryStats(sessionId: string): Promise<any> {
    try {
      const bufferSize = await this.getBufferSize(sessionId);
      const summary = await this.getConversationSummary(sessionId);
      
      let vectorStoreCount = 0;
      try {
        const allMessages = await chromaService.getAllFromCollection(`memory_${sessionId}`);
        vectorStoreCount = Array.isArray(allMessages) ? allMessages.length : 0;
      } catch {
        vectorStoreCount = 0;
      }
      
      return {
        sessionId,
        bufferSize,
        vectorStoreCount,
        hasSummary: !!summary,
        summaryMessageCount: summary?.messageCount || 0,
        keyTopics: summary?.keyTopics || [],
        lastSummaryUpdate: summary?.lastUpdated || null,
        memoryType: 'intelligent_hybrid'
      };
    } catch (error) {
      console.error(`❌ Error getting memory stats: ${error}`);
      return { error: 'Memory stats unavailable' };
    }
  }

  async clearRecentMessages(sessionId: string) {
    await this.clearBuffer(sessionId);
  }

  async clearLongTermMemory(sessionId: string) {
    try {
      await chromaService.deleteCollection(`memory_${sessionId}`);
    } catch (error) {
      console.error(`❌ Error clearing long-term memory: ${error}`);
    }
  }

  async clearAllMemory(sessionId: string) {
    try {
      await this.clearBuffer(sessionId);
      await redis.del(`memory:summary:${sessionId}`);
      await chromaService.deleteCollection(`memory_${sessionId}`);
      console.log(`🧹 Cleared all memory for session ${sessionId}`);
    } catch (error) {
      console.error(`❌ Error clearing memory: ${error}`);
    }
  }

  // Development/testing methods
  async forceSummarization(sessionId: string): Promise<ConversationSummary | null> {
    try {
      await this.performSummarization(sessionId);
      return await this.getConversationSummary(sessionId);
    } catch (error) {
      console.error(`❌ Error in force summarization: ${error}`);
      return null;
    }
  }

  // ===== ENHANCED CONTEXT SWITCHING =====

  private setupContextSwitching(): void {
    console.log('🧠 Setting up enhanced context switching');
    // Initialize context switching capabilities
  }

  /**
   * Intelligent context switching with conversation flow analysis
   */
  async analyzeContextSwitch(
    sessionId: string,
    newMessage: ConversationMessage,
    previousMessages: ConversationMessage[]
  ): Promise<ContextSwitch | null> {
    try {
      // 1. Analyze current conversation context
      const currentContext = await this.analyzeCurrentContext(sessionId, previousMessages);

      // 2. Analyze new message context
      const newContext = await this.analyzeMessageContext(newMessage);

      // 3. Detect context switch
      const switchDetected = await this.detectContextSwitch(currentContext, newContext);

      if (switchDetected.confidence > 0.7) {
        const contextSwitch: ContextSwitch = {
          id: this.generateContextSwitchId(),
          sessionId,
          fromContext: currentContext,
          toContext: newContext,
          trigger: switchDetected,
          timestamp: new Date(),
          confidence: switchDetected.confidence,
          transitionType: this.determineTransitionType(currentContext, newContext)
        };

        // 4. Cache the context switch
        this.contextSwitchCache.set(contextSwitch.id, contextSwitch);

        // 5. Update transition history
        await this.updateTransitionHistory(sessionId, currentContext, newContext);

        console.log(`🔄 Context switch detected: ${currentContext.topic} → ${newContext.topic} (${switchDetected.confidence.toFixed(2)})`);

        return contextSwitch;
      }

      return null;

    } catch (error) {
      console.error(`❌ Error analyzing context switch: ${error}`);
      return null;
    }
  }

  /**
   * Get adaptive conversation context based on detected switches
   */
  async getAdaptiveContext(
    sessionId: string,
    query: string,
    contextSwitch?: ContextSwitch
  ): Promise<ConversationMessage[]> {
    try {
      if (!contextSwitch) {
        // No context switch - use normal retrieval
        return await this.getConversationContext(sessionId, query);
      }

      // Context switch detected - apply adaptive strategy
      const strategy = this.determineAdaptationStrategy(contextSwitch);

      switch (strategy.type) {
        case 'maintain_context':
          return await this.getMaintainedContext(sessionId, contextSwitch, strategy);

        case 'bridge_contexts':
          return await this.getBridgedContext(sessionId, contextSwitch, strategy);

        case 'reset_context':
          return await this.getResetContext(sessionId, contextSwitch, strategy);

        case 'merge_contexts':
          return await this.getMergedContext(sessionId, contextSwitch, strategy);

        default:
          return await this.getConversationContext(sessionId, query);
      }

    } catch (error) {
      console.error(`❌ Error getting adaptive context: ${error}`);
      return await this.getConversationContext(sessionId, query);
    }
  }

  /**
   * Update topic model for better context prediction
   */
  async updateTopicModel(sessionId: string, messages: ConversationMessage[]): Promise<void> {
    try {
      let topicModel = this.topicModelCache.get(sessionId);

      if (!topicModel) {
        topicModel = {
          sessionId,
          topics: [],
          topicTransitions: [],
          lastUpdated: new Date()
        };
      }

      // Extract topics from messages
      const extractedTopics = await this.extractTopics(messages);

      // Update topic model
      topicModel.topics = this.mergeTopics(topicModel.topics, extractedTopics);
      topicModel.topicTransitions = await this.updateTopicTransitions(topicModel.topics, messages);
      topicModel.lastUpdated = new Date();

      this.topicModelCache.set(sessionId, topicModel);

      console.log(`📊 Updated topic model for session ${sessionId}: ${topicModel.topics.length} topics`);

    } catch (error) {
      console.error(`❌ Error updating topic model: ${error}`);
    }
  }

  // ===== CONTEXT ANALYSIS METHODS =====

  private async analyzeCurrentContext(
    sessionId: string,
    messages: ConversationMessage[]
  ): Promise<ConversationContext> {
    if (messages.length === 0) {
      return this.createEmptyContext(sessionId);
    }

    const recentMessages = messages.slice(-5); // Analyze last 5 messages
    const entities = await this.extractEntities(recentMessages);
    const keywords = this.extractKeywords(recentMessages);
    const topic = await this.identifyTopic(recentMessages, keywords);
    const sentiment = this.analyzeSentiment(recentMessages);
    const intent = await this.analyzeIntent(recentMessages);

    return {
      id: this.generateContextId(),
      topic,
      domain: this.determineDomain(keywords, entities),
      entities,
      sentiment,
      complexity: this.assessComplexity(recentMessages),
      intent,
      keywords,
      startTime: new Date(messages[0].timestamp),
      messageCount: messages.length
    };
  }

  private async analyzeMessageContext(message: ConversationMessage): Promise<ConversationContext> {
    const entities = await this.extractEntities([message]);
    const keywords = this.extractKeywords([message]);
    const topic = await this.identifyTopic([message], keywords);
    const sentiment = this.analyzeSentiment([message]);
    const intent = await this.analyzeIntent([message]);

    return {
      id: this.generateContextId(),
      topic,
      domain: this.determineDomain(keywords, entities),
      entities,
      sentiment,
      complexity: this.assessComplexity([message]),
      intent,
      keywords,
      startTime: new Date(message.timestamp),
      messageCount: 1
    };
  }

  private async detectContextSwitch(
    currentContext: ConversationContext,
    newContext: ConversationContext
  ): Promise<ContextSwitchTrigger> {
    const evidence: string[] = [];
    let confidence = 0;
    let triggerType: ContextSwitchTrigger['type'] = 'topic_drift';

    // 1. Topic similarity check
    const topicSimilarity = this.calculateTopicSimilarity(currentContext.topic, newContext.topic);
    if (topicSimilarity < 0.3) {
      evidence.push(`Topic change: ${currentContext.topic} → ${newContext.topic}`);
      confidence += 0.4;
      triggerType = 'topic_drift';
    }

    // 2. Entity overlap check
    const entityOverlap = this.calculateEntityOverlap(currentContext.entities, newContext.entities);
    if (entityOverlap < 0.2) {
      evidence.push(`Entity shift: ${entityOverlap.toFixed(2)} overlap`);
      confidence += 0.3;
      triggerType = 'entity_change';
    }

    // 3. Intent change check
    if (currentContext.intent !== newContext.intent) {
      evidence.push(`Intent change: ${currentContext.intent} → ${newContext.intent}`);
      confidence += 0.2;
      triggerType = 'user_intent';
    }

    // 4. Domain change check
    if (currentContext.domain !== newContext.domain) {
      evidence.push(`Domain change: ${currentContext.domain} → ${newContext.domain}`);
      confidence += 0.1;
    }

    // 5. Explicit indicators
    const explicitIndicators = ['let\'s talk about', 'switching to', 'now about', 'different topic'];
    const hasExplicitIndicator = explicitIndicators.some(indicator =>
      newContext.keywords.some(keyword => keyword.toLowerCase().includes(indicator))
    );

    if (hasExplicitIndicator) {
      evidence.push('Explicit context change indicator detected');
      confidence += 0.5;
      triggerType = 'explicit_change';
    }

    return {
      type: triggerType,
      confidence: Math.min(confidence, 1.0),
      evidence
    };
  }

  // ===== ADAPTATION STRATEGIES =====

  private determineAdaptationStrategy(contextSwitch: ContextSwitch): AdaptationStrategy {
    const { fromContext, toContext, transitionType, confidence } = contextSwitch;

    switch (transitionType) {
      case 'smooth':
        return {
          type: 'bridge_contexts',
          memoryRetention: 0.8,
          contextBlending: 0.7,
          priority: 'balanced'
        };

      case 'related':
        return {
          type: 'merge_contexts',
          memoryRetention: 0.9,
          contextBlending: 0.8,
          priority: 'current'
        };

      case 'abrupt':
        return confidence > 0.8 ? {
          type: 'reset_context',
          memoryRetention: 0.3,
          contextBlending: 0.2,
          priority: 'current'
        } : {
          type: 'maintain_context',
          memoryRetention: 0.7,
          contextBlending: 0.5,
          priority: 'previous'
        };

      case 'unrelated':
        return {
          type: 'reset_context',
          memoryRetention: 0.2,
          contextBlending: 0.1,
          priority: 'current'
        };

      default:
        return {
          type: 'maintain_context',
          memoryRetention: 0.7,
          contextBlending: 0.5,
          priority: 'balanced'
        };
    }
  }

  private async getMaintainedContext(
    sessionId: string,
    contextSwitch: ContextSwitch,
    strategy: AdaptationStrategy
  ): Promise<ConversationMessage[]> {
    // Keep most of the previous context
    const recentMessages = await this.getBufferMessages(sessionId);
    const contextSize = Math.floor(recentMessages.length * strategy.memoryRetention);

    return recentMessages.slice(-contextSize);
  }

  private async getBridgedContext(
    sessionId: string,
    contextSwitch: ContextSwitch,
    strategy: AdaptationStrategy
  ): Promise<ConversationMessage[]> {
    // Blend previous and new context
    const recentMessages = await this.getBufferMessages(sessionId);
    const previousContextMessages = recentMessages.slice(0, Math.floor(recentMessages.length * 0.6));

    // Get relevant messages from new context
    const relevantMessages = await this.getRelevantMessages(
      sessionId,
      contextSwitch.toContext.keywords.join(' '),
      3
    );

    return [...previousContextMessages, ...relevantMessages];
  }

  private async getResetContext(
    sessionId: string,
    contextSwitch: ContextSwitch,
    strategy: AdaptationStrategy
  ): Promise<ConversationMessage[]> {
    // Start fresh with minimal previous context
    const recentMessages = await this.getBufferMessages(sessionId);
    const minimalContext = recentMessages.slice(-2); // Only last 2 messages

    // Add summary if available
    const summary = await this.getConversationSummary(sessionId);
    if (summary) {
      return [{
        role: 'system',
        content: `Previous conversation summary: ${summary.summary}`,
        timestamp: new Date().toISOString(),
        metadata: { type: 'context_summary' }
      }, ...minimalContext];
    }

    return minimalContext;
  }

  private async getMergedContext(
    sessionId: string,
    contextSwitch: ContextSwitch,
    strategy: AdaptationStrategy
  ): Promise<ConversationMessage[]> {
    // Intelligently merge contexts
    const recentMessages = await this.getBufferMessages(sessionId);

    // Get messages related to both contexts
    const fromContextMessages = await this.getContextRelatedMessages(
      sessionId,
      contextSwitch.fromContext,
      3
    );

    const toContextMessages = await this.getContextRelatedMessages(
      sessionId,
      contextSwitch.toContext,
      2
    );

    // Merge and deduplicate
    const mergedMessages = this.mergeAndDeduplicateMessages([
      ...fromContextMessages,
      ...toContextMessages,
      ...recentMessages.slice(-3)
    ]);

    return mergedMessages;
  }

  // ===== UTILITY METHODS =====

  private createEmptyContext(sessionId: string): ConversationContext {
    return {
      id: this.generateContextId(),
      topic: 'general',
      domain: 'general',
      entities: [],
      sentiment: 'neutral',
      complexity: 'low',
      intent: 'conversation',
      keywords: [],
      startTime: new Date(),
      messageCount: 0
    };
  }

  private async extractEntities(messages: ConversationMessage[]): Promise<Entity[]> {
    // Simplified entity extraction - would use NLP service
    const entities: Entity[] = [];
    const text = messages.map(m => m.content).join(' ');

    // Basic entity patterns
    const patterns = {
      person: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
      organization: /\b[A-Z][A-Z\s&]+\b/g,
      technology: /\b(JavaScript|Python|React|Node\.js|AI|ML|API)\b/gi
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern) || [];
      for (const match of matches) {
        entities.push({
          text: match,
          type: type as Entity['type'],
          confidence: 0.8,
          mentions: 1
        });
      }
    }

    return entities;
  }

  private extractKeywords(messages: ConversationMessage[]): string[] {
    const text = messages.map(m => m.content).join(' ').toLowerCase();
    const words = text.split(/\W+/).filter(word => word.length > 3);

    // Remove common stop words
    const stopWords = new Set(['that', 'this', 'with', 'from', 'they', 'been', 'have', 'your', 'what', 'when', 'where', 'will', 'there']);
    const keywords = words.filter(word => !stopWords.has(word));

    // Get most frequent keywords
    const frequency: Record<string, number> = {};
    keywords.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private async identifyTopic(messages: ConversationMessage[], keywords: string[]): Promise<string> {
    // Simplified topic identification
    const topicKeywords = {
      programming: ['code', 'function', 'javascript', 'python', 'development'],
      education: ['learn', 'study', 'course', 'university', 'school'],
      business: ['company', 'market', 'sales', 'business', 'strategy'],
      technology: ['technology', 'software', 'system', 'digital', 'computer']
    };

    for (const [topic, topicWords] of Object.entries(topicKeywords)) {
      const matches = keywords.filter(keyword =>
        topicWords.some(topicWord => keyword.includes(topicWord))
      );

      if (matches.length >= 2) {
        return topic;
      }
    }

    return 'general';
  }

  private analyzeSentiment(messages: ConversationMessage[]): 'positive' | 'negative' | 'neutral' {
    // Simplified sentiment analysis
    const text = messages.map(m => m.content).join(' ').toLowerCase();

    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'like', 'helpful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'problem', 'error'];

    const positiveCount = positiveWords.reduce((count, word) =>
      count + (text.match(new RegExp(word, 'g')) || []).length, 0
    );

    const negativeCount = negativeWords.reduce((count, word) =>
      count + (text.match(new RegExp(word, 'g')) || []).length, 0
    );

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private async analyzeIntent(messages: ConversationMessage[]): Promise<string> {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return 'general';

    const content = lastMessage.content.toLowerCase();

    if (content.includes('?')) return 'question';
    if (content.includes('help') || content.includes('how')) return 'assistance';
    if (content.includes('explain') || content.includes('what')) return 'explanation';
    if (content.includes('create') || content.includes('make')) return 'creation';

    return 'conversation';
  }

  private determineDomain(keywords: string[], entities: Entity[]): string {
    const domainKeywords = {
      technology: ['tech', 'software', 'code', 'programming', 'computer'],
      academic: ['university', 'research', 'study', 'academic', 'education'],
      business: ['business', 'company', 'market', 'sales', 'finance'],
      personal: ['personal', 'life', 'family', 'friend', 'hobby']
    };

    for (const [domain, domainWords] of Object.entries(domainKeywords)) {
      const matches = keywords.filter(keyword =>
        domainWords.some(domainWord => keyword.includes(domainWord))
      );

      if (matches.length >= 1) {
        return domain;
      }
    }

    return 'general';
  }

  private assessComplexity(messages: ConversationMessage[]): 'low' | 'medium' | 'high' {
    const text = messages.map(m => m.content).join(' ');
    const avgWordLength = text.split(' ').reduce((sum, word) => sum + word.length, 0) / text.split(' ').length;
    const sentenceLength = text.split(/[.!?]/).length;

    if (avgWordLength > 6 && sentenceLength > 3) return 'high';
    if (avgWordLength > 4 || sentenceLength > 2) return 'medium';
    return 'low';
  }

  private calculateTopicSimilarity(topic1: string, topic2: string): number {
    if (topic1 === topic2) return 1.0;

    // Simple Jaccard similarity on topic words
    const words1 = new Set(topic1.split(' '));
    const words2 = new Set(topic2.split(' '));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private calculateEntityOverlap(entities1: Entity[], entities2: Entity[]): number {
    if (entities1.length === 0 && entities2.length === 0) return 1.0;
    if (entities1.length === 0 || entities2.length === 0) return 0.0;

    const set1 = new Set(entities1.map(e => e.text.toLowerCase()));
    const set2 = new Set(entities2.map(e => e.text.toLowerCase()));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private determineTransitionType(
    fromContext: ConversationContext,
    toContext: ConversationContext
  ): ContextSwitch['transitionType'] {
    const topicSimilarity = this.calculateTopicSimilarity(fromContext.topic, toContext.topic);
    const entityOverlap = this.calculateEntityOverlap(fromContext.entities, toContext.entities);
    const domainSame = fromContext.domain === toContext.domain;

    if (topicSimilarity > 0.7 && entityOverlap > 0.5) return 'smooth';
    if (domainSame && (topicSimilarity > 0.3 || entityOverlap > 0.2)) return 'related';
    if (topicSimilarity < 0.2 && entityOverlap < 0.1) return 'unrelated';

    return 'abrupt';
  }

  private async updateTransitionHistory(
    sessionId: string,
    fromContext: ConversationContext,
    toContext: ConversationContext
  ): Promise<void> {
    const transitions = this.contextTransitions.get(sessionId) || [];

    const transition: ContextTransition = {
      id: this.generateTransitionId(),
      sessionId,
      messageIndex: 0, // Would track actual message index
      previousContext: fromContext,
      newContext: toContext,
      transitionScore: this.calculateTopicSimilarity(fromContext.topic, toContext.topic),
      adaptationStrategy: this.determineAdaptationStrategy({
        id: '',
        sessionId,
        fromContext,
        toContext,
        trigger: { type: 'topic_drift', confidence: 0.8, evidence: [] },
        timestamp: new Date(),
        confidence: 0.8,
        transitionType: this.determineTransitionType(fromContext, toContext)
      }),
      timestamp: new Date()
    };

    transitions.push(transition);
    this.contextTransitions.set(sessionId, transitions.slice(-20)); // Keep last 20 transitions
  }

  private async extractTopics(messages: ConversationMessage[]): Promise<Topic[]> {
    // Simplified topic extraction - would use advanced NLP
    const topics: Topic[] = [];

    // Group messages by similarity and extract topics
    const messageGroups = this.groupMessagesBySimilarity(messages);

    for (const group of messageGroups) {
      const keywords = this.extractKeywords(group);
      const topicName = await this.identifyTopic(group, keywords);

      topics.push({
        id: this.generateTopicId(),
        name: topicName,
        keywords: keywords.slice(0, 5),
        prevalence: group.length / messages.length,
        coherence: 0.8, // Would calculate actual coherence
        messages: group.map(m => m.content)
      });
    }

    return topics;
  }

  private mergeTopics(existingTopics: Topic[], newTopics: Topic[]): Topic[] {
    // Merge similar topics and update statistics
    const merged = [...existingTopics];

    for (const newTopic of newTopics) {
      const existingTopic = merged.find(t =>
        this.calculateTopicSimilarity(t.name, newTopic.name) > 0.8
      );

      if (existingTopic) {
        // Merge with existing topic
        existingTopic.keywords = [...new Set([...existingTopic.keywords, ...newTopic.keywords])].slice(0, 10);
        existingTopic.messages.push(...newTopic.messages);
        existingTopic.prevalence = (existingTopic.prevalence + newTopic.prevalence) / 2;
      } else {
        // Add as new topic
        merged.push(newTopic);
      }
    }

    return merged;
  }

  private async updateTopicTransitions(topics: Topic[], messages: ConversationMessage[]): Promise<TopicTransition[]> {
    // Analyze topic transitions in conversation flow
    const transitions: TopicTransition[] = [];

    // Would implement actual transition analysis
    return transitions;
  }

  private async getRelevantMessages(
    sessionId: string,
    query: string,
    limit: number
  ): Promise<ConversationMessage[]> {
    const searchResults = await this.semanticSearch(sessionId, query, limit);
    return searchResults.map(result => ({
      role: result.role as 'user' | 'assistant',
      content: result.content,
      timestamp: result.timestamp,
      metadata: { relevanceScore: result.relevanceScore }
    }));
  }

  private async getContextRelatedMessages(
    sessionId: string,
    context: ConversationContext,
    limit: number
  ): Promise<ConversationMessage[]> {
    const query = `${context.topic} ${context.keywords.join(' ')}`;
    return await this.getRelevantMessages(sessionId, query, limit);
  }

  private mergeAndDeduplicateMessages(messages: ConversationMessage[]): ConversationMessage[] {
    const seen = new Set<string>();
    const unique: ConversationMessage[] = [];

    for (const message of messages) {
      const key = `${message.content}_${message.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(message);
      }
    }

    return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private groupMessagesBySimilarity(messages: ConversationMessage[]): ConversationMessage[][] {
    // Simplified grouping - would use advanced clustering
    const groups: ConversationMessage[][] = [];

    // For now, group by time windows
    const timeWindow = 10 * 60 * 1000; // 10 minutes
    let currentGroup: ConversationMessage[] = [];
    let lastTimestamp = 0;

    for (const message of messages) {
      const timestamp = new Date(message.timestamp).getTime();

      if (timestamp - lastTimestamp > timeWindow && currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }

      currentGroup.push(message);
      lastTimestamp = timestamp;
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  // ID Generators
  private generateContextSwitchId(): string {
    return `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateContextId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTransitionId(): string {
    return `tr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTopicId(): string {
    return `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== PUBLIC API FOR CONTEXT SWITCHING =====

  public async getContextSwitchHistory(sessionId: string): Promise<ContextSwitch[]> {
    return Array.from(this.contextSwitchCache.values())
      .filter(cs => cs.sessionId === sessionId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);
  }

  public async getTopicModel(sessionId: string): Promise<TopicModel | null> {
    return this.topicModelCache.get(sessionId) || null;
  }

  public async getContextTransitions(sessionId: string): Promise<ContextTransition[]> {
    return this.contextTransitions.get(sessionId) || [];
  }

  public async clearContextSwitchCache(sessionId: string): Promise<void> {
    // Remove all context switches for session
    const toRemove = Array.from(this.contextSwitchCache.entries())
      .filter(([_, cs]) => cs.sessionId === sessionId)
      .map(([id]) => id);

    toRemove.forEach(id => this.contextSwitchCache.delete(id));

    // Clear other caches
    this.topicModelCache.delete(sessionId);
    this.contextTransitions.delete(sessionId);

    console.log(`🧹 Cleared context switch cache for session ${sessionId}`);
  }
}

export const memoryService = new MemoryService(); 