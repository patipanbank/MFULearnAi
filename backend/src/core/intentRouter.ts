/**
 * 🧭 Intent Router & Classification System
 *
 * Advanced intent classification และ routing system สำหรับ MFU Learn AI
 * - Intent classification ด้วย LangChain
 * - Smart agent selection based on task type
 * - Conditional workflow routing
 * - Multi-step task coordination
 */

import { ChatBedrockConverse } from '@langchain/aws';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

// ================== INTENT TYPES ==================

export enum TaskIntent {
  // Knowledge & Information
  KNOWLEDGE_SEARCH = 'knowledge_search',
  ACADEMIC_QUESTION = 'academic_question',
  RESEARCH_ASSISTANCE = 'research_assistance',

  // Technical & Programming
  CODE_ASSISTANCE = 'code_assistance',
  DEBUGGING_HELP = 'debugging_help',
  TECHNICAL_EXPLANATION = 'technical_explanation',

  // Creative & Content
  WRITING_ASSISTANCE = 'writing_assistance',
  CONTENT_CREATION = 'content_creation',
  CREATIVE_BRAINSTORMING = 'creative_brainstorming',

  // Analysis & Problem Solving
  DATA_ANALYSIS = 'data_analysis',
  PROBLEM_SOLVING = 'problem_solving',
  MATHEMATICAL_CALCULATION = 'mathematical_calculation',

  // Communication & Language
  TRANSLATION = 'translation',
  LANGUAGE_LEARNING = 'language_learning',
  COMMUNICATION_HELP = 'communication_help',

  // General & Conversation
  GENERAL_CONVERSATION = 'general_conversation',
  CLARIFICATION_REQUEST = 'clarification_request',
  FOLLOW_UP_QUESTION = 'follow_up_question',

  // Meta & System
  SYSTEM_COMMAND = 'system_command',
  AGENT_SELECTION = 'agent_selection',
  UNKNOWN = 'unknown'
}

export enum AgentType {
  ADVANCED_REASONING = 'advanced_reasoning',
  SIMPLIFIED_MODERN = 'simplified_modern',
  SPECIALIZED_KNOWLEDGE = 'specialized_knowledge',
  CODE_ASSISTANT = 'code_assistant',
  CREATIVE_WRITER = 'creative_writer',
  RESEARCH_ANALYST = 'research_analyst',
  GENERAL_ASSISTANT = 'general_assistant'
}

export enum WorkflowComplexity {
  SIMPLE = 'simple',           // Single agent, direct response
  MODERATE = 'moderate',       // Single agent, multiple tools
  COMPLEX = 'complex',         // Multiple steps, reasoning required
  COLLABORATIVE = 'collaborative' // Multiple agents, coordination needed
}

// ================== INTERFACES ==================

export interface IntentClassificationResult {
  primaryIntent: TaskIntent;
  confidence: number;
  secondaryIntents: TaskIntent[];
  reasoning: string;
  suggestedAgent: AgentType;
  workflowComplexity: WorkflowComplexity;
  requiredTools: string[];
  estimatedSteps: number;
  metadata: {
    hasContext: boolean;
    requiresReasoning: boolean;
    requiresKnowledge: boolean;
    requiresCalculation: boolean;
    requiresCreativity: boolean;
    isFollowUp: boolean;
  };
}

export interface RoutingDecision {
  selectedAgent: AgentType;
  agentConfig: any;
  workflowSteps: WorkflowStep[];
  toolRequirements: string[];
  reasoning: string;
  executionStrategy: ExecutionStrategy;
}

export interface WorkflowStep {
  stepId: string;
  stepType: 'analysis' | 'search' | 'reasoning' | 'generation' | 'verification';
  agentType: AgentType;
  requiredTools: string[];
  dependencies: string[];
  estimatedDuration: number;
  description: string;
}

export enum ExecutionStrategy {
  DIRECT = 'direct',           // Go straight to selected agent
  SEQUENTIAL = 'sequential',   // Execute steps in order
  PARALLEL = 'parallel',      // Execute compatible steps simultaneously
  ADAPTIVE = 'adaptive'       // Adapt based on intermediate results
}

