import { Request, Response } from 'express';
import { HistoryService } from '../services/HistoryService';
import { KnowledgeService } from '../services/KnowledgeService';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { SummarizationService } from '../services/SummarizationService';
import { CalculatorTool } from '../tools/CalculatorTool';
import { SearchTool } from '../tools/SearchTool';
import { CanonicalIR } from '../../../../shared/types';

const MAX_STEPS = 5;

// Whitelist of tools for the Agent
const AVAILABLE_TOOLS = [
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
        const traceId = (global as any).crypto ? (global as any).crypto.randomUUID() : require('crypto').randomUUID();

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const totalUsage = { input: 0, output: 0, total: 0 };
        LoggerService.info('agent_workflow_start', { traceId, userId, message }, userId);

        try {
            // 1.1 Load History + Smart Context (Agent Memory)
            const { messages: history, smartContext } = await HistoryService.getContext(userId, sessionId);

            // 1.2 RAG Search (Gated by Intent + Fast Re-check)
            const userContext = { userId, role: userRole, department: userDepartment };
            const rollingIntent = smartContext?.rolling?.intent;
            let currentIntent = typeof rollingIntent === 'string' ? rollingIntent : (rollingIntent?.primary || 'QUERY');

            // Fast Intent Re-check (Haiku) with Context
            if (currentIntent === 'CHITCHAT' || currentIntent === 'QUERY') {
                const intentContext = {
                    last_intent: smartContext?.rolling?.intent?.primary || 'QUERY',
                    last_decisions: smartContext?.rolling?.decisions || [],
                    constraints: smartContext?.rolling?.constraints || []
                };
                const { intent: fastIntent, usage: intentUsage } = await this.quickIntentCheck(query, intentContext);
                totalUsage.input += intentUsage.input;
                totalUsage.output += intentUsage.output;
                totalUsage.total += intentUsage.total;
                if (fastIntent !== currentIntent) {
                    LoggerService.info('agent_intent_corrected', { old: currentIntent, new: fastIntent, traceId }, userId);
                    currentIntent = fastIntent;
                }
            }

            const RAG_INTENTS = ['FACT_LOOKUP', 'RESEARCH', 'DEBUGGING', 'DESIGN', 'QUERY'];

            // 1.3 Tools Preparation
            const allowedTools = AVAILABLE_TOOLS.filter(t => t.isAllowed(userRole));

            // Heuristic RAG Gating: Intent + Complexity Check (Improved for Thai)
            const queryComplexity = query.split(/\s+/).length >= 3 || query.length > 20 || /[\?\.!]/.test(query);
            const hasDomainKeywords = /MFU|system|architecture|security|JWT|canonical|rolling|memory|promotion|auth|คู่มือ|สิทธิ์|วิจัย|ค้นหา|ระเบียบ|ประกาศ|แนวทาง|ใคร|คือ|ที่ไหน|เมื่อไหร่|อย่างไร|กำหนดการ/i.test(query);

            // Relaxed Rule: Trigger RAG if:
            // 1. Intent is explicitly factual (FACT_LOOKUP, RESEARCH)
            // 2. A specific collection is selected AND (it's complex OR has keywords) AND intent is not social (CHITCHAT)
            // 3. Query matches RAG intents AND (is complex OR has keywords)
            const shouldUseRAG = (currentIntent === 'FACT_LOOKUP' || currentIntent === 'RESEARCH') ||
                (collectionId && currentIntent !== 'CHITCHAT' && (queryComplexity || hasDomainKeywords)) ||
                (RAG_INTENTS.includes(currentIntent) && (queryComplexity || hasDomainKeywords));
            let ragContext = '';
            let ragSources: Array<{ id: string, name: string }> = [];
            let ragMaxScore = 0;

            if (shouldUseRAG) {
                res.write(`data: ${JSON.stringify({ type: 'intent', intent: currentIntent })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: 'Searching Knowledge Base...' })}\n\n`);
                const searchResult = await KnowledgeService.search(query, userContext, collectionId, currentIntent);
                ragContext = searchResult.text;
                ragSources = searchResult.sources;
                ragMaxScore = searchResult.maxScore || 0;
                LoggerService.info('agent_rag_result', { found: !!ragContext, score: ragMaxScore, intent: currentIntent, traceId, queryComplexity }, userId);
            } else {
                res.write(`data: ${JSON.stringify({ type: 'intent', intent: currentIntent })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: 'Analyzing request...' })}\n\n`);
            }

            // Phase 18: Score-Based Anti-Redundancy Guard
            // If score > 0.65 (High Confidence), we FORBID redundant search
            // If score <= 0.65 (Low Confidence), we SUGGEST clarification
            const ragInstruction = ragMaxScore > 0.65
                ? `INSTRUCTION: This context matches your query with HIGH CONFIDENCE. Do NOT use the 'search' tool unless absolutely necessary. Rely on this text.`
                : `INSTRUCTION: This context was retrieved but may be partial (Confidence: ${(ragMaxScore * 100).toFixed(0)}%). If it is insufficient, YOU MUST USE THE 'search' TOOL to find better information.`;

            const ragSystemPrompt = ragContext
                ? `\n\n=== KNOWLEDGE BASE CONTEXT (PRE-RETRIEVED) ===\n${ragContext}\n==============================\n${ragInstruction}`
                : '';

            const toolsPrompt = allowedTools.length > 0
                ? `\n\nYou have access to the following tools:\n${allowedTools.map(t => `${t.name}: ${t.description}`).join('\n')}\n\nTo use a tool, wrap the JSON call in <tool_use> tags. Example: <tool_use>{"tool": "search", "parameters": {"query": "knowledge base search query"}}</tool_use>`
                : '';

            // 1.3.5 Attached Files Context
            let fileContextPrompt = '';
            if (fileParses.length > 0) {
                fileContextPrompt += `\n\n=== ATTACHED FILE CONTEXT ===\n`;
                fileParses.forEach((ir, idx) => {
                    const originalName = files && files[idx] ? files[idx].name : `File ${idx + 1}`;
                    fileContextPrompt += `\n[File: ${originalName}]\n`;

                    let charCount = 0;
                    const MAX_CHARS = 20000; // Agent context is tighter, use less per file than chat
                    for (const block of ir.blocks) {
                        if (charCount > MAX_CHARS) {
                            fileContextPrompt += `\n... [Truncated] ... \n`;
                            break;
                        }
                        fileContextPrompt += `\n${block.content}`;
                        charCount += block.content.length;
                    }
                });
                fileContextPrompt += `\n=== END ATTACHED FILES ===\n`;
            }

            // 1.3.6 Dynamic Refusal Policy based on Intent
            // Phase 18: UX Improvement - Relaxed Refusal for General Facts with Guardrails
            // Guardrail: Detect if the query implies an organizational context (e.g., policy, specific entity, rules)
            const isOrganizationalQuery = hasDomainKeywords || /policy|regulation|guideline|document|files|contract|agreement|budget|contact|email|who is|fee|calendar|schedule|deadline|registration|course|gpa|grade/i.test(query);

            // Allow internal knowledge for ANY intent as long as it's NOT an organizational query
            // This prevents benign intents like 'INSTRUCTION' or 'SUMMARY' from being blocked
            const isSafeGeneralIntent = !isOrganizationalQuery;

            const refusalRule = isSafeGeneralIntent
                ? `- Basic factual questions (science, math, general definitions) may be answered using internal knowledge. 
                   - WARNING: If the question pertains to specific organizational policies, documents, or data absent in context, you MUST refuse.
                   - When answering from internal knowledge, keep answers generic and timeless. Do NOT invent names, dates, or policies.`
                : `- If the Knowledge Base or Context does not explicitly contain the answer, you MUST say "I don't have enough information". Do NOT use internal knowledge for organizational inquiries.`;

            // 1.4 Construct Initial Prompt
            let messages: any[] = [
                {
                    role: 'system' as const,
                    content: `You are the MFU Learn AI Agent. You are efficient and helpful.

=== TRUTH PRIORITY (HIERARCHY OF TRUTH) ===
1. Canonical Memory (Established Facts) - HIGHEST PRIORITY
2. Knowledge Base (RAG) - Review dates carefully
3. Attached Files (User Uploads) - May be outdated or partial
4. Your Internal Knowledge - LOWEST/Fallback

=== CRITICAL RULES (ADAPTED FOR ${currentIntent}) ===
- If Attached Files conflict with Canonical Memory, TRUST MEMORY and warn the user.
- If Canonical Memory contradicts recent evidence, FLAG the contradiction in your response.
${refusalRule}
- If the answer requires inference beyond the explicit text, clearly label it as an assumption or hypothesis.
- TRAP GUARD: If the retrieved KNOWLEDGE BASE CONTEXT only partially answers the question or seems off-topic, you MAY search for clarification using tools. Do NOT settle for a partial answer if a search could fix it.
- Do NOT infer dates, policies, or announcements that are not present in the context.
- If confidence is low, ask for clarification.

=== OUTPUT CONTRACT (SELF-EXPLANATION) ===
After your final answer, you MUST append a JSON explanation block (invisible to user).
Format:
\`\`\`json
{
  "basis": "Canonical" | "RAG" | "Files" | "Internal" | "Mixed",
  "assumptions": ["Assumption 1", "Assumption 2"],
  "missing_info": ["Missing 1"]
}
\`\`\`
Do NOT explain your chain-of-thought in text. Just provide the answer, then the JSON block. Broadway
                    
=== CANONICAL MEMORY (Established Facts) ===
${smartContext?.canonical || 'First session.'}

=== ROLLING CONTEXT (Recent Intent & Decisions) ===
${JSON.stringify(smartContext?.rolling || {}, null, 2)}

${ragSystemPrompt}
${fileContextPrompt}
${toolsPrompt}

If you need to use a tool to answer, use it. If you have the answer, reply directly to the user.
`
                },
                ...history.slice(-10).map(m => ({ role: m.role, content: m.content, images: m.images })),
                { role: 'user', content: query, images }
            ];

            let steps = 0;
            let finalAnswer = '';
            let lastToolCall = '';
            let repeatCount = 0;
            const startTime = Date.now();
            // Phase 16: Hoisted for Persistence
            let confidence = 'Low';
            let explanation = { basis: 'Internal', assumptions: [], missing_info: [] };

            while (steps < MAX_STEPS) {
                steps++;
                LoggerService.info('agent_step', { step: steps, sessionId, traceId }, userId);

                // Phase 15 Hardening: Tool Loop Soft-Correction
                if (steps >= 2 && lastToolCall.includes('search')) {
                    messages.push({
                        role: 'user',
                        content: `TEMPORARY SYSTEM HINT (this turn only): Previous searches did not yield new information. Do NOT perform another search in this turn. Either answer with reasoning OR explain what information is missing.`
                    });
                }

                // Call Model (Non-Streaming for internal reasoning)
                const { text: fullResponse, usage: stepUsage } = await BedrockService.sendChat('anthropic.claude-3-5-sonnet-20240620-v1:0', messages);
                totalUsage.input += stepUsage.input;
                totalUsage.output += stepUsage.output;
                totalUsage.total += stepUsage.total;

                // 2. Parse Tool Use (Robust Regex)
                const toolRegex = /<tool_use>([\s\S]*?)<\/tool_use>/;
                const match = fullResponse.match(toolRegex);

                if (!match) {
                    if (!fullResponse.trim()) {
                        LoggerService.warn('agent_empty_response', { step: steps, traceId }, userId);
                        finalAnswer = "I'm sorry, I couldn't formulate a response. Please try again.";
                    } else {
                        finalAnswer = fullResponse;
                    }
                    break;
                }

                // Tool Use Detected
                let toolCall;
                try {
                    const rawJson = match[1].trim();
                    toolCall = JSON.parse(rawJson);
                } catch (e) {
                    LoggerService.error('agent_tool_parse_error', { step: steps, raw: match[1], traceId }, userId);
                    messages.push({ role: 'assistant', content: fullResponse });
                    messages.push({ role: 'user', content: "Error: Your tool_use JSON was malformed. Please try again with valid JSON." });
                    continue;
                }

                // Loop Kill-Switch: Resilient Loop Detection (Allow 2 repeats)
                const currentCallPrefix = `${toolCall.tool}:${JSON.stringify(toolCall.parameters)}`;
                if (lastToolCall && currentCallPrefix === lastToolCall.split(':step')[0]) {
                    repeatCount++;
                } else {
                    repeatCount = 0;
                }

                if (repeatCount > 1) {
                    LoggerService.warn('agent_loop_detected', { currentCall: currentCallPrefix, repeatCount, traceId }, userId);
                    finalAnswer = "I've detected an iterative loop. Based on previous attempts, here is the best available answer: " + fullResponse.replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '').trim();
                    break;
                }
                lastToolCall = `${currentCallPrefix}:step${steps}`;
                const tool = allowedTools.find(t => t.name === toolCall.tool);
                if (!tool) {
                    messages.push({ role: 'assistant', content: fullResponse });
                    messages.push({ role: 'user', content: `Error: Tool '${toolCall.tool}' not found or not allowed.` });
                    continue;
                }

                const toolRoll = { tool: toolCall.tool, parameters: toolCall.parameters };
                LoggerService.info('tool_execution', toolRoll, userId);
                if (toolCall.tool !== 'search') {
                    res.write(`data: ${JSON.stringify({ type: 'status', message: `Using ${toolCall.tool}...` })}\n\n`);
                }

                const executionResult = await tool.execute(toolCall.parameters, {
                    userId,
                    role: userRole,
                    department: userDepartment,
                    collectionId
                });

                // 4. Build Result (Sanitized)
                const safeOutput = JSON.stringify(executionResult.result || executionResult.error).replace(/<\/tool_result>/g, '&lt;/tool_result&gt;');
                const resultBlock = `\n<tool_result>\n<tool_name>${toolCall.tool}</tool_name>\n<status>${executionResult.success ? 'success' : 'error'}</status>\n<output>${safeOutput}</output>\n</tool_result>\n\nREMINDER: Your original goal is: "${query}". Use this new information to answer the user's question, or explain if it's still insufficient.`;

                messages.push({ role: 'assistant' as const, content: fullResponse });
                messages.push({ role: 'user' as const, content: resultBlock });

                // 5. History Pinning (Protect sequence and prevent context overflow)
                if (messages.length > 10) {
                    const systemMsg = messages[0];
                    // Keep the last 8 messages (4 pairs) to preserve context while staying efficient
                    const recentHistory = messages.slice(-8);

                    // Simple Validation: Ensure we don't start with Assistant after System if at all possible
                    // Although normalizeMessages handles this, it's better to be clean here.
                    messages = [systemMsg, ...recentHistory];
                    LoggerService.info('agent_history_window_prune', { size: messages.length, traceId }, userId);
                }
            }

            // 6. Streaming Final Answer (Cleaned & Explained)
            if (finalAnswer) {
                // Phase 16: Extract Self-Explanation (Robust Regex)
                // Matches ```json OR ``` followed by { ... } at the end of string
                // Match anything inside ```json ... ``` or just ``` ... ```
                const explanationRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/i;
                const explanationMatch = finalAnswer.match(explanationRegex);
                // explanation = { ... } initialized above
                let cleanedAnswer = finalAnswer.replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '').trim();

                if (explanationMatch) {
                    try {
                        explanation = JSON.parse(explanationMatch[1]);
                        // Remove explanation block from user-facing text
                        cleanedAnswer = cleanedAnswer.replace(explanationMatch[0], '').trim();
                    } catch (e) {
                        LoggerService.warn('explanation_parse_error', { raw: explanationMatch[1] }, userId);
                    }
                }
                // Phase 16: Heuristic Confidence Engine
                // confidence initialized to 'Low' above
                if (explanation.basis === 'Canonical') {
                    confidence = 'High';
                } else if (ragContext && ragSources.length > 0) {
                    // If purely RAG and no major assumptions -> High, else Medium
                    if (explanation.assumptions && explanation.assumptions.length > 0) {
                        confidence = 'Medium';
                    } else {
                        confidence = 'High';
                    }
                } else if (explanation.basis === 'Internal' || explanation.basis === 'Models') {
                    // Internal knowledge is fallback
                    confidence = 'Low';
                } else {
                    confidence = 'Medium';
                }

                // Override: specific Refusal Phrase
                if (/i don't have enough/i.test(cleanedAnswer)) {
                    confidence = 'Low';
                }

                res.write(`data: ${JSON.stringify({ text: cleanedAnswer, traceId })}\n\n`);
                res.write(`data: ${JSON.stringify({
                    type: 'metadata',
                    metadata: {
                        intent: currentIntent,
                        usedRAG: !!ragContext,
                        sources: ragSources,
                        stepsUsed: steps,
                        tokenPressure: messages.length,
                        totalTokens: totalUsage.total,
                        explanation: explanation
                    }
                })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: '' })}\n\n`); // Clear status
                res.write('data: [DONE]\n\n');
                res.end();

                // 7. Reliability Signals (Telemetry)
                const duration = Date.now() - startTime;
                LoggerService.info('agent_reliability_telemetry', {
                    traceId,
                    userId,
                    durationMs: duration,
                    stepsUsed: steps,
                    usedRAG: shouldUseRAG,
                    intent: currentIntent,
                    loopDetected: repeatCount > 1,
                    tokenPressure: messages.length,
                    totalTokens: totalUsage.total
                });

                // 8. Persistence (Save to Redis & MongoDB)
                const currentMessage = { role: 'user' as const, content: query, timestamp: new Date() };
                const assistantMessage = {
                    role: 'assistant' as const,
                    content: cleanedAnswer,
                    timestamp: new Date(),
                    meta: {
                        intent: currentIntent,
                        usedRAG: !!ragContext,
                        sources: ragSources,
                        stepsUsed: steps,
                        tokenPressure: messages.length,
                        totalTokens: totalUsage.total,
                        confidence,
                        explanation
                    }
                };

                await HistoryService.addMessage(userId, sessionId, currentMessage);
                await HistoryService.addMessage(userId, sessionId, assistantMessage);
                await HistoryService.saveToPersistentStorage(
                    userId,
                    sessionId,
                    [currentMessage, assistantMessage],
                    { totalTokens: totalUsage.total },
                    process.env.ENV_TYPE || 'TEST',
                    'anthropic.claude-3-5-sonnet-20240620-v1:0'
                );

                // 9. Background Summarization & Auto-Naming
                SummarizationService.runUpdate(userId, sessionId, [currentMessage, assistantMessage], smartContext);
                SummarizationService.updateTitle(userId, sessionId, query);
            }

        } catch (error: any) {
            LoggerService.error('Agent Workflow Error', { error: error.message, stack: error.stack, traceId });
            res.write(`data: ${JSON.stringify({ error: 'Agent workflow failed', traceId })}\n\n`);
            res.end();
        }
    }

    private static async quickIntentCheck(query: string, context?: any): Promise<{ intent: string, usage: { input: number, output: number, total: number } }> {
        try {
            const contextStr = context ? `
Context:
- Last Intent: ${context.last_intent}
- Decisions: ${context.last_decisions?.join(', ')}
- Constraints: ${context.constraints?.join(', ')}
` : '';

            const prompt = `Classify user intent for: "${query}"
        Options: FACT_LOOKUP, RESEARCH, DEBUGGING, DESIGN, CHITCHAT, QUERY.
        ${contextStr}
        
        CRITICAL INSTRUCTIONS:
        1. **Priority**: The user's NEW query is the source of truth. If it shifts topic from the 'Last Intent', IGNORE the context and classify based on the new query.
        2. **Ambiguity**: If ambiguous (e.g., "Why?", "How?"), use Context to infer intent. If still unclear, default to 'QUERY'.
        3. **ChitChat**: Only use 'CHITCHAT' for purely social interaction (Hello, Thanks). If it looks like a question, use 'QUERY' or 'FACT_LOOKUP'.
        
        Output ONLY the enum value in <intent></intent> tags.`;

            const { text: response, usage } = await BedrockService.sendChat('anthropic.claude-3-5-sonnet-20240620-v1:0', [{ role: 'user', content: prompt }], '', 0.1);
            const match = response.match(/<intent>(.*?)<\/intent>/);
            return { intent: match ? match[1].trim() : 'QUERY', usage };
        } catch {
            return { intent: 'QUERY', usage: { input: 0, output: 0, total: 0 } };
        }
    }
}
