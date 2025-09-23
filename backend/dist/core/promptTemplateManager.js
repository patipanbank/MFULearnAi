"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptTemplateManager = exports.PromptTemplateManager = exports.TemplateCategory = exports.TemplateType = void 0;
const prompts_1 = require("@langchain/core/prompts");
const intentRouter_1 = require("./intentRouter");
var TemplateType;
(function (TemplateType) {
    TemplateType["SYSTEM_PROMPT"] = "system_prompt";
    TemplateType["REASONING_PROMPT"] = "reasoning_prompt";
    TemplateType["TOOL_GUIDANCE"] = "tool_guidance";
    TemplateType["INTENT_CLASSIFICATION"] = "intent_classification";
    TemplateType["AGENT_SPECIFIC"] = "agent_specific";
    TemplateType["WORKFLOW_STEP"] = "workflow_step";
    TemplateType["ERROR_HANDLING"] = "error_handling";
})(TemplateType || (exports.TemplateType = TemplateType = {}));
var TemplateCategory;
(function (TemplateCategory) {
    TemplateCategory["AGENT"] = "agent";
    TemplateCategory["REASONING"] = "reasoning";
    TemplateCategory["INTENT"] = "intent";
    TemplateCategory["TOOL"] = "tool";
    TemplateCategory["ERROR"] = "error";
    TemplateCategory["WORKFLOW"] = "workflow";
})(TemplateCategory || (exports.TemplateCategory = TemplateCategory = {}));
class PromptTemplateManager {
    constructor() {
        this.templates = new Map();
        this.promptTemplates = new Map();
        this.abTestGroups = new Map();
        this.templateCache = new Map();
        this.renderStats = new Map();
        this.initializeDefaultTemplates();
    }
    static getInstance() {
        if (!PromptTemplateManager.instance) {
            PromptTemplateManager.instance = new PromptTemplateManager();
        }
        return PromptTemplateManager.instance;
    }
    registerTemplate(metadata, templateContent) {
        try {
            const variables = metadata.variables.map(v => v.name);
            const promptTemplate = prompts_1.PromptTemplate.fromTemplate(templateContent);
            this.templates.set(metadata.id, metadata);
            this.promptTemplates.set(metadata.id, promptTemplate);
            console.log(`📝 Registered template: ${metadata.id} (${metadata.version})`);
        }
        catch (error) {
            console.error(`❌ Failed to register template ${metadata.id}:`, error);
            throw new Error(`Template registration failed: ${error}`);
        }
    }
    getTemplate(templateId, version) {
        const template = this.templates.get(templateId);
        if (!template)
            return null;
        if (version && template.version !== version) {
            return null;
        }
        return template;
    }
    findTemplates(criteria) {
        const results = [];
        for (const template of this.templates.values()) {
            if (!template.isActive)
                continue;
            if (criteria.type && template.type !== criteria.type)
                continue;
            if (criteria.category && template.category !== criteria.category)
                continue;
            if (criteria.agentType && !template.agentTypes.includes(criteria.agentType))
                continue;
            if (criteria.intent && !template.intents.includes(criteria.intent))
                continue;
            if (criteria.complexity && !template.complexity.includes(criteria.complexity))
                continue;
            if (criteria.tags && !criteria.tags.some(tag => template.tags.includes(tag)))
                continue;
            results.push(template);
        }
        return results.sort((a, b) => (b.effectiveness_score * 0.7 + Math.log(b.usage_count + 1) * 0.3) -
            (a.effectiveness_score * 0.7 + Math.log(a.usage_count + 1) * 0.3));
    }
    async renderTemplate(templateId, context) {
        const startTime = Date.now();
        try {
            const metadata = this.templates.get(templateId);
            const promptTemplate = this.promptTemplates.get(templateId);
            if (!metadata || !promptTemplate) {
                throw new Error(`Template not found: ${templateId}`);
            }
            const variables = this.prepareVariables(metadata, context);
            const content = await promptTemplate.format(variables);
            this.updateTemplateStats(templateId, Date.now() - startTime);
            const rendered = {
                content,
                metadata,
                variables,
                renderTime: new Date(),
                version: metadata.version
            };
            console.log(`📝 Rendered template: ${templateId} (${content.length} chars)`);
            return rendered;
        }
        catch (error) {
            console.error(`❌ Template rendering failed for ${templateId}:`, error);
            throw new Error(`Template rendering failed: ${error}`);
        }
    }
    async renderForIntentAndAgent(intent, agentType, context) {
        const templates = this.findTemplates({
            type: TemplateType.SYSTEM_PROMPT,
            agentType,
            intent,
            complexity: context.complexity
        });
        if (templates.length === 0) {
            return this.renderDefaultTemplate(agentType, context);
        }
        const selectedTemplate = this.selectTemplateForABTest(templates, context);
        return this.renderTemplate(selectedTemplate.id, {
            ...context,
            intent,
            agentType
        });
    }
    async renderReasoningPrompt(complexity, context) {
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
    setupABTest(testName, templateIds) {
        this.abTestGroups.set(testName, templateIds);
        console.log(`🧪 Setup A/B test: ${testName} with ${templateIds.length} templates`);
    }
    selectTemplateForABTest(templates, context) {
        const sessionId = context.sessionData?.sessionId || 'default';
        const hash = this.hashString(sessionId);
        const index = hash % templates.length;
        return templates[index];
    }
    prepareVariables(metadata, context) {
        const variables = {};
        for (const variable of metadata.variables) {
            let value = context[variable.name] ?? variable.defaultValue;
            if (variable.required && (value === undefined || value === null)) {
                throw new Error(`Required variable missing: ${variable.name}`);
            }
            value = this.validateAndConvertVariable(variable, value);
            variables[variable.name] = value;
        }
        return variables;
    }
    validateAndConvertVariable(variable, value) {
        if (value === undefined || value === null)
            return value;
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
    updateTemplateStats(templateId, renderTime) {
        const metadata = this.templates.get(templateId);
        if (metadata) {
            metadata.usage_count++;
        }
        const stats = this.renderStats.get(templateId) || { count: 0, avgTime: 0 };
        stats.count++;
        stats.avgTime = (stats.avgTime * (stats.count - 1) + renderTime) / stats.count;
        this.renderStats.set(templateId, stats);
    }
    async renderDefaultTemplate(agentType, context) {
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
    async renderDefaultReasoningTemplate(complexity, context) {
        let content = '';
        switch (complexity) {
            case intentRouter_1.WorkflowComplexity.SIMPLE:
                content = `Think step by step about this problem and provide a clear, direct answer.`;
                break;
            case intentRouter_1.WorkflowComplexity.MODERATE:
                content = `Analyze this problem carefully. Consider different approaches and use tools if needed. Show your reasoning process.`;
                break;
            case intentRouter_1.WorkflowComplexity.COMPLEX:
                content = `This is a complex problem requiring deep analysis. Break it down into steps, explore multiple perspectives, and validate your reasoning at each stage.`;
                break;
            case intentRouter_1.WorkflowComplexity.COLLABORATIVE:
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
    getDefaultPromptForAgent(agentType) {
        const basePrompt = "You are an advanced AI assistant with sophisticated reasoning capabilities.";
        switch (agentType) {
            case intentRouter_1.AgentType.ADVANCED_REASONING:
                return `${basePrompt} You excel at complex reasoning, analysis, and problem-solving. Break down complex problems step by step and provide well-reasoned solutions.`;
            case intentRouter_1.AgentType.CODE_ASSISTANT:
                return `${basePrompt} You specialize in programming and software development. Provide clear, practical coding solutions with detailed explanations and best practices.`;
            case intentRouter_1.AgentType.CREATIVE_WRITER:
                return `${basePrompt} You specialize in creative writing and content creation. Help with ideation, structure, style, and refinement of written content.`;
            case intentRouter_1.AgentType.RESEARCH_ANALYST:
                return `${basePrompt} You specialize in research and analysis. Provide thorough, well-researched information with proper context and citations.`;
            case intentRouter_1.AgentType.SPECIALIZED_KNOWLEDGE:
                return `${basePrompt} You have access to specialized knowledge bases. Use domain-specific information to provide accurate, detailed answers.`;
            default:
                return `${basePrompt} Provide helpful, accurate, and well-reasoned responses to user questions.`;
        }
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    initializeDefaultTemplates() {
        this.registerTemplate({
            id: 'advanced_reasoning_system',
            name: 'Advanced Reasoning System Prompt',
            description: 'System prompt for advanced reasoning agent',
            type: TemplateType.SYSTEM_PROMPT,
            category: TemplateCategory.AGENT,
            version: '1.0.0',
            agentTypes: [intentRouter_1.AgentType.ADVANCED_REASONING],
            intents: [intentRouter_1.TaskIntent.PROBLEM_SOLVING, intentRouter_1.TaskIntent.MATHEMATICAL_CALCULATION, intentRouter_1.TaskIntent.DATA_ANALYSIS],
            complexity: [intentRouter_1.WorkflowComplexity.COMPLEX, intentRouter_1.WorkflowComplexity.COLLABORATIVE],
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
            agentTypes: [intentRouter_1.AgentType.CODE_ASSISTANT],
            intents: [intentRouter_1.TaskIntent.CODE_ASSISTANCE, intentRouter_1.TaskIntent.DEBUGGING_HELP, intentRouter_1.TaskIntent.TECHNICAL_EXPLANATION],
            complexity: [intentRouter_1.WorkflowComplexity.SIMPLE, intentRouter_1.WorkflowComplexity.MODERATE, intentRouter_1.WorkflowComplexity.COMPLEX],
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
    getStatistics() {
        return {
            totalTemplates: this.templates.size,
            activeTemplates: Array.from(this.templates.values()).filter(t => t.isActive).length,
            renderStats: Object.fromEntries(this.renderStats),
            abTestGroups: this.abTestGroups.size,
            cacheSize: this.templateCache.size
        };
    }
    clearCache() {
        this.templateCache.clear();
        console.log('🧹 Cleared template cache');
    }
    updateEffectivenessScore(templateId, score) {
        const template = this.templates.get(templateId);
        if (template) {
            template.effectiveness_score = Math.max(0, Math.min(1, score));
            template.updatedAt = new Date();
            console.log(`📊 Updated effectiveness score for ${templateId}: ${score}`);
        }
    }
}
exports.PromptTemplateManager = PromptTemplateManager;
exports.promptTemplateManager = PromptTemplateManager.getInstance();
//# sourceMappingURL=promptTemplateManager.js.map