import { Request, Response } from 'express';
import { HistoryService } from '../services/HistoryService';
import { KnowledgeService } from '../services/KnowledgeService';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { SummarizationService } from '../services/SummarizationService';
import { CalculatorTool } from '../tools/CalculatorTool';
import { SearchTool } from '../tools/SearchTool';
import { CanonicalIR } from '../../../../shared/types';
import { AgentTool } from '../tools/AgentTool';

const MAX_STEPS = 8; // Increased step limit for agentic freedom

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

        // Prepare Tool Config for Bedrock
        const allowedTools = AVAILABLE_TOOLS.filter(t => t.isAllowed(userRole));
        const toolConfig = allowedTools.length > 0 ? {
            tools: allowedTools.map(t => ({
                toolSpec: t.schemaJSON
            }))
        } : undefined;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const totalUsage = { input: 0, output: 0, total: 0 };
        LoggerService.info('agent_workflow_start', { traceId, userId, message }, userId);

        try {
            // 1.1 Load History + Smart Context (Agent Memory)
            const { messages: history, smartContext } = await HistoryService.getContext(userId, sessionId);

            // 1.2 Hybrid RAG Strategy
            const userContext = { userId, role: userRole, department: userDepartment };
            const rollingIntent = smartContext?.rolling?.intent;

            // Intent Check with Claude 3.5 Sonnet
            const intentContext = {
                last_intent: smartContext?.rolling?.intent?.primary || 'QUERY',
                last_decisions: smartContext?.rolling?.decisions || [],
                constraints: smartContext?.rolling?.constraints || []
            };

            const { intent: currentIntent, usage: intentUsage } = await this.quickIntentCheck(query, intentContext);
            totalUsage.input += intentUsage.input;
            totalUsage.output += intentUsage.output;
            totalUsage.total += intentUsage.total;

            let ragContext = '';
            let ragSources: Array<{ id: string, name: string }> = [];
            let ragMaxScore = 0;

            // Hybrid Logic: Pre-fetch ONLY if intent is explicitly about looking up facts
            // Otherwise, let the Agent decide (Tool Use)
            const shouldPrefetchRAG = (currentIntent === 'FACT_LOOKUP' || currentIntent === 'RESEARCH');

            if (shouldPrefetchRAG) {
                res.write(`data: ${JSON.stringify({ type: 'intent', intent: currentIntent })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: 'Pre-fetching Knowledge...' })}\n\n`);
                const searchResult = await KnowledgeService.search(query, userContext, collectionId, currentIntent);
                ragContext = searchResult.text;
                ragSources = searchResult.sources;
                ragMaxScore = searchResult.maxScore || 0;
                LoggerService.info('agent_rag_prefetch', { found: !!ragContext, score: ragMaxScore, intent: currentIntent, traceId }, userId);
            } else {
                res.write(`data: ${JSON.stringify({ type: 'intent', intent: currentIntent })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: 'Thinking...' })}\n\n`);
            }

            const ragInstruction = ragMaxScore > 0.65
                ? `INSTRUCTION: High-confidence context pre-fetched. Rely on it.`
                : `INSTRUCTION: If the pre-fetched context is not highly relevant (score < 0.65), use the 'search' tool.`;
            const ragSystemPrompt = ragContext
                ? `\n\n=== PRE-FETCHED CONTEXT ===\n${ragContext}\n==============================\n${ragInstruction}`
                : '';

            // 1.3.5 Attached Files Context (ChatGPT-Level Scoped Injection)
            let fileContextPrompt = '';
            let validCitationIds = new Set<string>(); // Scope for Validation
            let injectedEvidence: Array<{ id: string, fileName: string, fileId?: string, page?: number, bbox?: any }> = []; // LOCK 1: Manifest

            if (fileParses.length > 0) {
                // A. Assign Stable IDs (Once)
                const fileParsesWithIds = KnowledgeService.assignBlockIds(fileParses);

                // B. Scoped Search (Top 15 Blocks)
                const topBlocks = await KnowledgeService.searchLocal(query, fileParsesWithIds, 15);

                if (topBlocks.length > 0) {
                    fileContextPrompt += `\n\n=== ATTACHED FILE EVIDENCE (TOP MATCHES) ===\n`;
                    fileContextPrompt += `The following text blocks are extracted from the attached files. Use them to answer.\n`;

                    topBlocks.forEach(block => {
                        const fileName = block.metadata?.fileName || 'unknown_file';
                        const pageInfo = block.metadata?.page ? ` (Page ${block.metadata.page})` : '';

                        // R1: Zero-Trust Protocol - Standardize on XML
                        fileContextPrompt += `\n<block id="${block.id}">\n[Source: ${fileName}${pageInfo}]\n${block.content}\n</block>\n`;
                        validCitationIds.add(block.id); // Add to valid scope

                        // LOCK 1: Populate Manifest
                        injectedEvidence.push({
                            id: block.id,
                            fileName: fileName,
                            fileId: block.metadata?.fileId,
                            page: block.metadata?.page,
                            bbox: block.metadata?.bbox
                        });
                    });
                    fileContextPrompt += `\n=== END ATTACHED EVIDENCE ===\n`;
                }
            }

            // 1.3.6 Dynamic Refusal Policy
            const isOrganizationalQuery = /policy|regulation|guideline|document|files|contract|agreement|budget|contact|email|who is|fee|calendar|schedule|deadline|registration|course|gpa|grade/i.test(query);
            const isSafeGeneralIntent = !isOrganizationalQuery;

            const refusalRule = isSafeGeneralIntent
                ? `- Basic factual questions may be answered using internal knowledge.
                   - WARNING: If the question pertains to specific organizational policies absent in context, you MUST refuse or use the Search tool.`
                : `- If the Knowledge Base or Context does not explicitly contain the answer, use the 'search' tool. If still not found, say "I don't have enough information".`;

            // 1.4 Construct Initial Messages
            let messages: any[] = [
                {
                    role: 'system',
                    content: `You are the MFU Learn AI Agent. You are efficient and helpful.
=== TRUTH PRIORITY ===
1. Canonical Memory
2. Tool Results (Search/Calc)
3. Attached Files (EVIDENCE)
4. Internal Knowledge

=== CRITICAL RULES ===
- Use the 'search' tool if you need information about the University, Policies, or System.
- Use the 'calculator' tool for any math.
${refusalRule}
- Always start by planning your next step if complex.

=== CITATION RULE (MANDATORY) ===
- All attached evidence is provided in <block id="ID"> tags.
- When you use information from EVIDENCE, you MUST cite the Block ID using the tag: <cite>ID</cite>.
- Example: "Students may declare multiple majors <cite>f1_b3</cite>."
- Do NOT use footnotes like [1] or (Source). Use ONLY the <cite> tag with the exact ID found in the <block> tag.
- LOCK 4: If the attached evidence does NOT contain the answer, explicitly say: "The attached documents do not provide this information." Do NOT guess.

=== CONTEXT ===
${smartContext?.canonical || 'First session.'}
${JSON.stringify(smartContext?.rolling || {}, null, 2)}
${ragSystemPrompt}
${fileContextPrompt}
`
                },
                ...history.slice(-10).map(m => ({ role: m.role, content: m.content, images: m.images })),
                { role: 'user', content: query, images }
            ];

            let steps = 0;
            let finalAnswer = '';
            const startTime = Date.now();
            let confidence = 'Low';
            let explanation = { basis: 'Internal', assumptions: [] as string[], missing_info: [] as string[] }; // Typed

            // Scope variables for metadata (outside loop)
            // Scope variables for metadata (outside loop)
            let answerState = 'UNVERIFIED'; // LOCK 2: Default State
            let answerMode = 'internal'; // LOCK 3: Default Mode
            const usedTools = new Set<string>(); // R3: Robust Tool Detection

            // === MAIN AGENT LOOP ===
            while (steps < MAX_STEPS) {
                steps++;
                LoggerService.info('agent_step', { step: steps, sessionId, traceId }, userId);

                // Call Model with Native Tools
                // Note: We don't stream here because we need to check for tool calls
                const { text: fullResponse, usage: stepUsage, stopReason } = await BedrockService.sendChat('anthropic.claude-3-5-sonnet-20240620-v1:0', messages, undefined, 0.5, toolConfig);

                // ... (Usage tracking) ...
                totalUsage.input += stepUsage.input;
                totalUsage.output += stepUsage.output;
                totalUsage.total += stepUsage.total;

                // Handle Response
                if (stopReason === 'tool_use') {
                    // ... (Parsing logic) ...
                    let contentBlocks: any[] = [];
                    try {
                        contentBlocks = JSON.parse(fullResponse);
                    } catch (e) {
                        contentBlocks = [{ type: 'text', text: fullResponse }];
                    }

                    messages.push({ role: 'assistant', content: contentBlocks });

                    const toolResults: any[] = [];
                    for (const block of contentBlocks) {
                        if (block.type === 'tool_use') {
                            const toolName = block.name;
                            usedTools.add(toolName); // R3: Track tool usage

                            const toolUseId = block.toolUseId;
                            const toolInput = block.input;
                            // ... (Execution logic) ...
                            LoggerService.info('tool_execution', { tool: toolName, input: toolInput }, userId);
                            res.write(`data: ${JSON.stringify({ type: 'status', message: `Using ${toolName}...` })}\n\n`);

                            const tool = allowedTools.find(t => t.schemaJSON.name === toolName);
                            let resultContent: any;

                            if (tool) {
                                const executionResult = await tool.execute(toolInput, {
                                    userId,
                                    role: userRole,
                                    department: userDepartment,
                                    collectionId
                                });
                                resultContent = executionResult.success ? executionResult.result : `Error: ${executionResult.error}`;

                                // R2: Tool Provenance Unification
                                // If search tool returns blocks (JSON), parse them and register their IDs
                                if (toolName === 'search' && executionResult.success) {
                                    try {
                                        const searchBlocks = JSON.parse(resultContent);
                                        if (Array.isArray(searchBlocks)) {
                                            searchBlocks.forEach((block: any) => {
                                                if (block.id) {
                                                    validCitationIds.add(block.id);
                                                    // Add to manifest
                                                    injectedEvidence.push({
                                                        id: block.id,
                                                        fileName: block.metadata?.fileName || 'Search Result',
                                                        fileId: block.metadata?.fileId,
                                                        page: block.metadata?.page,
                                                        bbox: block.metadata?.bbox
                                                    });
                                                }
                                            });
                                        }
                                    } catch (e) {
                                        // Result might be plain text if legacy or empty
                                    }
                                }
                            } else {
                                resultContent = `Error: Tool ${toolName} not found.`;
                            }

                            toolResults.push({
                                toolUseId: toolUseId,
                                content: [{ json: { result: resultContent } }]
                            });
                        }
                    }
                    // ... (Append results) ...
                    messages.push({
                        role: 'user',
                        content: toolResults.map(tr => ({
                            type: 'tool_result',
                            toolUseId: tr.toolUseId,
                            content: tr.content
                        }))
                    });

                    // R4: Re-inject Citation Reminder
                    // The model might have "forgotten" the system prompt after a long tool loop.
                    // We remind it right before it generates the final answer.
                    // FIX: Attach to the USER message (tool_result) because Bedrock Converse doesn't allow 'system' in messages list.
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.role === 'user') {
                        // lastMsg is the tool_result message we just pushed above
                        // It has content: [{ type: 'tool_result', ... }]
                        if (Array.isArray(lastMsg.content)) {
                            // Append a text block to the content array
                            // Bedrock Converse allows mixing tool_result and text in one user turn
                            lastMsg.content.push({
                                type: 'text',
                                text: '\n\nReminder: If you use any evidence blocks (Files or Search), you MUST cite them using <cite>ID</cite> tags. Do not invent citations.'
                            });
                        }
                    }

                } else {
                    // ... (Final Answer Logic) ...
                    let textContent = '';
                    try {
                        const blocks = JSON.parse(fullResponse);
                        if (Array.isArray(blocks)) {
                            textContent = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n');
                        } else {
                            textContent = fullResponse;
                        }
                    } catch {
                        textContent = fullResponse;
                    }

                    finalAnswer = textContent;

                    // R4: Enforce Citation Requirement (LOCK 5)
                    const isDocQuestion = /policy|regulation|guideline|document|file|contract|agreement|budget|fee|deadline|registration|course|gpa|grade/i.test(query);
                    if (validCitationIds.size > 0 && isDocQuestion && !finalAnswer.includes('<cite>')) {
                        answerState = 'UNVERIFIED';
                        finalAnswer = "The attached documents do not provide this information (No citations found).";
                        // Force break to skip validation logic as it's already failed
                        answerMode = 'file_grounded';
                        break;
                    }

                    // --- Phase 2 & 3: Validation and Metadata Calculation ---
                    if (validCitationIds.size > 0) { // We have file context injected
                        const validation = this.validateCitations(finalAnswer, validCitationIds);
                        const hasCitations = validation.coverage > 0;

                        // LOCK 3: Answer Mode Logic (Updated with R3)
                        if (hasCitations) {
                            answerMode = 'file_grounded';
                        } else if (usedTools.has('search')) { // R3: Robust Check
                            answerMode = 'rag';
                        } else {
                            // If we have files but didn't use them, acts as internal/chitchat
                            answerMode = 'internal';
                        }

                        // LOCK 2: Answer State Logic (Updated with R4)
                        if (answerMode === 'file_grounded') {
                            if (validation.isValid) {
                                // R4: Bind Confidence to State
                                if (ragMaxScore < 0.65) {
                                    answerState = 'PARTIALLY_VERIFIED';
                                    (explanation as any).confidence_warning = "Low retrieval score.";
                                } else {
                                    answerState = 'VERIFIED';
                                }
                            } else {
                                answerState = 'PARTIALLY_VERIFIED';

                                LoggerService.warn('citation_validation_failed', {
                                    invalidCitations: validation.invalidCitations,
                                    traceId
                                }, userId);

                                (explanation as any).citation_warning = "Some citations could not be verified.";
                                (explanation as any).invalid_citations = validation.invalidCitations;
                            }
                            (explanation as any).citation_coverage = validation.coverage;
                            (explanation as any).citation_details = validation.details; // R1: Sentence-level details
                        }
                    } else if (usedTools.has('search')) { // R3: Robust Check
                        answerMode = 'rag';
                        answerState = 'VERIFIED'; // Assume search tool results are trusted
                    }

                    break;
                }
            }

            // === END LOOP ===

            // 6. Streaming Final Answer
            if (finalAnswer) {
                // ... (Logic for explanation extraction if needed, or we can ask the model to provide it separate)
                // For now, simple heuristic
                if (answerMode === 'file_grounded' || answerMode === 'rag') {
                    confidence = 'High';
                    explanation.basis = 'RAG'; // Legacy field compatibility
                }

                res.write(`data: ${JSON.stringify({ text: finalAnswer, traceId })}\n\n`);
                res.write(`data: ${JSON.stringify({
                    type: 'metadata',
                    metadata: {
                        intent: currentIntent,
                        answer_mode: answerMode, // LOCK 3
                        answer_state: answerState, // LOCK 2
                        injected_evidence: injectedEvidence, // LOCK 1
                        usedRAG: answerMode !== 'internal',
                        sources: ragSources, // Note: Search tool results might not populated this yet
                        stepsUsed: steps,
                        totalTokens: totalUsage.total,
                        explanation
                    }
                })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: '' })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();

                // 7. Telemetry & Persistence (Same as before)
                const currentMessage = { role: 'user' as const, content: query, timestamp: new Date() };
                const assistantMessage = { role: 'assistant' as const, content: finalAnswer, timestamp: new Date(), meta: { intent: currentIntent, stepsUsed: steps } };

                await HistoryService.addMessage(userId, sessionId, currentMessage);
                await HistoryService.addMessage(userId, sessionId, assistantMessage);
                await HistoryService.saveToPersistentStorage(userId, sessionId, [currentMessage, assistantMessage], { totalTokens: totalUsage.total }, process.env.ENV_TYPE || 'TEST', 'anthropic.claude-3-5-sonnet-20240620-v1:0');
            }

        } catch (error: any) {
            LoggerService.error('Agent Workflow Error', { error: error.message, stack: error.stack, traceId });
            res.write(`data: ${JSON.stringify({ error: 'Agent workflow failed', traceId })}\n\n`);
            res.end();
        }
    }

    private static validateCitations(text: string, validIds: Set<string>): { isValid: boolean, invalidCitations: string[], coverage: number, details: any[] } {
        // R1: Sentence-Level Citation Binding
        // 1. Split into sentences (keeping delimiters)
        const segments = text.split(/([.!?\n]+)/).filter(s => s.trim().length > 0);
        const sentences: string[] = [];
        for (let i = 0; i < segments.length; i += 2) {
            const sent = segments[i];
            const delim = segments[i + 1] || '';
            const fullSent = (sent + delim).trim();
            if (fullSent.length > 0) sentences.push(fullSent);
        }

        const details: any[] = [];
        let validSentences = 0;
        let factualSentences = 0; // heuristic: length > 20
        const allInvalidCitations = new Set<string>();

        // Fallback if split fails to produce sentences (e.g. no punctuation), treat whole text as one
        if (sentences.length === 0 && text.trim().length > 0) {
            sentences.push(text.trim());
        }

        for (const sent of sentences) {
            // Heuristic for "factual" sentence that needs citation
            // R4: Strengthen Factual Heuristic
            const isFactual = sent.length > 20 || /\b(is|are|was|were|means|defined as|requires|states|according to)\b/i.test(sent);
            if (isFactual) factualSentences++;

            // Extract all <cite>ID</cite> tags in this sentence
            const citeRegex = /<cite>(.*?)<\/cite>/g;
            const matches = [...sent.matchAll(citeRegex)];
            const citations = matches.map(m => m[1]);

            // Verify against INJECTED ids
            const invalid = citations.filter(id => !validIds.has(id));
            invalid.forEach(id => allInvalidCitations.add(id));

            // A sentence is considered "covered" if it has at least one valid citation and NO invalid ones.
            // (If it has NO citations, it counts as 'not covered' for the metric, but not 'invalid' for strict ID check)
            const hasValidCitation = citations.length > 0 && invalid.length === 0;

            if (hasValidCitation) {
                validSentences++;
            }

            details.push({
                sentence: sent.substring(0, 100),
                citations,
                isValid: hasValidCitation,
                invalidCitations: invalid
            });
        }

        // Coverage metric: Fraction of "factual" sentences that are supported by valid citations
        const coverage = factualSentences > 0 ? (validSentences / factualSentences) : 1.0;

        return {
            isValid: allInvalidCitations.size === 0,
            invalidCitations: Array.from(allInvalidCitations),
            coverage,
            details
        };
    }

    private static async quickIntentCheck(query: string, context?: any): Promise<{ intent: string, usage: { input: number, output: number, total: number } }> {
        // Same implementation but ensuring we call Sonnet
        const prompt = `Classify user intent for: "${query}"
        Options: FACT_LOOKUP, RESEARCH, DEBUGGING, DESIGN, CHITCHAT, QUERY.
        Output ONLY the enum value in <intent></intent> tags.`;

        try {
            const { text: response, usage } = await BedrockService.sendChat('anthropic.claude-3-5-sonnet-20240620-v1:0', [{ role: 'user', content: prompt }], undefined, 0.1);
            const match = response.match(/<intent>(.*?)<\/intent>/);
            return { intent: match ? match[1].trim() : 'QUERY', usage };
        } catch {
            return { intent: 'QUERY', usage: { input: 0, output: 0, total: 0 } };
        }
    }
}