// ================== INTENT ROUTER CLASS ==================

export class IntentRouter {
  private llm: ChatBedrockConverse;
  private conversationHistory: Map<string, BaseMessage[]> = new Map();

  constructor() {
    this.llm = new ChatBedrockConverse({
      model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      region: process.env.AWS_REGION || 'us-east-1',
      temperature: 0.1, // Low temperature for consistent classification
      maxTokens: 1000
    });

    console.log('🧭 Intent Router initialized');
  }

  /**
   * Classify user intent using advanced LangChain-based analysis
   */
  async classifyIntent(
    input: string,
    sessionId: string,
    previousMessages?: BaseMessage[]
  ): Promise<IntentClassificationResult> {
    console.log(`🧭 Classifying intent for session ${sessionId}: "${input.substring(0, 50)}..."`);

    try {
      // Build context-aware classification prompt
      const classificationPrompt = this.buildClassificationPrompt(input, previousMessages);

      const messages = [new SystemMessage(classificationPrompt), new HumanMessage(input)];

      const response = await this.llm.invoke(messages);
      const result = this.parseClassificationResponse(response.content as string);

      // Store context for future classifications
      this.updateConversationHistory(sessionId, input, result);

      console.log(`✅ Intent classified: ${result.primaryIntent} (confidence: ${result.confidence})`);
      return result;

    } catch (error) {
      console.error('❌ Intent classification failed:', error);
      return this.getFallbackClassification(input);
    }
  }

  /**
   * Route to appropriate agent based on classification
   */
  async routeToAgent(classification: IntentClassificationResult): Promise<RoutingDecision> {
    console.log(`🧭 Routing intent: ${classification.primaryIntent} to agent`);

    // Agent selection based on intent
    const selectedAgent = this.selectOptimalAgent(classification);

    // Generate workflow steps
    const workflowSteps = this.generateWorkflowSteps(classification, selectedAgent);

    // Determine execution strategy
    const executionStrategy = this.determineExecutionStrategy(classification, workflowSteps);

    // Build agent configuration
    const agentConfig = this.buildAgentConfig(classification, selectedAgent);

    const decision: RoutingDecision = {
      selectedAgent,
      agentConfig,
      workflowSteps,
      toolRequirements: classification.requiredTools,
      reasoning: `Selected ${selectedAgent} for ${classification.primaryIntent} with ${classification.workflowComplexity} complexity`,
      executionStrategy
    };

    console.log(`✅ Routed to ${selectedAgent} with ${executionStrategy} strategy`);
    return decision;
  }

  /**
   * Execute conditional workflow based on routing decision
   */
  async executeConditionalFlow(
    decision: RoutingDecision,
    input: string,
    context: any
  ): Promise<WorkflowStep[]> {
    console.log(`🧭 Executing ${decision.executionStrategy} workflow with ${decision.workflowSteps.length} steps`);

    const executedSteps: WorkflowStep[] = [];

    switch (decision.executionStrategy) {
      case ExecutionStrategy.DIRECT:
        // Single step execution
        executedSteps.push(...decision.workflowSteps);
        break;

      case ExecutionStrategy.SEQUENTIAL:
        // Execute steps in order
        for (const step of decision.workflowSteps) {
          executedSteps.push(await this.executeWorkflowStep(step, context));
        }
        break;

      case ExecutionStrategy.PARALLEL:
        // Execute compatible steps simultaneously
        const parallelGroups = this.groupParallelSteps(decision.workflowSteps);
        for (const group of parallelGroups) {
          const groupResults = await Promise.all(
            group.map(step => this.executeWorkflowStep(step, context))
          );
          executedSteps.push(...groupResults);
        }
        break;

      case ExecutionStrategy.ADAPTIVE:
        // Adapt based on results
        executedSteps.push(...await this.executeAdaptiveWorkflow(decision.workflowSteps, context));
        break;
    }

    console.log(`✅ Executed workflow with ${executedSteps.length} completed steps`);
    return executedSteps;
  }

  // ================== PRIVATE METHODS ==================

