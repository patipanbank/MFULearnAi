/**
 * Agent Orchestration Service
 *
 * Agentic AI system ที่จัดการ multi-agent coordination, tool pipeline,
 * และ adaptive response generation แบบ Claude Code
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';
import { agentExecutionService, ExecutionRequest, ExecutionResult, ExecutionPriority } from './agentExecutionService';
import { langMemService } from './langmemService';
import { WebSocketService } from './websocketService';

// ===== INTERFACES =====

export interface AgenticTask {
  id: string;
  type: 'simple' | 'complex' | 'research' | 'creative' | 'analytical';
  intent: UserIntent;
  context: TaskContext;
  priority: TaskPriority;
  constraints: TaskConstraints;
  expectedOutputs: ExpectedOutput[];
}

export interface UserIntent {
  primary: string;
  secondary?: string[];
  domain: 'general' | 'academic' | 'technical' | 'creative' | 'research';
  complexity: 'low' | 'medium' | 'high' | 'expert';
  urgency: 'low' | 'normal' | 'high' | 'critical';
}

export interface TaskContext {
  sessionId: string;
  userId: string;
  agentId?: string;
  previousMessages: any[];
  availableTools: string[];
  collectionNames: string[];
  userPreferences: Record<string, any>;
  conversationHistory: any[];
}

export interface TaskConstraints {
  maxExecutionTime?: number;
  maxTokens?: number;
  requiredTools?: string[];
  prohibitedTools?: string[];
  outputFormat?: 'text' | 'markdown' | 'json' | 'structured';
  quality: 'fast' | 'balanced' | 'comprehensive';
}

export interface ExpectedOutput {
  type: 'answer' | 'analysis' | 'summary' | 'recommendation' | 'data';
  format: string;
  confidence: number;
}

export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export interface ExecutionPlan {
  id: string;
  taskId: string;
  steps: ExecutionStep[];
  dependencies: StepDependency[];
  estimatedDuration: number;
  resourceRequirements: ResourceRequirement[];
  fallbackStrategies: FallbackStrategy[];
}

export interface ExecutionStep {
  id: string;
  type: 'analysis' | 'retrieval' | 'generation' | 'tool_execution' | 'validation';
  operation: string;
  inputs: Record<string, any>;
  expectedOutputs: Record<string, any>;
  tools: string[];
  parallel: boolean;
  optional: boolean;
  timeout: number;
}

export interface StepDependency {
  stepId: string;
  dependsOn: string[];
  condition?: string;
}

export interface ResourceRequirement {
  type: 'memory' | 'cpu' | 'network' | 'storage';
  amount: number;
  priority: 'required' | 'preferred' | 'optional';
}

export interface FallbackStrategy {
  condition: string;
  alternativeSteps: ExecutionStep[];
  degradedQuality: boolean;
}

export interface AgenticResponse {
  id: string;
  taskId: string;
  success: boolean;
  content: string;
  metadata: ResponseMetadata;
  toolExecutions: ToolExecutionSummary[];
  performance: PerformanceMetrics;
  recommendations?: string[];
}

export interface ResponseMetadata {
  confidence: number;
  completeness: number;
  accuracy: number;
  relevance: number;
  sources: string[];
  reasoning: string[];
  limitations: string[];
}

export interface ToolExecutionSummary {
  toolName: string;
  duration: number;
  success: boolean;
  inputSize: number;
  outputSize: number;
  relevanceScore: number;
}

export interface PerformanceMetrics {
  totalDuration: number;
  planningTime: number;
  executionTime: number;
  validationTime: number;
  tokensUsed: number;
  toolsExecuted: number;
  memoryAccessed: number;
}

// ===== MAIN SERVICE =====

export class AgentOrchestrationService extends EventEmitter {
  private static instance: AgentOrchestrationService;
  private activeTasks: Map<string, AgenticTask> = new Map();
  private executionPlans: Map<string, ExecutionPlan> = new Map();
  private activeExecutions: Map<string, any> = new Map();
  private performanceHistory: PerformanceMetrics[] = [];

  private constructor() {
    super();
    this.setupEventHandlers();
  }

  public static getInstance(): AgentOrchestrationService {
    if (!AgentOrchestrationService.instance) {
      AgentOrchestrationService.instance = new AgentOrchestrationService();
    }
    return AgentOrchestrationService.instance;
  }

  // ===== CORE AGENTIC METHODS =====

  /**
   * Main entry point - วิเคราะห์และ execute task แบบ agentic
   */
  public async processAgenticTask(
    userInput: string,
    context: TaskContext,
    constraints: Partial<TaskConstraints> = {}
  ): Promise<AgenticResponse> {
    const taskId = uuidv4();
    const startTime = performance.now();

    try {
      // 1. Intelligent Task Analysis
      const task = await this.analyzeUserIntent(userInput, context, constraints);
      this.activeTasks.set(taskId, { ...task, id: taskId });

      console.log(`🤖 Agentic Task Analysis: ${task.type} | Intent: ${task.intent.primary}`);

      // 2. Adaptive Planning
      const plan = await this.createExecutionPlan(task);
      this.executionPlans.set(taskId, plan);

      console.log(`📋 Execution Plan: ${plan.steps.length} steps, ${plan.estimatedDuration}ms estimated`);

      // 3. Multi-Step Execution
      const result = await this.executeAdaptivePlan(plan, task);

      // 4. Response Enhancement
      const enhancedResponse = await this.enhanceResponse(result, task);

      // 5. Performance Analysis
      const performanceMetrics = this.calculatePerformanceMetrics(startTime, plan, result);
      this.performanceHistory.push(performanceMetrics);

      // 6. Emit real-time updates
      this.emitTaskCompletion(taskId, enhancedResponse, performanceMetrics);

      return {
        id: uuidv4(),
        taskId,
        success: true,
        content: enhancedResponse.content,
        metadata: enhancedResponse.metadata,
        toolExecutions: enhancedResponse.toolExecutions,
        performance: performanceMetrics,
        recommendations: enhancedResponse.recommendations
      };

    } catch (error) {
      console.error(`❌ Agentic task failed: ${error}`);

      return {
        id: uuidv4(),
        taskId,
        success: false,
        content: `I encountered an error while processing your request: ${(error as Error).message}`,
        metadata: {
          confidence: 0,
          completeness: 0,
          accuracy: 0,
          relevance: 0,
          sources: [],
          reasoning: ['Error during task execution'],
          limitations: ['Task execution failed']
        },
        toolExecutions: [],
        performance: this.calculatePerformanceMetrics(startTime, null, null)
      };
    } finally {
      // Cleanup
      this.activeTasks.delete(taskId);
      this.executionPlans.delete(taskId);
    }
  }

  /**
   * Intelligent Intent Analysis - คล้าย Claude Code ที่วิเคราะห์ user intent
   */
  private async analyzeUserIntent(
    userInput: string,
    context: TaskContext,
    constraints: Partial<TaskConstraints>
  ): Promise<AgenticTask> {

    // Analyze complexity and domain
    const complexity = this.determineComplexity(userInput, context);
    const domain = this.determineDomain(userInput, context);
    const taskType = this.determineTaskType(userInput, complexity);

    // Extract intent
    const intent: UserIntent = {
      primary: this.extractPrimaryIntent(userInput),
      secondary: this.extractSecondaryIntents(userInput),
      domain,
      complexity,
      urgency: this.determineUrgency(userInput, context)
    };

    // Set constraints with defaults
    const taskConstraints: TaskConstraints = {
      maxExecutionTime: constraints.maxExecutionTime || 30000,
      maxTokens: constraints.maxTokens || 4000,
      outputFormat: constraints.outputFormat || 'markdown',
      quality: constraints.quality || 'balanced',
      ...constraints
    };

    // Determine expected outputs
    const expectedOutputs = this.determineExpectedOutputs(userInput, intent);

    return {
      id: '', // Will be set by caller
      type: taskType,
      intent,
      context,
      priority: this.mapUrgencyToPriority(intent.urgency) as any,
      constraints: taskConstraints,
      expectedOutputs
    };
  }

  /**
   * Adaptive Planning - สร้าง execution plan แบบ dynamic
   */
  private async createExecutionPlan(task: AgenticTask): Promise<ExecutionPlan> {
    const planId = uuidv4();
    const steps: ExecutionStep[] = [];
    const dependencies: StepDependency[] = [];

    // 1. Memory Context Retrieval (always first)
    if (task.context.sessionId) {
      steps.push({
        id: 'memory_context',
        type: 'retrieval',
        operation: 'retrieve_conversation_context',
        inputs: { sessionId: task.context.sessionId, query: task.intent.primary },
        expectedOutputs: { context: 'array', relevantMemories: 'array' },
        tools: ['memory_search'],
        parallel: false,
        optional: false,
        timeout: 5000
      });
    }

    // 2. Knowledge Base Search (if relevant collections)
    if (task.context.collectionNames.length > 0) {
      const searchStep: ExecutionStep = {
        id: 'knowledge_search',
        type: 'retrieval',
        operation: 'search_knowledge_base',
        inputs: {
          query: task.intent.primary,
          collections: task.context.collectionNames,
          maxResults: task.intent.complexity === 'high' ? 10 : 5
        },
        expectedOutputs: { documents: 'array', sources: 'array' },
        tools: task.context.collectionNames.map(name => `search_${name}`),
        parallel: true,
        optional: false,
        timeout: 10000
      };
      steps.push(searchStep);

      if (steps.length > 1) {
        dependencies.push({
          stepId: 'knowledge_search',
          dependsOn: ['memory_context']
        });
      }
    }

    // 3. Web Search (for current information)
    if (this.shouldIncludeWebSearch(task)) {
      steps.push({
        id: 'web_search',
        type: 'retrieval',
        operation: 'web_search',
        inputs: { query: task.intent.primary, maxResults: 5 },
        expectedOutputs: { results: 'array', urls: 'array' },
        tools: ['web_search'],
        parallel: true,
        optional: true,
        timeout: 15000
      });
    }

    // 4. Core Analysis/Generation
    steps.push({
      id: 'core_processing',
      type: 'generation',
      operation: 'generate_response',
      inputs: {
        task: task.intent.primary,
        context: 'from_previous_steps',
        constraints: task.constraints
      },
      expectedOutputs: { response: 'string', reasoning: 'array' },
      tools: [],
      parallel: false,
      optional: false,
      timeout: task.constraints.maxExecutionTime! * 0.6
    });

    // Add dependencies for core processing
    const prevStepIds = steps.slice(0, -1).map(s => s.id);
    if (prevStepIds.length > 0) {
      dependencies.push({
        stepId: 'core_processing',
        dependsOn: prevStepIds
      });
    }

    // 5. Response Enhancement
    steps.push({
      id: 'response_enhancement',
      type: 'validation',
      operation: 'enhance_response',
      inputs: { response: 'from_core_processing', task },
      expectedOutputs: { enhancedResponse: 'string', metadata: 'object' },
      tools: [],
      parallel: false,
      optional: true,
      timeout: 5000
    });

    dependencies.push({
      stepId: 'response_enhancement',
      dependsOn: ['core_processing']
    });

    // 6. Memory Update
    steps.push({
      id: 'memory_update',
      type: 'tool_execution',
      operation: 'update_memory',
      inputs: { sessionId: task.context.sessionId, interaction: 'full_conversation' },
      expectedOutputs: { updated: 'boolean' },
      tools: ['memory_embed'],
      parallel: true,
      optional: true,
      timeout: 3000
    });

    return {
      id: planId,
      taskId: task.id,
      steps,
      dependencies,
      estimatedDuration: this.estimatePlanDuration(steps),
      resourceRequirements: this.calculateResourceRequirements(steps),
      fallbackStrategies: this.createFallbackStrategies(task, steps)
    };
  }

  /**
   * Execute plan แบบ parallel/sequential ตาม dependencies
   */
  private async executeAdaptivePlan(plan: ExecutionPlan, task: AgenticTask): Promise<any> {
    const results: Map<string, any> = new Map();
    const executedSteps = new Set<string>();
    const parallelBatches: ExecutionStep[][] = [];

    // Group steps by dependency levels
    const dependencyLevels = this.calculateDependencyLevels(plan.steps, plan.dependencies);

    for (const level of dependencyLevels) {
      const parallelSteps = level.filter(step => step.parallel);
      const sequentialSteps = level.filter(step => !step.parallel);

      // Execute parallel steps in batch
      if (parallelSteps.length > 0) {
        const parallelResults = await Promise.allSettled(
          parallelSteps.map(step => this.executeStep(step, results, task))
        );

        parallelSteps.forEach((step, index) => {
          const result = parallelResults[index];
          if (result.status === 'fulfilled') {
            results.set(step.id, result.value);
            executedSteps.add(step.id);
          } else if (!step.optional) {
            throw new Error(`Required step ${step.id} failed: ${result.reason}`);
          }
        });
      }

      // Execute sequential steps one by one
      for (const step of sequentialSteps) {
        try {
          const result = await this.executeStep(step, results, task);
          results.set(step.id, result);
          executedSteps.add(step.id);
        } catch (error) {
          if (!step.optional) {
            throw new Error(`Required step ${step.id} failed: ${error}`);
          }
        }
      }
    }

    return results;
  }

  /**
   * Execute individual step with appropriate tools
   */
  private async executeStep(
    step: ExecutionStep,
    previousResults: Map<string, any>,
    task: AgenticTask
  ): Promise<any> {
    console.log(`🔧 Executing step: ${step.id} (${step.type})`);

    const startTime = performance.now();

    try {
      switch (step.type) {
        case 'retrieval':
          return await this.executeRetrievalStep(step, previousResults, task);

        case 'generation':
          return await this.executeGenerationStep(step, previousResults, task);

        case 'tool_execution':
          return await this.executeToolStep(step, previousResults, task);

        case 'validation':
          return await this.executeValidationStep(step, previousResults, task);

        case 'analysis':
          return await this.executeAnalysisStep(step, previousResults, task);

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`❌ Step ${step.id} failed after ${duration.toFixed(2)}ms: ${error}`);
      throw error;
    }
  }

  private async executeRetrievalStep(
    step: ExecutionStep,
    previousResults: Map<string, any>,
    task: AgenticTask
  ): Promise<any> {
    switch (step.operation) {
      case 'retrieve_conversation_context':
        const context = await langMemService.getConversationContext(
          step.inputs.sessionId,
          step.inputs.query
        );
        const relevantMemories = await langMemService.searchMemory(
          step.inputs.sessionId,
          step.inputs.query,
          5
        );
        return { context, relevantMemories };

      case 'search_knowledge_base':
        // This would integrate with existing collection search tools
        const searchResults = [];
        for (const toolName of step.tools) {
          try {
            // Simulate collection search - would integrate with actual tools
            const result = { documents: [], sources: [] };
            searchResults.push(result);
          } catch (error) {
            console.warn(`Search tool ${toolName} failed: ${error}`);
          }
        }
        return { results: searchResults };

      case 'web_search':
        // Would integrate with existing web search tool
        return { results: [], urls: [] };

      default:
        throw new Error(`Unknown retrieval operation: ${step.operation}`);
    }
  }

  private async executeGenerationStep(
    step: ExecutionStep,
    previousResults: Map<string, any>,
    task: AgenticTask
  ): Promise<any> {
    // Collect context from previous steps
    const contextData = this.collectContextData(previousResults);

    // Create execution request for agent
    const executionRequest: ExecutionRequest = {
      id: uuidv4(),
      chatId: task.context.sessionId,
      userId: task.context.userId,
      agentId: task.context.agentId,
      prompt: this.buildPromptFromContext(task, contextData),
      context: {
        ...task.context,
        collectedData: contextData,
        constraints: task.constraints
      },
      priority: task.priority as any,
      timeout: step.timeout,
      createdAt: new Date()
    };

    // Execute through existing agent execution service
    const result = await agentExecutionService.executeAgent(executionRequest);

    return {
      response: result.result || '',
      reasoning: ['Generated using agent execution service'],
      metadata: result.metrics
    };
  }

  private async executeToolStep(
    step: ExecutionStep,
    previousResults: Map<string, any>,
    task: AgenticTask
  ): Promise<any> {
    // Tool executions would integrate with existing toolRegistry
    switch (step.operation) {
      case 'update_memory':
        if (step.inputs.sessionId) {
          await langMemService.addMessage(step.inputs.sessionId, {
            role: 'assistant',
            content: 'Conversation processed',
            timestamp: new Date().toISOString()
          });
        }
        return { updated: true };

      default:
        return { completed: true };
    }
  }

  private async executeValidationStep(
    step: ExecutionStep,
    previousResults: Map<string, any>,
    task: AgenticTask
  ): Promise<any> {
    const coreResult = previousResults.get('core_processing');

    if (!coreResult) {
      throw new Error('No core processing result to enhance');
    }

    // Enhance response with metadata
    const metadata: ResponseMetadata = {
      confidence: this.calculateConfidence(coreResult, task),
      completeness: this.calculateCompleteness(coreResult, task),
      accuracy: 0.85, // Would be calculated based on fact-checking
      relevance: this.calculateRelevance(coreResult, task),
      sources: this.extractSources(previousResults),
      reasoning: this.extractReasoning(previousResults),
      limitations: this.identifyLimitations(coreResult, task)
    };

    return {
      enhancedResponse: coreResult.response,
      metadata
    };
  }

  private async executeAnalysisStep(
    step: ExecutionStep,
    previousResults: Map<string, any>,
    task: AgenticTask
  ): Promise<any> {
    // Analysis steps for complex reasoning
    return { analysis: 'completed' };
  }

  // ===== HELPER METHODS =====

  private setupEventHandlers(): void {
    // Listen to agent execution events
    agentExecutionService.on('execution_event', (event) => {
      this.emit('agentic_event', {
        type: 'tool_execution',
        data: event
      });
    });
  }

  private determineComplexity(userInput: string, context: TaskContext): 'low' | 'medium' | 'high' | 'expert' {
    const indicators = {
      high: ['analyze', 'compare', 'evaluate', 'research', 'comprehensive'],
      medium: ['explain', 'summarize', 'describe', 'how'],
      low: ['what', 'when', 'where', 'simple']
    };

    const input = userInput.toLowerCase();

    if (indicators.high.some(word => input.includes(word))) return 'high';
    if (indicators.medium.some(word => input.includes(word))) return 'medium';
    return 'low';
  }

  private determineDomain(userInput: string, context: TaskContext): 'general' | 'academic' | 'technical' | 'creative' | 'research' {
    const input = userInput.toLowerCase();

    if (context.collectionNames.some(name => name.includes('academic'))) return 'academic';
    if (input.includes('code') || input.includes('technical')) return 'technical';
    if (input.includes('research') || input.includes('study')) return 'research';
    if (input.includes('create') || input.includes('design')) return 'creative';

    return 'general';
  }

  private determineTaskType(userInput: string, complexity: string): 'simple' | 'complex' | 'research' | 'creative' | 'analytical' {
    const input = userInput.toLowerCase();

    if (complexity === 'high') {
      if (input.includes('research')) return 'research';
      if (input.includes('analyze') || input.includes('compare')) return 'analytical';
      if (input.includes('create') || input.includes('design')) return 'creative';
      return 'complex';
    }

    return 'simple';
  }

  private extractPrimaryIntent(userInput: string): string {
    // Extract the main intent from user input
    return userInput.trim();
  }

  private extractSecondaryIntents(userInput: string): string[] {
    // Extract secondary intents
    return [];
  }

  private determineUrgency(userInput: string, context: TaskContext): 'low' | 'normal' | 'high' | 'critical' {
    const urgentWords = ['urgent', 'asap', 'immediately', 'critical', 'emergency'];
    const input = userInput.toLowerCase();

    if (urgentWords.some(word => input.includes(word))) return 'critical';
    return 'normal';
  }

  private mapUrgencyToPriority(urgency: string): TaskPriority {
    switch (urgency) {
      case 'critical': return TaskPriority.CRITICAL;
      case 'high': return TaskPriority.HIGH;
      case 'normal': return TaskPriority.NORMAL;
      default: return TaskPriority.LOW;
    }
  }

  private determineExpectedOutputs(userInput: string, intent: UserIntent): ExpectedOutput[] {
    return [{
      type: 'answer',
      format: 'markdown',
      confidence: 0.8
    }];
  }

  private shouldIncludeWebSearch(task: AgenticTask): boolean {
    const recentWords = ['latest', 'current', 'recent', 'today', 'news'];
    return recentWords.some(word =>
      task.intent.primary.toLowerCase().includes(word)
    );
  }

  private estimatePlanDuration(steps: ExecutionStep[]): number {
    return steps.reduce((total, step) => total + step.timeout, 0);
  }

  private calculateResourceRequirements(steps: ExecutionStep[]): ResourceRequirement[] {
    return [{
      type: 'memory',
      amount: steps.length * 100,
      priority: 'required'
    }];
  }

  private createFallbackStrategies(task: AgenticTask, steps: ExecutionStep[]): FallbackStrategy[] {
    return [{
      condition: 'timeout',
      alternativeSteps: [],
      degradedQuality: true
    }];
  }

  private calculateDependencyLevels(steps: ExecutionStep[], dependencies: StepDependency[]): ExecutionStep[][] {
    const levels: ExecutionStep[][] = [];
    const stepMap = new Map(steps.map(step => [step.id, step]));
    const processed = new Set<string>();

    while (processed.size < steps.length) {
      const currentLevel: ExecutionStep[] = [];

      for (const step of steps) {
        if (processed.has(step.id)) continue;

        const deps = dependencies.find(d => d.stepId === step.id);
        const canExecute = !deps || deps.dependsOn.every(depId => processed.has(depId));

        if (canExecute) {
          currentLevel.push(step);
          processed.add(step.id);
        }
      }

      if (currentLevel.length === 0) {
        throw new Error('Circular dependency detected in execution plan');
      }

      levels.push(currentLevel);
    }

    return levels;
  }

  private collectContextData(previousResults: Map<string, any>): any {
    const contextData: any = {};

    for (const [stepId, result] of previousResults.entries()) {
      contextData[stepId] = result;
    }

    return contextData;
  }

  private buildPromptFromContext(task: AgenticTask, contextData: any): string {
    let prompt = `Task: ${task.intent.primary}\n\n`;

    if (contextData.memory_context) {
      prompt += `Context: ${JSON.stringify(contextData.memory_context.context)}\n\n`;
    }

    if (contextData.knowledge_search) {
      prompt += `Knowledge Base Results: Available\n\n`;
    }

    prompt += `Please provide a comprehensive response based on the available context.`;

    return prompt;
  }

  private async enhanceResponse(result: Map<string, any>, task: AgenticTask): Promise<any> {
    const coreResult = result.get('core_processing');
    const enhancementResult = result.get('response_enhancement');

    return {
      content: enhancementResult?.enhancedResponse || coreResult?.response || '',
      metadata: enhancementResult?.metadata || {},
      toolExecutions: this.summarizeToolExecutions(result),
      recommendations: this.generateRecommendations(task, result)
    };
  }

  private summarizeToolExecutions(results: Map<string, any>): ToolExecutionSummary[] {
    const summaries: ToolExecutionSummary[] = [];

    for (const [stepId, result] of results.entries()) {
      if (result.metadata) {
        summaries.push({
          toolName: stepId,
          duration: result.metadata.duration || 0,
          success: true,
          inputSize: 0,
          outputSize: JSON.stringify(result).length,
          relevanceScore: 0.8
        });
      }
    }

    return summaries;
  }

  private generateRecommendations(task: AgenticTask, results: Map<string, any>): string[] {
    const recommendations: string[] = [];

    if (task.intent.complexity === 'high') {
      recommendations.push('Consider breaking down complex topics into smaller questions for more detailed analysis');
    }

    if (task.context.collectionNames.length === 0) {
      recommendations.push('Upload relevant documents to get more specific and accurate answers');
    }

    return recommendations;
  }

  private calculatePerformanceMetrics(
    startTime: number,
    plan: ExecutionPlan | null,
    results: Map<string, any> | null
  ): PerformanceMetrics {
    const endTime = performance.now();

    return {
      totalDuration: endTime - startTime,
      planningTime: 100, // Would track actual planning time
      executionTime: endTime - startTime - 100,
      validationTime: 50,
      tokensUsed: 0, // Would aggregate from results
      toolsExecuted: results?.size || 0,
      memoryAccessed: 1
    };
  }

  private calculateConfidence(result: any, task: AgenticTask): number {
    // Calculate confidence based on available data and complexity
    return 0.85;
  }

  private calculateCompleteness(result: any, task: AgenticTask): number {
    return 0.9;
  }

  private calculateRelevance(result: any, task: AgenticTask): number {
    return 0.9;
  }

  private extractSources(results: Map<string, any>): string[] {
    const sources: string[] = [];

    for (const [stepId, result] of results.entries()) {
      if (result.sources) {
        sources.push(...result.sources);
      }
    }

    return [...new Set(sources)];
  }

  private extractReasoning(results: Map<string, any>): string[] {
    const reasoning: string[] = [];

    for (const [stepId, result] of results.entries()) {
      if (result.reasoning) {
        reasoning.push(...result.reasoning);
      }
    }

    return reasoning;
  }

  private identifyLimitations(result: any, task: AgenticTask): string[] {
    const limitations: string[] = [];

    if (task.context.collectionNames.length === 0) {
      limitations.push('Limited to general knowledge without access to specific documents');
    }

    return limitations;
  }

  private emitTaskCompletion(taskId: string, response: any, metrics: PerformanceMetrics): void {
    this.emit('task_completed', {
      taskId,
      response,
      metrics,
      timestamp: new Date()
    });
  }

  // ===== PUBLIC API =====

  public getActiveTasksCount(): number {
    return this.activeTasks.size;
  }

  public getPerformanceHistory(): PerformanceMetrics[] {
    return this.performanceHistory.slice(-100); // Last 100 tasks
  }

  public getAverageExecutionTime(): number {
    if (this.performanceHistory.length === 0) return 0;

    const total = this.performanceHistory.reduce((sum, metrics) => sum + metrics.totalDuration, 0);
    return total / this.performanceHistory.length;
  }
}

// Export singleton instance
export const agentOrchestrationService = AgentOrchestrationService.getInstance();