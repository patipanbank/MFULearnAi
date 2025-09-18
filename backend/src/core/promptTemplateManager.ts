/**
 * 📝 Prompt Template Manager
 *
 * Centralized prompt template management system for MFU Learn AI
 * - Template versioning and management
 * - Context-aware prompt generation
 * - LangChain PromptTemplate integration
 * - Dynamic variable injection
 * - A/B testing support for prompts
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { TaskIntent, AgentType, WorkflowComplexity } from './intentRouter';

// ================== TEMPLATE TYPES ==================

export enum TemplateType {
  SYSTEM_PROMPT = 'system_prompt',
  REASONING_PROMPT = 'reasoning_prompt',
  TOOL_GUIDANCE = 'tool_guidance',
  INTENT_CLASSIFICATION = 'intent_classification',
  AGENT_SPECIFIC = 'agent_specific',
  WORKFLOW_STEP = 'workflow_step',
  ERROR_HANDLING = 'error_handling'
}

export enum TemplateCategory {
  AGENT = 'agent',
  REASONING = 'reasoning',
  INTENT = 'intent',
  TOOL = 'tool',
  ERROR = 'error',
  WORKFLOW = 'workflow'
}

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  type: TemplateType;
  category: TemplateCategory;
  version: string;
  agentTypes: AgentType[];
  intents: TaskIntent[];
  complexity: WorkflowComplexity[];
  variables: TemplateVariable[];
  tags: string[];
  author: string;
  createdAt: Date;
  updatedAt: Date;
  usage_count: number;
  effectiveness_score: number;
  isActive: boolean;
  isDefault: boolean;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[];
  };
}

export interface TemplateContext {
  intent?: TaskIntent;
  agentType?: AgentType;
  complexity?: WorkflowComplexity;
  userMessage?: string;
  conversationHistory?: any[];
  tools?: string[];
  customAgent?: any;
  sessionData?: any;
  [key: string]: any;
}

export interface RenderedTemplate {
  content: string;
  metadata: TemplateMetadata;
  variables: Record<string, any>;
  renderTime: Date;
  version: string;
}

// ================== PROMPT TEMPLATE MANAGER ==================

export class PromptTemplateManager {
  private static instance: PromptTemplateManager;
  private templates: Map<string, TemplateMetadata> = new Map();
  private promptTemplates: Map<string, PromptTemplate> = new Map();
  private abTestGroups: Map<string, string[]> = new Map();
  private templateCache: Map<string, RenderedTemplate> = new Map();
  private renderStats: Map<string, { count: number; avgTime: number }> = new Map();

  private constructor() {
    this.initializeDefaultTemplates();
  }

  public static getInstance(): PromptTemplateManager {
    if (!PromptTemplateManager.instance) {
      PromptTemplateManager.instance = new PromptTemplateManager();
    }
    return PromptTemplateManager.instance;
  }

  // ================== TEMPLATE MANAGEMENT ==================

  /**
   * Register a new prompt template
   */
  public registerTemplate(
    metadata: TemplateMetadata,
    templateContent: string
  ): void {
    try {
      // Create LangChain PromptTemplate
      const variables = metadata.variables.map(v => v.name);
      const promptTemplate = PromptTemplate.fromTemplate(templateContent);

      // Store metadata and template
      this.templates.set(metadata.id, metadata);
      this.promptTemplates.set(metadata.id, promptTemplate);

      console.log(`📝 Registered template: ${metadata.id} (${metadata.version})`);
    } catch (error) {
      console.error(`❌ Failed to register template ${metadata.id}:`, error);
      throw new Error(`Template registration failed: ${error}`);
    }
  }

  /**
   * Get template by ID and version
   */
  public getTemplate(templateId: string, version?: string): TemplateMetadata | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    // Version-specific logic can be implemented here
    if (version && template.version !== version) {
      return null;
    }

    return template;
  }

  /**
   * Find templates by criteria
   */
  public findTemplates(criteria: {
    type?: TemplateType;
    category?: TemplateCategory;
    agentType?: AgentType;
    intent?: TaskIntent;
    complexity?: WorkflowComplexity;
    tags?: string[];
  }): TemplateMetadata[] {
    const results: TemplateMetadata[] = [];

    for (const template of this.templates.values()) {
      if (!template.isActive) continue;

      // Check type match
      if (criteria.type && template.type !== criteria.type) continue;

      // Check category match
      if (criteria.category && template.category !== criteria.category) continue;

      // Check agent type match
      if (criteria.agentType && !template.agentTypes.includes(criteria.agentType)) continue;

      // Check intent match
      if (criteria.intent && !template.intents.includes(criteria.intent)) continue;

      // Check complexity match
      if (criteria.complexity && !template.complexity.includes(criteria.complexity)) continue;

      // Check tags match
      if (criteria.tags && !criteria.tags.some(tag => template.tags.includes(tag))) continue;

      results.push(template);
    }

    // Sort by effectiveness score and usage
    return results.sort((a, b) =>
      (b.effectiveness_score * 0.7 + Math.log(b.usage_count + 1) * 0.3) -
      (a.effectiveness_score * 0.7 + Math.log(a.usage_count + 1) * 0.3)
    );
  }

  // ================== TEMPLATE RENDERING ==================

  /**
   * Render template with context
   */
  public async renderTemplate(
    templateId: string,
    context: TemplateContext
  ): Promise<RenderedTemplate> {
    const startTime = Date.now();

    try {
      // Get template metadata and LangChain template
      const metadata = this.templates.get(templateId);
      const promptTemplate = this.promptTemplates.get(templateId);

      if (!metadata || !promptTemplate) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Prepare variables with validation
      const variables = this.prepareVariables(metadata, context);

      // Render using LangChain PromptTemplate
      const content = await promptTemplate.format(variables);

      // Update usage statistics
      this.updateTemplateStats(templateId, Date.now() - startTime);

      const rendered: RenderedTemplate = {
        content,
        metadata,
        variables,
        renderTime: new Date(),
        version: metadata.version
      };

      console.log(`📝 Rendered template: ${templateId} (${content.length} chars)`);
      return rendered;

    } catch (error) {
      console.error(`❌ Template rendering failed for ${templateId}:`, error);
      throw new Error(`Template rendering failed: ${error}`);
    }
  }

  /**
   * Render template for specific intent and agent
   */
  public async renderForIntentAndAgent(
    intent: TaskIntent,
    agentType: AgentType,
    context: TemplateContext
  ): Promise<RenderedTemplate> {
    // Find best matching template
    const templates = this.findTemplates({
      type: TemplateType.SYSTEM_PROMPT,
      agentType,
      intent,
      complexity: context.complexity
    });

    if (templates.length === 0) {
      // Fallback to default template
      return this.renderDefaultTemplate(agentType, context);
    }

    // Use A/B testing if available
    const selectedTemplate = this.selectTemplateForABTest(templates, context);

    return this.renderTemplate(selectedTemplate.id, {
      ...context,
      intent,
      agentType
    });
  }

  /**
   * Render reasoning prompt
   */
  public async renderReasoningPrompt(
    complexity: WorkflowComplexity,
    context: TemplateContext
  ): Promise<RenderedTemplate> {
    const templates = this.findTemplates({
      type: TemplateType.REASONING_PROMPT,
      complexity: complexity
    });

    if (templates.length === 0) {
      return this.renderDefaultReasoningTemplate(complexity, context);
    }

    return this.renderTemplate(templates[0].id, {
      ...context,
      complexity
    });
  }

  // ================== A/B TESTING ==================

  /**
   * Setup A/B testing for templates
   */
  public setupABTest(testName: string, templateIds: string[]): void {
    this.abTestGroups.set(testName, templateIds);
    console.log(`🧪 Setup A/B test: ${testName} with ${templateIds.length} templates`);
  }

  /**
   * Select template for A/B testing
   */
  private selectTemplateForABTest(
    templates: TemplateMetadata[],
    context: TemplateContext
  ): TemplateMetadata {
    // Simple selection based on session ID hash
    const sessionId = context.sessionData?.sessionId || 'default';
    const hash = this.hashString(sessionId);
    const index = hash % templates.length;
    return templates[index];
  }

  // ================== HELPER METHODS ==================

  /**
   * Prepare and validate variables for template
   */
  private prepareVariables(
    metadata: TemplateMetadata,
    context: TemplateContext
  ): Record<string, any> {
    const variables: Record<string, any> = {};

    for (const variable of metadata.variables) {
      let value = context[variable.name] ?? variable.defaultValue;

      // Required variable validation
      if (variable.required && (value === undefined || value === null)) {
        throw new Error(`Required variable missing: ${variable.name}`);
      }

      // Type validation and conversion
      value = this.validateAndConvertVariable(variable, value);

      variables[variable.name] = value;
    }

    return variables;
  }

  /**
   * Validate and convert variable value
   */
  private validateAndConvertVariable(variable: TemplateVariable, value: any): any {
    if (value === undefined || value === null) return value;

    switch (variable.type) {
      case 'string':
        const strValue = String(value);
        if (variable.validation?.pattern) {
          const regex = new RegExp(variable.validation.pattern);
          if (!regex.test(strValue)) {
            throw new Error(`Variable ${variable.name} doesn't match pattern: ${variable.validation.pattern}`);
          }
        }
        if (variable.validation?.min && strValue.length < variable.validation.min) {
          throw new Error(`Variable ${variable.name} too short, minimum: ${variable.validation.min}`);
        }
        if (variable.validation?.max && strValue.length > variable.validation.max) {
          throw new Error(`Variable ${variable.name} too long, maximum: ${variable.validation.max}`);
        }
        return strValue;

      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new Error(`Variable ${variable.name} must be a number`);
        }
        if (variable.validation?.min && numValue < variable.validation.min) {
          throw new Error(`Variable ${variable.name} below minimum: ${variable.validation.min}`);
        }
        if (variable.validation?.max && numValue > variable.validation.max) {
          throw new Error(`Variable ${variable.name} above maximum: ${variable.validation.max}`);
        }
        return numValue;

      case 'boolean':
        return Boolean(value);

      case 'array':
        if (!Array.isArray(value)) {
          throw new Error(`Variable ${variable.name} must be an array`);
        }
        return value;

      case 'object':
        if (typeof value !== 'object') {
          throw new Error(`Variable ${variable.name} must be an object`);
        }
        return value;

      default:
        return value;
    }
  }

  /**
   * Update template usage statistics
   */
  private updateTemplateStats(templateId: string, renderTime: number): void {
    // Update template usage count
    const metadata = this.templates.get(templateId);
    if (metadata) {
      metadata.usage_count++;
    }

    // Update render statistics
    const stats = this.renderStats.get(templateId) || { count: 0, avgTime: 0 };
    stats.count++;
    stats.avgTime = (stats.avgTime * (stats.count - 1) + renderTime) / stats.count;
    this.renderStats.set(templateId, stats);
  }

  /**
   * Render default template
   */
  private async renderDefaultTemplate(
    agentType: AgentType,
    context: TemplateContext
  ): Promise<RenderedTemplate> {
    const defaultContent = this.getDefaultPromptForAgent(agentType);

    return {
      content: defaultContent,
      metadata: {
        id: 'default',
        name: 'Default System Prompt',
        description: 'Fallback system prompt',
        type: TemplateType.SYSTEM_PROMPT,
        category: TemplateCategory.AGENT,
        version: '1.0.0',
        agentTypes: [agentType],
        intents: [],
        complexity: [],
        variables: [],
        tags: ['default'],
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage_count: 0,
        effectiveness_score: 0.5,
        isActive: true,
        isDefault: true
      },
      variables: {},
      renderTime: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Render default reasoning template
   */
  private async renderDefaultReasoningTemplate(
    complexity: WorkflowComplexity,
    context: TemplateContext
  ): Promise<RenderedTemplate> {
    let content = '';

    switch (complexity) {
      case WorkflowComplexity.SIMPLE:
        content = `Think step by step about this problem and provide a clear, direct answer.`;
        break;
      case WorkflowComplexity.MODERATE:
        content = `Analyze this problem carefully. Consider different approaches and use tools if needed. Show your reasoning process.`;
        break;
      case WorkflowComplexity.COMPLEX:
        content = `This is a complex problem requiring deep analysis. Break it down into steps, explore multiple perspectives, and validate your reasoning at each stage.`;
        break;
      case WorkflowComplexity.COLLABORATIVE:
        content = `This problem requires collaborative thinking. Consider multiple viewpoints and coordinate different approaches to reach a comprehensive solution.`;
        break;
    }

    return {
      content,
      metadata: {
        id: 'default_reasoning',
        name: 'Default Reasoning Prompt',
        description: 'Fallback reasoning prompt',
        type: TemplateType.REASONING_PROMPT,
        category: TemplateCategory.REASONING,
        version: '1.0.0',
        agentTypes: [],
        intents: [],
        complexity: [complexity],
        variables: [],
        tags: ['default', 'reasoning'],
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        usage_count: 0,
        effectiveness_score: 0.5,
        isActive: true,
        isDefault: true
      },
      variables: {},
      renderTime: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Get default prompt for agent type
   */
  private getDefaultPromptForAgent(agentType: AgentType): string {
    const basePrompt = "You are an advanced AI assistant with sophisticated reasoning capabilities.";

    switch (agentType) {
      case AgentType.ADVANCED_REASONING:
        return `${basePrompt} You excel at complex reasoning, analysis, and problem-solving. Break down complex problems step by step and provide well-reasoned solutions.`;

      case AgentType.CODE_ASSISTANT:
        return `${basePrompt} You specialize in programming and software development. Provide clear, practical coding solutions with detailed explanations and best practices.`;

      case AgentType.CREATIVE_WRITER:
        return `${basePrompt} You specialize in creative writing and content creation. Help with ideation, structure, style, and refinement of written content.`;

      case AgentType.RESEARCH_ANALYST:
        return `${basePrompt} You specialize in research and analysis. Provide thorough, well-researched information with proper context and citations.`;

      case AgentType.SPECIALIZED_KNOWLEDGE:
        return `${basePrompt} You have access to specialized knowledge bases. Use domain-specific information to provide accurate, detailed answers.`;

      default:
        return `${basePrompt} Provide helpful, accurate, and well-reasoned responses to user questions.`;
    }
  }

  /**
   * Hash string for consistent selection
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // ================== INITIALIZATION ==================

  /**
   * Initialize default templates
   */
  private initializeDefaultTemplates(): void {
    // System prompt templates for different agent types
    this.registerTemplate({
      id: 'advanced_reasoning_system',
      name: 'Advanced Reasoning System Prompt',
      description: 'System prompt for advanced reasoning agent',
      type: TemplateType.SYSTEM_PROMPT,
      category: TemplateCategory.AGENT,
      version: '1.0.0',
      agentTypes: [AgentType.ADVANCED_REASONING],
      intents: [TaskIntent.PROBLEM_SOLVING, TaskIntent.MATHEMATICAL_CALCULATION, TaskIntent.DATA_ANALYSIS],
      complexity: [WorkflowComplexity.COMPLEX, WorkflowComplexity.COLLABORATIVE],
      variables: [
        {
          name: 'intent',
          type: 'string',
          description: 'Primary task intent',
          required: false,
          defaultValue: 'general'
        },
        {
          name: 'complexity',
          type: 'string',
          description: 'Task complexity level',
          required: false,
          defaultValue: 'moderate'
        },
        {
          name: 'tools',
          type: 'array',
          description: 'Available tools for the task',
          required: false,
          defaultValue: []
        }
      ],
      tags: ['system', 'reasoning', 'advanced'],
      author: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      usage_count: 0,
      effectiveness_score: 0.9,
      isActive: true,
      isDefault: false
    }, `You are an advanced AI assistant with sophisticated reasoning capabilities.

**Current Task Context:**
- **Primary Intent**: {intent}
- **Task Complexity**: {complexity}
- **Available Tools**: {tools}

**Advanced Reasoning Guidelines:**
- Use <thinking> tags to show your reasoning process
- Break down complex problems step by step
- Consider multiple perspectives before concluding
- Validate your reasoning at each step
- Use tools intelligently when they enhance your analysis

**Response Format:**
When responding to complex queries, structure your response using this format:

<thinking>
Your detailed reasoning process:
1. Problem analysis: What exactly is being asked?
2. Context consideration: What relevant information do I have?
3. Approach planning: What steps should I take?
4. Tool evaluation: Do I need any tools for this task?
5. Reasoning chain: Step-by-step logical progression
6. Confidence assessment: How confident am I in each step?
</thinking>

Your clear, well-reasoned response here.

Provide helpful, accurate, and well-reasoned responses. Think step-by-step and use tools intelligently when needed.`);

    this.registerTemplate({
      id: 'code_assistant_system',
      name: 'Code Assistant System Prompt',
      description: 'System prompt for code assistant agent',
      type: TemplateType.SYSTEM_PROMPT,
      category: TemplateCategory.AGENT,
      version: '1.0.0',
      agentTypes: [AgentType.CODE_ASSISTANT],
      intents: [TaskIntent.CODE_ASSISTANCE, TaskIntent.DEBUGGING_HELP, TaskIntent.TECHNICAL_EXPLANATION],
      complexity: [WorkflowComplexity.SIMPLE, WorkflowComplexity.MODERATE, WorkflowComplexity.COMPLEX],
      variables: [
        {
          name: 'programming_languages',
          type: 'array',
          description: 'Preferred programming languages',
          required: false,
          defaultValue: ['JavaScript', 'Python', 'TypeScript']
        }
      ],
      tags: ['system', 'coding', 'programming'],
      author: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      usage_count: 0,
      effectiveness_score: 0.85,
      isActive: true,
      isDefault: false
    }, `You are an expert programming assistant specializing in software development and technical problem-solving.

**Preferred Languages**: {programming_languages}

**Coding Assistant Guidelines:**
- Provide clear, well-commented code examples
- Explain the logic and approach behind solutions
- Consider best practices and potential issues
- Offer alternative solutions when appropriate
- Focus on practical, working solutions

**Code Quality Standards:**
- Write clean, readable code
- Include proper error handling
- Add meaningful comments
- Follow language-specific conventions
- Consider performance implications

**Response Structure:**
1. Brief explanation of the approach
2. Code implementation with comments
3. Explanation of key concepts
4. Alternative approaches if applicable
5. Testing suggestions

Provide clear, practical coding solutions with detailed explanations.`);

    console.log('📝 Initialized default prompt templates');
  }

  // ================== PUBLIC API ==================

  /**
   * Get template statistics
   */
  public getStatistics(): any {
    return {
      totalTemplates: this.templates.size,
      activeTemplates: Array.from(this.templates.values()).filter(t => t.isActive).length,
      renderStats: Object.fromEntries(this.renderStats),
      abTestGroups: this.abTestGroups.size,
      cacheSize: this.templateCache.size
    };
  }

  /**
   * Clear template cache
   */
  public clearCache(): void {
    this.templateCache.clear();
    console.log('🧹 Cleared template cache');
  }

  /**
   * Update template effectiveness score
   */
  public updateEffectivenessScore(templateId: string, score: number): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.effectiveness_score = Math.max(0, Math.min(1, score));
      template.updatedAt = new Date();
      console.log(`📊 Updated effectiveness score for ${templateId}: ${score}`);
    }
  }
}

// Export singleton instance
export const promptTemplateManager = PromptTemplateManager.getInstance();