  private buildClassificationPrompt(input: string, previousMessages?: BaseMessage[]): string {
    let prompt = `# Intent Classification System

You are an advanced intent classifier for an AI learning platform. Analyze the user's input and classify it into one of the predefined intent categories.

## Available Intent Categories:

### Knowledge & Information
- KNOWLEDGE_SEARCH: Looking for specific information or facts
- ACADEMIC_QUESTION: Academic subjects, coursework, educational content
- RESEARCH_ASSISTANCE: Research help, citations, methodology

### Technical & Programming
- CODE_ASSISTANCE: Programming help, code writing, algorithms
- DEBUGGING_HELP: Fixing bugs, troubleshooting code issues
- TECHNICAL_EXPLANATION: Understanding technical concepts

### Creative & Content
- WRITING_ASSISTANCE: Help with writing, editing, proofreading
- CONTENT_CREATION: Creating articles, stories, marketing content
- CREATIVE_BRAINSTORMING: Idea generation, creative thinking

### Analysis & Problem Solving
- DATA_ANALYSIS: Analyzing data, statistics, trends
- PROBLEM_SOLVING: General problem solving, decision making
- MATHEMATICAL_CALCULATION: Math problems, calculations

### Communication & Language
- TRANSLATION: Language translation needs
- LANGUAGE_LEARNING: Learning new languages
- COMMUNICATION_HELP: Improving communication skills

### General & Conversation
- GENERAL_CONVERSATION: Casual conversation, general questions
- CLARIFICATION_REQUEST: Asking for clarification on previous responses
- FOLLOW_UP_QUESTION: Following up on previous topics

## Classification Instructions:

Respond with a JSON object containing:
- primaryIntent: The main intent category
- confidence: Confidence level (0.0-1.0)
- secondaryIntents: Array of related intents (max 2)
- reasoning: Brief explanation of classification decision
- suggestedAgent: Recommended agent type
- workflowComplexity: SIMPLE/MODERATE/COMPLEX/COLLABORATIVE
- requiredTools: Array of tools likely needed
- estimatedSteps: Number of steps expected (1-5)
- metadata: Object with boolean flags for task characteristics

## Agent Types Available:
- ADVANCED_REASONING: Complex reasoning, analysis, multi-step problems
- SIMPLIFIED_MODERN: General assistance, straightforward questions
- SPECIALIZED_KNOWLEDGE: Domain-specific knowledge, academic content
- CODE_ASSISTANT: Programming, debugging, technical development
- CREATIVE_WRITER: Writing, content creation, creative tasks
- RESEARCH_ANALYST: Research, data analysis, investigation
- GENERAL_ASSISTANT: General conversation, simple questions`;

    // Add conversation context if available
    if (previousMessages && previousMessages.length > 0) {
      const contextSummary = previousMessages.slice(-4).map(msg =>
        `${msg instanceof HumanMessage ? 'User' : 'Assistant'}: ${(msg.content as string).substring(0, 100)}`
      ).join('\n');

      prompt += `\n\n## Recent Conversation Context:
${contextSummary}

Consider this context when classifying the current input. Look for follow-up questions, clarifications, or continuation of previous topics.`;
    }

    prompt += `\n\n## Examples:

Input: "How do I write a Python function to calculate fibonacci numbers?"
Output: {
  "primaryIntent": "CODE_ASSISTANCE",
  "confidence": 0.95,
  "secondaryIntents": ["TECHNICAL_EXPLANATION"],
  "reasoning": "User needs help writing a specific programming function",
  "suggestedAgent": "CODE_ASSISTANT",
  "workflowComplexity": "MODERATE",
  "requiredTools": ["web_search", "calculator"],
  "estimatedSteps": 2,
  "metadata": {
    "hasContext": false,
    "requiresReasoning": true,
    "requiresKnowledge": true,
    "requiresCalculation": false,
    "requiresCreativity": false,
    "isFollowUp": false
  }
}

Now classify this input and respond with the JSON object only:`;

    return prompt;
  }

