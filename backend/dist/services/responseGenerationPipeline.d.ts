import { EventEmitter } from 'events';
export interface ResponseGenerationRequest {
    id: string;
    userInput: string;
    context: ResponseContext;
    preferences: ResponsePreferences;
    constraints: ResponseConstraints;
}
export interface ResponseContext {
    sessionId: string;
    userId: string;
    agentId?: string;
    conversationHistory: any[];
    availableData: Record<string, any>;
    userProfile: UserProfile;
    environmentContext: EnvironmentContext;
}
export interface ResponsePreferences {
    tone: 'professional' | 'casual' | 'academic' | 'friendly' | 'technical';
    detail: 'brief' | 'moderate' | 'comprehensive' | 'exhaustive';
    format: 'text' | 'markdown' | 'structured' | 'interactive';
    includeExamples: boolean;
    includeSources: boolean;
    includeVisuals: boolean;
    language: string;
}
export interface ResponseConstraints {
    maxLength: number;
    minQuality: number;
    maxGenerationTime: number;
    allowedFormats: string[];
    requiredSections: string[];
    prohibitedContent: string[];
}
export interface UserProfile {
    expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    interests: string[];
    learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
    previousInteractions: number;
    preferredComplexity: 'simple' | 'moderate' | 'complex';
}
export interface EnvironmentContext {
    platform: 'web' | 'mobile' | 'api';
    deviceType: 'desktop' | 'tablet' | 'mobile';
    screenSize: 'small' | 'medium' | 'large';
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    timezone: string;
}
export interface GeneratedResponse {
    id: string;
    content: ResponseContent;
    metadata: ResponseMetadata;
    quality: QualityMetrics;
    suggestions: ResponseSuggestion[];
}
export interface ResponseContent {
    primary: string;
    sections: ResponseSection[];
    visualElements: VisualElement[];
    interactiveElements: InteractiveElement[];
    citations: Citation[];
}
export interface ResponseSection {
    id: string;
    type: 'introduction' | 'main_content' | 'examples' | 'summary' | 'recommendations';
    title: string;
    content: string;
    importance: number;
    estimatedReadTime: number;
}
export interface VisualElement {
    type: 'chart' | 'diagram' | 'image' | 'code_block' | 'table';
    content: any;
    caption: string;
    relevance: number;
}
export interface InteractiveElement {
    type: 'quiz' | 'calculator' | 'form' | 'simulation';
    config: Record<string, any>;
    description: string;
}
export interface Citation {
    source: string;
    url?: string;
    relevance: number;
    credibility: number;
    accessDate: Date;
}
export interface ResponseMetadata {
    generationTime: number;
    confidence: number;
    completeness: number;
    accuracy: number;
    readability: number;
    engagement: number;
    toolsUsed: string[];
    dataSourcesUsed: string[];
    processingSteps: string[];
}
export interface QualityMetrics {
    overall: number;
    content: number;
    structure: number;
    relevance: number;
    clarity: number;
    usefulness: number;
    factualAccuracy: number;
}
export interface ResponseSuggestion {
    type: 'follow_up' | 'related_topic' | 'deep_dive' | 'clarification';
    text: string;
    relevance: number;
    category: string;
}
export declare class ResponseGenerationPipeline extends EventEmitter {
    private static instance;
    private activeGenerations;
    private qualityThresholds;
    private constructor();
    static getInstance(): ResponseGenerationPipeline;
    generateEnhancedResponse(request: ResponseGenerationRequest): Promise<GeneratedResponse>;
    private enrichContext;
    private parseUserIntent;
    private gatherRelevantData;
    private analyzeUserContext;
    private analyzeEnvironment;
    private createContentPlan;
    private planContentStructure;
    private planSections;
    private planVisualElements;
    private planInteractiveElements;
    private generateBaseContent;
    private generateSections;
    private generateSectionContent;
    private enhanceContent;
    private enhanceClarity;
    private enhanceStructure;
    private enhanceVisuals;
    private enhanceInteractivity;
    private assessQuality;
    private assessContentQuality;
    private assessStructuralQuality;
    private assessRelevance;
    private assessClarity;
    private assessUsefulness;
    private assessFactualAccuracy;
    private improveIfNeeded;
    private generateSuggestions;
    private setupQualityMonitoring;
    private analyzeConversationFlow;
    private getEnvironmentAdaptations;
    private getEnvironmentConstraints;
    private generateSectionTitle;
    private calculateSectionImportance;
    private shouldIncludeChart;
    private shouldIncludeCodeBlock;
    private shouldIncludeCalculator;
    private estimateContentLength;
    private extractCitations;
    private calculateReadTime;
    private extractIntroduction;
    private extractMainContent;
    private generateExamples;
    private generateSummary;
    private generateRecommendations;
    private determineComplexity;
    private calculateTargetReadability;
    private applyTextEnhancements;
    private enhanceSectionStructure;
    private enhanceVisualElement;
    private enhanceInteractiveElement;
    private assessCompleteness;
    private assessDepth;
    private assessCoherence;
    private calculateEngagement;
    private extractToolsUsed;
    private extractDataSources;
    private getProcessingSteps;
    private identifyImprovements;
    private applyImprovement;
    private generateFollowUpQuestions;
    private generateRelatedTopics;
    private generateDeepDiveTopics;
    private trackQualityMetrics;
    private getFormatAdjustments;
    private getLengthAdjustments;
    getActiveGenerationsCount(): number;
    cancelGeneration(requestId: string): Promise<boolean>;
    setQualityThreshold(level: 'minimum' | 'good' | 'excellent', value: number): void;
}
export declare const responseGenerationPipeline: ResponseGenerationPipeline;
//# sourceMappingURL=responseGenerationPipeline.d.ts.map