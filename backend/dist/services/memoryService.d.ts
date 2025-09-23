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
export declare class MemoryService {
    private bedrock;
    private readonly BUFFER_WINDOW_SIZE;
    private readonly TOKEN_LIMIT;
    private readonly SUMMARY_THRESHOLD;
    private readonly MIN_RELEVANCE_SCORE;
    private contextSwitchCache;
    private topicModelCache;
    private contextTransitions;
    constructor();
    addMessage(sessionId: string, message: ConversationMessage): Promise<void>;
    getConversationContext(sessionId: string, query?: string): Promise<ConversationMessage[]>;
    addRecentMessage(sessionId: string, message: any): Promise<void>;
    getRecentMessages(sessionId: string): Promise<any[]>;
    searchMemory(sessionId: string, query: string, k?: number): Promise<any[]>;
    private addToBuffer;
    private getBufferMessages;
    private getBufferSize;
    private clearBuffer;
    private performSummarization;
    private generateSummary;
    private extractKeyTopics;
    private updateSummary;
    private getConversationSummary;
    private addToVectorStore;
    private semanticSearch;
    private combineMessages;
    private trimToTokenLimit;
    embedMessage(sessionId: string, message: string): Promise<void>;
    getAllMessages(sessionId: string): Promise<any[]>;
    setupHybridMemory(sessionId: string, messages: any[]): Promise<void>;
    getMemoryStats(sessionId: string): Promise<any>;
    clearRecentMessages(sessionId: string): Promise<void>;
    clearLongTermMemory(sessionId: string): Promise<void>;
    clearAllMemory(sessionId: string): Promise<void>;
    forceSummarization(sessionId: string): Promise<ConversationSummary | null>;
    private setupContextSwitching;
    analyzeContextSwitch(sessionId: string, newMessage: ConversationMessage, previousMessages: ConversationMessage[]): Promise<ContextSwitch | null>;
    getAdaptiveContext(sessionId: string, query: string, contextSwitch?: ContextSwitch): Promise<ConversationMessage[]>;
    updateTopicModel(sessionId: string, messages: ConversationMessage[]): Promise<void>;
    private analyzeCurrentContext;
    private analyzeMessageContext;
    private detectContextSwitch;
    private determineAdaptationStrategy;
    private getMaintainedContext;
    private getBridgedContext;
    private getResetContext;
    private getMergedContext;
    private createEmptyContext;
    private extractEntities;
    private extractKeywords;
    private identifyTopic;
    private analyzeSentiment;
    private analyzeIntent;
    private determineDomain;
    private assessComplexity;
    private calculateTopicSimilarity;
    private calculateEntityOverlap;
    private determineTransitionType;
    private updateTransitionHistory;
    private extractTopics;
    private mergeTopics;
    private updateTopicTransitions;
    private getRelevantMessages;
    private getContextRelatedMessages;
    private mergeAndDeduplicateMessages;
    private groupMessagesBySimilarity;
    private generateContextSwitchId;
    private generateContextId;
    private generateTransitionId;
    private generateTopicId;
    getContextSwitchHistory(sessionId: string): Promise<ContextSwitch[]>;
    getTopicModel(sessionId: string): Promise<TopicModel | null>;
    getContextTransitions(sessionId: string): Promise<ContextTransition[]>;
    clearContextSwitchCache(sessionId: string): Promise<void>;
}
export declare const memoryService: MemoryService;
//# sourceMappingURL=memoryService.d.ts.map