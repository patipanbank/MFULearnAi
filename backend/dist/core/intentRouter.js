"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intentRouter = exports.IntentRouter = exports.ExecutionStrategy = exports.WorkflowComplexity = exports.AgentType = exports.TaskIntent = void 0;
const aws_1 = require("@langchain/aws");
const messages_1 = require("@langchain/core/messages");
var TaskIntent;
(function (TaskIntent) {
    TaskIntent["KNOWLEDGE_SEARCH"] = "knowledge_search";
    TaskIntent["ACADEMIC_QUESTION"] = "academic_question";
    TaskIntent["RESEARCH_ASSISTANCE"] = "research_assistance";
    TaskIntent["CODE_ASSISTANCE"] = "code_assistance";
    TaskIntent["DEBUGGING_HELP"] = "debugging_help";
    TaskIntent["TECHNICAL_EXPLANATION"] = "technical_explanation";
    TaskIntent["WRITING_ASSISTANCE"] = "writing_assistance";
    TaskIntent["CONTENT_CREATION"] = "content_creation";
    TaskIntent["CREATIVE_BRAINSTORMING"] = "creative_brainstorming";
    TaskIntent["DATA_ANALYSIS"] = "data_analysis";
    TaskIntent["PROBLEM_SOLVING"] = "problem_solving";
    TaskIntent["MATHEMATICAL_CALCULATION"] = "mathematical_calculation";
    TaskIntent["TRANSLATION"] = "translation";
    TaskIntent["LANGUAGE_LEARNING"] = "language_learning";
    TaskIntent["COMMUNICATION_HELP"] = "communication_help";
    TaskIntent["GENERAL_CONVERSATION"] = "general_conversation";
    TaskIntent["CLARIFICATION_REQUEST"] = "clarification_request";
    TaskIntent["FOLLOW_UP_QUESTION"] = "follow_up_question";
    TaskIntent["SYSTEM_COMMAND"] = "system_command";
    TaskIntent["AGENT_SELECTION"] = "agent_selection";
    TaskIntent["UNKNOWN"] = "unknown";
})(TaskIntent || (exports.TaskIntent = TaskIntent = {}));
var AgentType;
(function (AgentType) {
    AgentType["ADVANCED_REASONING"] = "advanced_reasoning";
    AgentType["SIMPLIFIED_MODERN"] = "simplified_modern";
    AgentType["SPECIALIZED_KNOWLEDGE"] = "specialized_knowledge";
    AgentType["CODE_ASSISTANT"] = "code_assistant";
    AgentType["CREATIVE_WRITER"] = "creative_writer";
    AgentType["RESEARCH_ANALYST"] = "research_analyst";
    AgentType["GENERAL_ASSISTANT"] = "general_assistant";
})(AgentType || (exports.AgentType = AgentType = {}));
var WorkflowComplexity;
(function (WorkflowComplexity) {
    WorkflowComplexity["SIMPLE"] = "simple";
    WorkflowComplexity["MODERATE"] = "moderate";
    WorkflowComplexity["COMPLEX"] = "complex";
    WorkflowComplexity["COLLABORATIVE"] = "collaborative";
})(WorkflowComplexity || (exports.WorkflowComplexity = WorkflowComplexity = {}));
var ExecutionStrategy;
(function (ExecutionStrategy) {
    ExecutionStrategy["DIRECT"] = "direct";
    ExecutionStrategy["SEQUENTIAL"] = "sequential";
    ExecutionStrategy["PARALLEL"] = "parallel";
    ExecutionStrategy["ADAPTIVE"] = "adaptive";
})(ExecutionStrategy || (exports.ExecutionStrategy = ExecutionStrategy = {}));
class IntentRouter {
    constructor() {
        this.conversationHistory = new Map();
        this.llm = new aws_1.ChatBedrockConverse({
            model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            region: process.env.AWS_REGION || 'us-east-1',
            temperature: 0.1,
            maxTokens: 1000
        });
        console.log('🧭 Intent Router initialized');
    }
    async classifyIntent(input, sessionId, previousMessages) {
        console.log(`🧭 Classifying intent for session ${sessionId}: "${input.substring(0, 50)}..."`);
        try {
            const classificationPrompt = this.buildClassificationPrompt(input, previousMessages);
            const messages = [new messages_1.SystemMessage(classificationPrompt), new messages_1.HumanMessage(input)];
            const response = await this.llm.invoke(messages);
            const result = this.parseClassificationResponse(response.content);
            this.updateConversationHistory(sessionId, input, result);
            console.log(`✅ Intent classified: ${result.primaryIntent} (confidence: ${result.confidence})`);
            return result;
        }
        catch (error) {
            console.error('❌ Intent classification failed:', error);
            return this.getFallbackClassification(input);
        }
    }
    async routeToAgent(classification) {
        console.log(`🧭 Routing intent: ${classification.primaryIntent} to agent`);
        const selectedAgent = this.selectOptimalAgent(classification);
        const workflowSteps = this.generateWorkflowSteps(classification, selectedAgent);
        const executionStrategy = this.determineExecutionStrategy(classification, workflowSteps);
        const agentConfig = this.buildAgentConfig(classification, selectedAgent);
        const decision = {
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
    async executeConditionalFlow(decision, input, context) {
        console.log(`🧭 Executing ${decision.executionStrategy} workflow with ${decision.workflowSteps.length} steps`);
        const executedSteps = [];
        switch (decision.executionStrategy) {
            case ExecutionStrategy.DIRECT:
                executedSteps.push(...decision.workflowSteps);
                break;
            case ExecutionStrategy.SEQUENTIAL:
                for (const step of decision.workflowSteps) {
                    executedSteps.push(await this.executeWorkflowStep(step, context));
                }
                break;
            case ExecutionStrategy.PARALLEL:
                const parallelGroups = this.groupParallelSteps(decision.workflowSteps);
                for (const group of parallelGroups) {
                    const groupResults = await Promise.all(group.map(step => this.executeWorkflowStep(step, context)));
                    executedSteps.push(...groupResults);
                }
                break;
            case ExecutionStrategy.ADAPTIVE:
                executedSteps.push(...await this.executeAdaptiveWorkflow(decision.workflowSteps, context));
                break;
        }
        console.log(`✅ Executed workflow with ${executedSteps.length} completed steps`);
        return executedSteps;
    }
    buildClassificationPrompt(input, previousMessages) {
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
        if (previousMessages && previousMessages.length > 0) {
            const contextSummary = previousMessages.slice(-4).map(msg => `${msg instanceof messages_1.HumanMessage ? 'User' : 'Assistant'}: ${msg.content.substring(0, 100)}`).join('\n');
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
    parseClassificationResponse(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
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
        }
        catch (error) {
            console.error('❌ Failed to parse classification response:', error);
            return this.getFallbackClassification(response);
        }
    }
    getFallbackClassification(input) {
        const lowerInput = input.toLowerCase();
        let primaryIntent = TaskIntent.GENERAL_CONVERSATION;
        let suggestedAgent = AgentType.GENERAL_ASSISTANT;
        if (lowerInput.includes('code') || lowerInput.includes('program') || lowerInput.includes('function')) {
            primaryIntent = TaskIntent.CODE_ASSISTANCE;
            suggestedAgent = AgentType.CODE_ASSISTANT;
        }
        else if (lowerInput.includes('write') || lowerInput.includes('essay') || lowerInput.includes('article')) {
            primaryIntent = TaskIntent.WRITING_ASSISTANCE;
            suggestedAgent = AgentType.CREATIVE_WRITER;
        }
        else if (lowerInput.includes('research') || lowerInput.includes('analyze') || lowerInput.includes('study')) {
            primaryIntent = TaskIntent.RESEARCH_ASSISTANCE;
            suggestedAgent = AgentType.RESEARCH_ANALYST;
        }
        else if (lowerInput.includes('calculate') || lowerInput.includes('math') || lowerInput.includes('solve')) {
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
    selectOptimalAgent(classification) {
        const suggestedAgent = classification.suggestedAgent;
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
    generateWorkflowSteps(classification, selectedAgent) {
        const steps = [];
        switch (classification.workflowComplexity) {
            case WorkflowComplexity.SIMPLE:
                steps.push({
                    stepId: 'direct_response',
                    stepType: 'generation',
                    agentType: selectedAgent,
                    requiredTools: classification.requiredTools,
                    dependencies: [],
                    estimatedDuration: 30000,
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
    determineExecutionStrategy(classification, steps) {
        if (steps.length === 1) {
            return ExecutionStrategy.DIRECT;
        }
        if (classification.workflowComplexity === WorkflowComplexity.COLLABORATIVE) {
            return ExecutionStrategy.ADAPTIVE;
        }
        const hasParallelizableSteps = steps.some(step => step.dependencies.length === 0 && steps.filter(s => s.dependencies.length === 0).length > 1);
        if (hasParallelizableSteps) {
            return ExecutionStrategy.PARALLEL;
        }
        return ExecutionStrategy.SEQUENTIAL;
    }
    buildAgentConfig(classification, selectedAgent) {
        const baseConfig = {
            reasoningMode: classification.workflowComplexity === WorkflowComplexity.COMPLEX ? 'auto-cot' : 'cot',
            maxIterations: classification.estimatedSteps + 1,
            enableReflection: classification.metadata.requiresReasoning,
            temperature: this.getTemperatureForIntent(classification.primaryIntent)
        };
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
    getTemperatureForIntent(intent) {
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
    updateConversationHistory(sessionId, input, result) {
        if (!this.conversationHistory.has(sessionId)) {
            this.conversationHistory.set(sessionId, []);
        }
        const history = this.conversationHistory.get(sessionId);
        history.push(new messages_1.HumanMessage(input));
        if (history.length > 10) {
            history.splice(0, history.length - 10);
        }
    }
    async executeWorkflowStep(step, context) {
        console.log(`🔄 Executing workflow step: ${step.stepId} (${step.stepType})`);
        return {
            ...step,
            description: `${step.description} - Executed at ${new Date().toISOString()}`
        };
    }
    groupParallelSteps(steps) {
        const groups = [];
        const processed = new Set();
        for (const step of steps) {
            if (processed.has(step.stepId))
                continue;
            const group = [step];
            processed.add(step.stepId);
            for (const otherStep of steps) {
                if (processed.has(otherStep.stepId))
                    continue;
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
    async executeAdaptiveWorkflow(steps, context) {
        console.log(`🔄 Executing adaptive workflow with ${steps.length} steps`);
        const executedSteps = [];
        for (const step of steps) {
            executedSteps.push(await this.executeWorkflowStep(step, context));
        }
        return executedSteps;
    }
    cleanupSession(sessionId) {
        this.conversationHistory.delete(sessionId);
        console.log(`🧹 Cleaned up intent router history for session: ${sessionId}`);
    }
    getStatistics() {
        return {
            activeSessions: this.conversationHistory.size,
            totalHistoryEntries: Array.from(this.conversationHistory.values()).reduce((sum, history) => sum + history.length, 0)
        };
    }
}
exports.IntentRouter = IntentRouter;
exports.intentRouter = new IntentRouter();
//# sourceMappingURL=intentRouter.js.map