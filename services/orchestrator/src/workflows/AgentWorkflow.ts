import { Request, Response } from 'express';
import { HistoryService } from '../services/HistoryService';
import { KnowledgeService } from '../services/KnowledgeService';
import { LoggerService } from '../services/LoggerService';
import { SummarizationService } from '../services/SummarizationService';
import { PromptService } from '../services/PromptService';
import { CalculatorTool } from '../tools/CalculatorTool';
import { SearchTool } from '../tools/SearchTool';
import { CanonicalIR } from '../../../../shared/types';
import { AgentTool } from '../tools/AgentTool';

// Agent Components
import { IntentAnalyzer } from '../services/agent/IntentAnalyzer';
import { PolicyEngine } from '../services/agent/PolicyEngine';
import { ToolOrchestrator } from '../services/agent/ToolOrchestrator';
import { ResponseSynthesizer } from '../services/ResponseSynthesizer';
import { ExecutionTrace, Intent } from '../services/agent/types';

// Whitelist of tools for the Agent
const AVAILABLE_TOOLS: AgentTool[] = [
    new CalculatorTool(),
    new SearchTool()
];

export class AgentWorkflow {
    static async run(req: Request, res: Response) {
        const { userId, message, sessionId, collectionId, userRole, userDepartment, images, fileParses, files } = (req as any).userContext;
        return this.execute(userId, sessionId, message, userRole, userDepartment, collectionId, res, images, fileParses, files);
    }

    static async execute(
        userId: string,
        sessionId: string,
        message: string,
        userRole: string,
        userDepartment: string,
        collectionId: string | undefined,
        res: Response,
        images: any[] = [],
        fileParses: CanonicalIR[] = [],
        files: any[] = []
    ) {
        const query = message;
        const traceId = (global as any).crypto ? (global as any).crypto.randomUUID() : Math.random().toString(36).substring(7);

        // Prepare Tool Config
        const allowedTools = AVAILABLE_TOOLS.filter(t => t.isAllowed(userRole));

        // Headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        LoggerService.info('agent_workflow_start', { traceId, userId, message }, userId);

        try {
            // 1. Load History + Context
            const { messages: history, smartContext } = await HistoryService.getContext(userId, sessionId);
            const historyMessages = history.slice(-10).map(m => ({ role: m.role, content: m.content }));

            // 2. Intent Analysis (Stage 1)
            res.write(`data: ${JSON.stringify({ type: 'status', message: 'Analyzing Intent...' })}\n\n`);

            const intentResult = await IntentAnalyzer.analyze(userId, query, historyMessages);
            res.write(`data: ${JSON.stringify({ type: 'intent', intent: intentResult.intent })}\n\n`);

            LoggerService.info('agent_intent_result', { intent: intentResult.intent }, userId);
            console.log(`[AgentWorkflow] Intent: ${intentResult.intent}`);

            // 3. RAG Pre-fetch (Removed in V2.1)
            // PolicyEngine now handles SearchTool execution explicitly.
            // We rely on ExecutionTrace for context.
            const userContext = { userId, role: userRole, department: userDepartment };
            const ragContext = '';
            const ragSources: Array<{ id: string, name: string }> = [];

            // 4. Policy Execution (Stage 2 & 3)
            // Deterministic Planning
            res.write(`data: ${JSON.stringify({ type: 'status', message: 'Executing Policy...' })}\n\n`);
            const plan = PolicyEngine.getPlan(intentResult.intent);

            LoggerService.info('agent_policy_plan', { policyId: plan.policyId, steps: plan.steps.length }, userId);
            console.log(`[AgentWorkflow] Policy: ${plan.policyId} (${plan.steps.length} steps)`);

            // 5. Tool Orchestration
            let executionTrace: ExecutionTrace = { traceId, policyId: plan.policyId, steps: [] };

            if (plan.steps.length > 0) {
                executionTrace = await ToolOrchestrator.execute(
                    userId,
                    query,
                    plan,
                    allowedTools,
                    { ...userContext, collectionId },
                    (step: any) => {
                        res.write(`data: ${JSON.stringify({ type: 'status', message: `Running ${step.tool}...` })}\n\n`);
                    }
                );
            }

            // 6. Answer Synthesis (Stage 4)
            res.write(`data: ${JSON.stringify({ type: 'status', message: 'Synthesizing Answer...' })}\n\n`);

            // Attach Files Context
            let fileContext = '';
            let injectedEvidence: any[] = [];
            if (fileParses.length > 0) {
                const fileParsesWithIds = KnowledgeService.assignBlockIds(fileParses);
                const topBlocks = await KnowledgeService.searchLocal(query, fileParsesWithIds, 15);
                topBlocks.forEach(block => {
                    const fileName = block.metadata?.fileName || 'unknown';
                    fileContext += `\n<block id="${block.id}">\n[Source: ${fileName}]\n${block.content}\n</block>\n`;
                    injectedEvidence.push({ id: block.id, fileName, ...block.metadata });
                });
            }

            // Fetch Core System Prompt (based on ENV)
            const envType = (process.env.ENV_TYPE as 'TEST' | 'PROD') || 'TEST';
            const coreSystemPrompt = await PromptService.getCoreSystemPrompt(envType);

            const finalAnswer = await ResponseSynthesizer.generate(
                query,
                executionTrace,
                historyMessages,
                { ragContext, fileContext, smartContext },
                coreSystemPrompt
            );

            // 7. Update Memory (Passive)
            LoggerService.logTrace(executionTrace, userId);

            await SummarizationService.updateContextFromTrace(
                userId,
                sessionId,
                intentResult.intent,
                executionTrace,
                finalAnswer,
                smartContext
            );

            // Stream Final Output
            res.write(`data: ${JSON.stringify({ text: finalAnswer, traceId })}\n\n`);
            res.write(`data: ${JSON.stringify({
                type: 'metadata',
                metadata: {
                    intent: intentResult.intent,
                    policy_id: plan.policyId,
                    trace_id: executionTrace.traceId,
                    sources: ragSources,
                    evidence: injectedEvidence,
                    steps_count: executionTrace.steps.length,
                    status: 'COMPLETED'
                }
            })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();

            // Persistence
            const assistantMessage = { role: 'assistant' as const, content: finalAnswer, timestamp: new Date(), meta: { intent: intentResult.intent } };
            await HistoryService.addMessage(userId, sessionId, { role: 'user', content: query, timestamp: new Date() });
            await HistoryService.addMessage(userId, sessionId, assistantMessage);
            await HistoryService.saveToPersistentStorage(userId, sessionId, [assistantMessage], { totalTokens: 0 }, 'PROD', 'sonnet');

        } catch (error: any) {
            LoggerService.error('Agent Workflow Error', { error: error.message, stack: error.stack, traceId });
            res.write(`data: ${JSON.stringify({ error: 'System error occurred', traceId })}\n\n`);
            res.end();
        }
    }
}