  private parseClassificationResponse(response: string): IntentClassificationResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize the response
      return {
        primaryIntent: parsed.primaryIntent || TaskIntent.UNKNOWN,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        secondaryIntents: Array.isArray(parsed.secondaryIntents) ? parsed.secondaryIntents : [],
        reasoning: parsed.reasoning || 'No reasoning provided',
        suggestedAgent: parsed.suggestedAgent || AgentType.GENERAL_ASSISTANT,
        workflowComplexity: parsed.workflowComplexity || WorkflowComplexity.SIMPLE,
        requiredTools: Array.isArray(parsed.requiredTools) ? parsed.requiredTools : [],
        estimatedSteps: Math.max(1, Math.min(5, parsed.estimatedSteps || 1)),
        metadata: {
          hasContext: parsed.metadata?.hasContext || false,
          requiresReasoning: parsed.metadata?.requiresReasoning || false,
          requiresKnowledge: parsed.metadata?.requiresKnowledge || false,
          requiresCalculation: parsed.metadata?.requiresCalculation || false,
          requiresCreativity: parsed.metadata?.requiresCreativity || false,
          isFollowUp: parsed.metadata?.isFollowUp || false
        }
      };
    } catch (error) {
      console.error('❌ Failed to parse classification response:', error);
      return this.getFallbackClassification(response);
    }
  }

  private getFallbackClassification(input: string): IntentClassificationResult {
    // Simple heuristic-based fallback
    const lowerInput = input.toLowerCase();

    let primaryIntent = TaskIntent.GENERAL_CONVERSATION;
    let suggestedAgent = AgentType.GENERAL_ASSISTANT;

    if (lowerInput.includes('code') || lowerInput.includes('program') || lowerInput.includes('function')) {
      primaryIntent = TaskIntent.CODE_ASSISTANCE;
      suggestedAgent = AgentType.CODE_ASSISTANT;
    } else if (lowerInput.includes('write') || lowerInput.includes('essay') || lowerInput.includes('article')) {
      primaryIntent = TaskIntent.WRITING_ASSISTANCE;
      suggestedAgent = AgentType.CREATIVE_WRITER;
    } else if (lowerInput.includes('research') || lowerInput.includes('analyze') || lowerInput.includes('study')) {
      primaryIntent = TaskIntent.RESEARCH_ASSISTANCE;
      suggestedAgent = AgentType.RESEARCH_ANALYST;
    } else if (lowerInput.includes('calculate') || lowerInput.includes('math') || lowerInput.includes('solve')) {
      primaryIntent = TaskIntent.MATHEMATICAL_CALCULATION;
      suggestedAgent = AgentType.ADVANCED_REASONING;
    }

    return {
      primaryIntent,
      confidence: 0.6,
      secondaryIntents: [],
      reasoning: 'Fallback classification based on keyword matching',
      suggestedAgent,
      workflowComplexity: WorkflowComplexity.SIMPLE,
      requiredTools: [],
      estimatedSteps: 1,
      metadata: {
        hasContext: false,
        requiresReasoning: false,
        requiresKnowledge: false,
        requiresCalculation: false,
        requiresCreativity: false,
        isFollowUp: false
      }
    };
  }

  private selectOptimalAgent(classification: IntentClassificationResult): AgentType {
    // Use suggested agent from classification, with validation
    const suggestedAgent = classification.suggestedAgent;

    // Validate agent availability and override if needed
    switch (classification.primaryIntent) {
      case TaskIntent.CODE_ASSISTANCE:
      case TaskIntent.DEBUGGING_HELP:
      case TaskIntent.TECHNICAL_EXPLANATION:
        return AgentType.CODE_ASSISTANT;

      case TaskIntent.WRITING_ASSISTANCE:
      case TaskIntent.CONTENT_CREATION:
      case TaskIntent.CREATIVE_BRAINSTORMING:
        return AgentType.CREATIVE_WRITER;

      case TaskIntent.RESEARCH_ASSISTANCE:
      case TaskIntent.DATA_ANALYSIS:
        return AgentType.RESEARCH_ANALYST;

      case TaskIntent.PROBLEM_SOLVING:
      case TaskIntent.MATHEMATICAL_CALCULATION:
        return classification.workflowComplexity === WorkflowComplexity.COMPLEX ?
          AgentType.ADVANCED_REASONING : AgentType.SIMPLIFIED_MODERN;

      case TaskIntent.KNOWLEDGE_SEARCH:
      case TaskIntent.ACADEMIC_QUESTION:
        return AgentType.SPECIALIZED_KNOWLEDGE;

      default:
        return classification.workflowComplexity === WorkflowComplexity.COMPLEX ?
          AgentType.ADVANCED_REASONING : AgentType.SIMPLIFIED_MODERN;
    }
  }

  private generateWorkflowSteps(
    classification: IntentClassificationResult,
    selectedAgent: AgentType
  ): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    // Generate steps based on complexity and intent
    switch (classification.workflowComplexity) {
      case WorkflowComplexity.SIMPLE:
        steps.push({
          stepId: 'direct_response',
          stepType: 'generation',
          agentType: selectedAgent,
          requiredTools: classification.requiredTools,
          dependencies: [],
          estimatedDuration: 30000, // 30 seconds
          description: 'Direct response generation'
        });
        break;

      case WorkflowComplexity.MODERATE:
        if (classification.metadata.requiresKnowledge) {
          steps.push({
            stepId: 'knowledge_search',
            stepType: 'search',
            agentType: selectedAgent,
            requiredTools: ['search_knowledge', 'web_search'],
            dependencies: [],
            estimatedDuration: 15000,
            description: 'Search for relevant knowledge'
          });
        }

        steps.push({
          stepId: 'process_and_respond',
          stepType: 'generation',
          agentType: selectedAgent,
          requiredTools: classification.requiredTools,
          dependencies: classification.metadata.requiresKnowledge ? ['knowledge_search'] : [],
          estimatedDuration: 45000,
          description: 'Process information and generate response'
        });
        break;

      case WorkflowComplexity.COMPLEX:
        steps.push({
          stepId: 'analysis',
          stepType: 'analysis',
          agentType: selectedAgent,
          requiredTools: [],
          dependencies: [],
          estimatedDuration: 20000,
          description: 'Analyze problem complexity'
        });

        if (classification.metadata.requiresKnowledge) {
          steps.push({
            stepId: 'knowledge_gathering',
            stepType: 'search',
            agentType: selectedAgent,
            requiredTools: ['search_knowledge', 'web_search'],
            dependencies: ['analysis'],
            estimatedDuration: 30000,
            description: 'Gather necessary knowledge'
          });
        }

        steps.push({
          stepId: 'reasoning',
          stepType: 'reasoning',
          agentType: selectedAgent,
          requiredTools: classification.requiredTools,
          dependencies: ['analysis', ...(classification.metadata.requiresKnowledge ? ['knowledge_gathering'] : [])],
          estimatedDuration: 60000,
          description: 'Apply reasoning to problem'
        });

        steps.push({
          stepId: 'verification',
          stepType: 'verification',
          agentType: selectedAgent,
          requiredTools: ['self_reflection'],
          dependencies: ['reasoning'],
          estimatedDuration: 15000,
          description: 'Verify and refine solution'
        });
        break;

      case WorkflowComplexity.COLLABORATIVE:
        // Multi-agent workflow (future implementation)
        steps.push({
          stepId: 'coordinator_analysis',
          stepType: 'analysis',
          agentType: AgentType.ADVANCED_REASONING,
          requiredTools: [],
          dependencies: [],
          estimatedDuration: 30000,
          description: 'Coordinate multi-agent approach'
        });
        break;
    }

    return steps;
  }

  private determineExecutionStrategy(
    classification: IntentClassificationResult,
    steps: WorkflowStep[]
  ): ExecutionStrategy {
    if (steps.length === 1) {
      return ExecutionStrategy.DIRECT;
    }

    if (classification.workflowComplexity === WorkflowComplexity.COLLABORATIVE) {
      return ExecutionStrategy.ADAPTIVE;
    }

    // Check if steps can be parallelized
    const hasParallelizableSteps = steps.some(step =>
      step.dependencies.length === 0 && steps.filter(s => s.dependencies.length === 0).length > 1
    );

    if (hasParallelizableSteps) {
      return ExecutionStrategy.PARALLEL;
    }

    return ExecutionStrategy.SEQUENTIAL;
  }

  private buildAgentConfig(
    classification: IntentClassificationResult,
    selectedAgent: AgentType
  ): any {
    const baseConfig = {
      reasoningMode: classification.workflowComplexity === WorkflowComplexity.COMPLEX ? 'auto-cot' : 'cot',
      maxIterations: classification.estimatedSteps + 1,
      enableReflection: classification.metadata.requiresReasoning,
      temperature: this.getTemperatureForIntent(classification.primaryIntent)
    };

    // Agent-specific configurations
    switch (selectedAgent) {
      case AgentType.ADVANCED_REASONING:
        return {
          ...baseConfig,
          reasoningMode: 'tree-of-thoughts',
          enableSelfConsistency: true,
          maxIterations: Math.max(3, classification.estimatedSteps)
        };

      case AgentType.CREATIVE_WRITER:
        return {
          ...baseConfig,
          temperature: 0.8,
          enableReflection: false
        };

      case AgentType.CODE_ASSISTANT:
        return {
          ...baseConfig,
          temperature: 0.3,
          maxIterations: Math.max(2, classification.estimatedSteps)
        };

      default:
        return baseConfig;
    }
  }

  private getTemperatureForIntent(intent: TaskIntent): number {
    switch (intent) {
      case TaskIntent.CREATIVE_BRAINSTORMING:
      case TaskIntent.CONTENT_CREATION:
      case TaskIntent.WRITING_ASSISTANCE:
        return 0.8;

      case TaskIntent.CODE_ASSISTANCE:
      case TaskIntent.DEBUGGING_HELP:
      case TaskIntent.MATHEMATICAL_CALCULATION:
        return 0.3;

      case TaskIntent.PROBLEM_SOLVING:
      case TaskIntent.RESEARCH_ASSISTANCE:
        return 0.5;

      default:
        return 0.7;
    }
  }

  private updateConversationHistory(sessionId: string, input: string, result: IntentClassificationResult): void {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }

    const history = this.conversationHistory.get(sessionId)!;
    history.push(new HumanMessage(input));

    // Keep only last 10 messages for context
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  private async executeWorkflowStep(step: WorkflowStep, context: any): Promise<WorkflowStep> {
    // Placeholder for actual step execution
    console.log(`🔄 Executing workflow step: ${step.stepId} (${step.stepType})`);

    // Add execution timestamp
    return {
      ...step,
      description: `${step.description} - Executed at ${new Date().toISOString()}`
    };
  }

  private groupParallelSteps(steps: WorkflowStep[]): WorkflowStep[][] {
    const groups: WorkflowStep[][] = [];
    const processed = new Set<string>();

    for (const step of steps) {
      if (processed.has(step.stepId)) continue;

      const group = [step];
      processed.add(step.stepId);

      // Find steps that can run in parallel (no dependencies on each other)
      for (const otherStep of steps) {
        if (processed.has(otherStep.stepId)) continue;
        if (!otherStep.dependencies.includes(step.stepId) &&
            !step.dependencies.includes(otherStep.stepId)) {
          group.push(otherStep);
          processed.add(otherStep.stepId);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private async executeAdaptiveWorkflow(steps: WorkflowStep[], context: any): Promise<WorkflowStep[]> {
    // Placeholder for adaptive execution logic
    console.log(`🔄 Executing adaptive workflow with ${steps.length} steps`);

    const executedSteps: WorkflowStep[] = [];
    for (const step of steps) {
      executedSteps.push(await this.executeWorkflowStep(step, context));
    }

    return executedSteps;
  }

  /**
   * Clean up conversation history for session
   */
  public cleanupSession(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
    console.log(`🧹 Cleaned up intent router history for session: ${sessionId}`);
  }

  /**
   * Get router statistics
   */
  public getStatistics(): any {
    return {
      activeSessions: this.conversationHistory.size,
      totalHistoryEntries: Array.from(this.conversationHistory.values()).reduce((sum, history) => sum + history.length, 0)
    };
  }
}

// Export singleton instance
export const intentRouter = new IntentRouter();