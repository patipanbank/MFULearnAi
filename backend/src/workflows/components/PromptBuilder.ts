import { AgentContext, WorkflowState, NativeDocBlock, ExtractedTextBlock, BedrockMessage } from '../types/AgentTypes';
import { PromptService, PromptVariableValues } from '../../services/PromptService';
import { SYSTEM_MODELS } from '../../config/models';
import { AGENT_CONSTANTS } from '../types/AgentConstants';
import { LoggerService } from '../../services/LoggerService';
import { AgentTool } from '../../tools/AgentTool';
import { TokenCounter } from '../../infra/tokens/TokenCounter';
import { PromptExperimentService } from '../../services/PromptExperimentService';
import { UserMemoryService } from '../../services/UserMemoryService';
import { buildModelDirectives, getModelAdapter } from '../../config/ModelAdapter';
import { ToolSelectionHintService } from '../../services/ToolSelectionHintService';

/**
 * Determines the environment type from runtime context.
 * Uses APP_ENV env var, falling back to 'TEST' for safety.
 */
function resolveEnvType(): 'TEST' | 'PROD' {
    const env = process.env.APP_ENV || process.env.NODE_ENV || 'development';
    return env === 'production' ? 'PROD' : 'TEST';
}

export class PromptBuilder {
    /**
     * Build the initial message stack for the agent.
     * Now async — pulls the system prompt dynamically from DB via PromptService.
     * Supports A/B testing via PromptExperimentService and cross-session user memory.
     */
    static async buildInitialMessages(ctx: AgentContext, state: WorkflowState, allowedTools: AgentTool[] = []): Promise<BedrockMessage[]> {
        const { message, images } = ctx;
        const { smartContext, nativeDocBlocks, extractedTextBlocks, history } = state;

        // Extract tool names for the prompt
        const toolNames = allowedTools.map(t => t.schemaJSON?.name || t.name).filter(Boolean);
        const toolListStr = toolNames.join(', ') || 'none';

        // --- Resolve environment & build variable values ---
        const envType = resolveEnvType();
        const variableValues: PromptVariableValues = {
            userRole: ctx.userRole || 'user',
            userDepartment: ctx.userDepartment || '',
            userName: '', // Not available in current context — intentionally blank
            sessionId: ctx.sessionId,
            messageCount: String(history.length),
            date: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }),
            time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
            environment: envType,
            modelId: SYSTEM_MODELS.AGENT,
            hasFiles: String(nativeDocBlocks.length > 0 || extractedTextBlocks.length > 0),
            hasPolicyContext: 'false', // Policy is now tool-based, never pre-injected
            toolList: toolListStr,
        };

        // --- A/B Testing: Check for active experiment ---
        let personaPrompt: string;
        let experimentContext: { experimentId: string; variantId: string } | null = null;

        try {
            // Try experiment first
            const experimentResult = await PromptExperimentService.resolvePromptForUser(ctx.userId, envType);
            if (experimentResult) {
                personaPrompt = PromptService.substituteVariables(experimentResult.content, variableValues);
                experimentContext = {
                    experimentId: experimentResult.experimentId,
                    variantId: experimentResult.variantId
                };
                LoggerService.info('prompt_experiment_assigned', {
                    userId: ctx.userId,
                    experimentId: experimentResult.experimentId,
                    variantId: experimentResult.variantId
                });
            } else {
                personaPrompt = await PromptService.getResolvedAgentPrompt(envType, variableValues);
            }
        } catch (err: any) {
            LoggerService.warn('prompt_fetch_fallback', {
                error: err.message,
                envType
            });
            // Fallback to hardcoded prompt in case of DB/Redis failure
            personaPrompt = this.getHardcodedFallback();
        }

        // Store experiment context in WorkflowState for ResultPersister
        (state as any)._experimentContext = experimentContext;

        // --- Block 0: Model-Specific Directives (Thai thinking, tool decision tree) ---
        const systemBlocks: Array<{ text: string }> = [];
        const modelDirectives = buildModelDirectives(SYSTEM_MODELS.AGENT);
        if (modelDirectives) {
            systemBlocks.push({ text: modelDirectives });
            LoggerService.debug('prompt_model_directives_injected', {
                family: getModelAdapter(SYSTEM_MODELS.AGENT).family,
                length: modelDirectives.length
            });
        }

        // --- Block 1: Persona & Rules ---

        // Dynamically build tool instructions
        let toolInstructions = '';
        if (toolNames.includes('search')) {
            toolInstructions += '- Use the \'search\' tool to find information about the University or System.\n';
        }
        if (toolNames.includes('check_policy')) {
            toolInstructions += `- Use the 'check_policy' tool when the question may relate to ANY policy, rule, or regulation in the Knowledge Base — including PDPA, data protection, organizational rules, academic regulations, HR policies, disciplinary matters, legal compliance, or any official procedures. Do NOT answer policy questions from internal knowledge — always verify with check_policy first.
  - IMPORTANT: When calling check_policy, pass the query BROADLY. Do NOT add "ในมหาวิทยาลัย" or "มหาวิทยาลัย" to the query. The Knowledge Base contains policies from multiple domains (PDPA, legal, HR, etc.) — narrowing the query will miss relevant results. Example: user asks "ขโมยของโดนโทษแบบไหน" → pass "บทลงโทษสำหรับการขโมยของ" NOT "บทลงโทษสำหรับการขโมยของในมหาวิทยาลัย"\n`;
        }
        if (toolNames.includes('calculator')) {
            toolInstructions += '- Use the \'calculator\' tool for any math.\n';
        }
        if (toolNames.includes('lookup_knowledge_table')) {
            toolInstructions += `- Use the 'lookup_knowledge_table' tool to search structured data tables (spreadsheets, CSV) for specific rows, values, or entries. Use it when the user asks about data that comes from tabular sources (e.g. student lists, product catalogs, schedules). Pass the search value as 'query' and optionally specify a 'column' name to narrow the search.\n`;
        }

        // Generic instruction for other tools if they exist
        const knownTools = ['search', 'check_policy', 'calculator'];
        const extraTools = toolNames.filter(name => !knownTools.includes(name));
        if (extraTools.length > 0) {
            toolInstructions += `- You also have these tools: ${extraTools.join(', ')}. Use them when appropriate.\n`;
            toolInstructions += `- IMPORTANT: When multiple tools provide overlapping information, prefer a SINGLE tool call that answers the question best. Do NOT call multiple tools for the same data.\n`;
        }

        systemBlocks.push({
            text: `${personaPrompt}
You can see and analyze attached images. Use this capability to answer questions about visual content.
=== TRUTH PRIORITY ===
1. Tool Results (check_policy for policies, search for general info)
2. Canonical Memory
3. Attached Files
4. Internal Knowledge

=== CRITICAL RULES ===
${toolInstructions}- Always start by planning your next step when using tools or answering complex tasks.
- If the attached files or search results do NOT contain the answer, say so clearly. Do NOT guess.
- For any question about policies, rules, regulations, or compliance: you MUST use check_policy. Never answer from internal knowledge alone.`
        });

        // --- Block 2: Session Context (compact format to save tokens) ---
        const rollingCompact = smartContext?.rolling
            ? JSON.stringify(smartContext.rolling)
            : '{}';
        systemBlocks.push({
            text: `=== SESSION CONTEXT ===
${smartContext?.canonical || 'First session.'}
${rollingCompact}`
        });

        // --- Block 2.5: Cross-Session User Memory ---
        try {
            const userMemory = await UserMemoryService.getMemoryForPrompt(ctx.userId);
            if (userMemory) {
                systemBlocks.push({ text: userMemory });
            }
        } catch {
            // Non-critical — skip user memory on error
        }

        // --- Block 3: File Hints ---
        if (nativeDocBlocks.length > 0) {
            const names = nativeDocBlocks.map((d: NativeDocBlock) => d.name).join(', ');
            systemBlocks.push({ text: `The user has attached ${nativeDocBlocks.length} document(s): ${names}. They are included as native document blocks. Read them to answer.` });
        }
        if (extractedTextBlocks.length > 0) {
            const names = extractedTextBlocks.map((b: ExtractedTextBlock) => b.fileName).join(', ');
            systemBlocks.push({ text: `The user has attached ${extractedTextBlocks.length} large file(s): ${names}. The text has been extracted and included in the user message.` });
        }

        // --- Construct User Content ---
        const userContent: any[] = [];
        if (nativeDocBlocks.length > 0) userContent.push(...nativeDocBlocks);

        for (const etb of extractedTextBlocks) {
            userContent.push({
                type: 'text',
                text: `=== Extracted content from "${etb.fileName}" ===\n${etb.text}\n=== End of "${etb.fileName}" ===`
            });
        }

        // --- Tool Selection Hint (pre-LLM routing for weaker models) ---
        const adapter = getModelAdapter(SYSTEM_MODELS.AGENT);
        let messageWithHint = message;
        if (adapter.injectReasoningScaffold) {
            const hint = ToolSelectionHintService.analyze(message, toolNames);
            if (hint) {
                messageWithHint = message + ToolSelectionHintService.formatHintForPrompt(hint);
                LoggerService.info('tool_hint_injected', {
                    tool: hint.tool,
                    confidence: hint.confidence,
                    reason: hint.reason
                });
            }
        }

        userContent.push({ type: 'text', text: messageWithHint });

        if (images && images.length > 0) {
            LoggerService.debug('prompt_builder_images', {
                imageCount: images.length,
                imageInfo: images.map((i: any) => ({
                    type: i?.type,
                    format: i?.format,
                    sourceKeys: i?.source ? Object.keys(i.source) : 'missing',
                    hasBytes: !!i?.source?.bytes
                }))
            });

            userContent.push(...images.map((img: any) => ({
                type: 'image',
                source: img
            })));
        }

        // --- Final Message Stack ---
        // Smart history compression: only send last RECENT_RAW messages in full,
        // older messages are summarized. SmartContext canonical already captures older context.
        const RECENT_RAW = 4; // Last 2 user + 2 assistant messages sent in full
        const windowedHistory = history.slice(-AGENT_CONSTANTS.HISTORY_WINDOW_SIZE);
        const compressedMessages = PromptBuilder.compressHistory(windowedHistory, RECENT_RAW);

        const candidate = [
            { role: 'system' as const, content: systemBlocks },
            ...compressedMessages,
            { role: 'user' as const, content: userContent }
        ];

        // Token budget enforcement — progressively trim if over budget
        return PromptBuilder.enforceTokenBudget(candidate, AGENT_CONSTANTS.MAX_INPUT_TOKEN_BUDGET);
    }

    // ── Token Budget Enforcement ──────────────────────────────────────────

    /**
     * Estimate token count for a message array.
     * Uses enterprise TokenCounter with character-class-aware analysis.
     * Handles Thai, CJK, and Latin text with calibrated per-class weights.
     */
    static estimateTokens(messages: BedrockMessage[]): number {
        return TokenCounter.countMessages(messages);
    }

    /**
     * Enforce a token budget by progressively trimming messages.
     *
     * Trimming order (least valuable first):
     *  1. Compress older history messages more aggressively (50 chars)
     *  2. Drop oldest history messages entirely
     *  3. Truncate session context (canonical memory)
     *
     * System prompt (persona/rules) and current user message are never trimmed.
     */
    private static enforceTokenBudget(messages: BedrockMessage[], budget: number): BedrockMessage[] {
        let estimated = this.estimateTokens(messages);
        if (estimated <= budget) return messages;

        // Deep clone to avoid mutating original
        const trimmed = messages.map(m => ({ ...m }));

        // Identify system message and history messages (between system and last user)
        const systemIdx = 0;
        const lastUserIdx = trimmed.length - 1;
        const historyRange = { start: 1, end: lastUserIdx - 1 };

        // Pass 1: Compress all history messages to 50 chars
        for (let i = historyRange.start; i <= historyRange.end && i < trimmed.length; i++) {
            const msg = trimmed[i];
            const text = typeof msg.content === 'string' ? msg.content : '';
            if (text.length > 50) {
                trimmed[i] = { ...msg, content: text.substring(0, 50) + '…' };
            }
        }
        estimated = this.estimateTokens(trimmed);
        if (estimated <= budget) {
            LoggerService.info('token_budget_trimmed', { strategy: 'compress_history', estimated, budget });
            return trimmed;
        }

        // Pass 2: Drop oldest history messages one by one
        while (estimated > budget && historyRange.start <= historyRange.end) {
            trimmed.splice(historyRange.start, 1);
            historyRange.end--;
            estimated = this.estimateTokens(trimmed);
        }
        if (estimated <= budget) {
            LoggerService.info('token_budget_trimmed', { strategy: 'drop_history', estimated, budget });
            return trimmed;
        }

        // Pass 3: Truncate canonical memory in system prompt
        const sysMsg = trimmed[systemIdx];
        if (Array.isArray(sysMsg.content)) {
            const blocks = sysMsg.content as Array<{ text: string }>;
            for (let i = blocks.length - 1; i >= 1; i--) {
                const block = blocks[i];
                if (block.text && block.text.includes('SESSION CONTEXT') && block.text.length > 200) {
                    blocks[i] = { text: block.text.substring(0, 200) + '… (trimmed for budget)' };
                    break;
                }
            }
        }

        estimated = this.estimateTokens(trimmed);
        LoggerService.warn('token_budget_enforced', { estimated, budget, strategy: 'truncate_context' });
        return trimmed;
    }

    /**
     * Compress history messages to save tokens.
     * - Last `recentRaw` messages: sent in full (preserves immediate context)
     * - Older messages: truncated to a short summary line to preserve topic flow
     *   without wasting tokens on full content (SmartContext canonical already captures this)
     */
    private static compressHistory(messages: any[], recentRaw: number): BedrockMessage[] {
        if (messages.length <= recentRaw) {
            return messages.map((m: any) => ({
                role: m.role as BedrockMessage['role'],
                content: m.content,
                ...(m.images ? { images: m.images } : {})
            } as BedrockMessage));
        }

        const MAX_COMPRESSED_CHARS = 150; // Short summary per old message
        const olderMessages = messages.slice(0, messages.length - recentRaw);
        const recentMessages = messages.slice(messages.length - recentRaw);

        const compressed: BedrockMessage[] = [];

        for (const m of olderMessages) {
            const rawText = typeof m.content === 'string'
                ? m.content
                : Array.isArray(m.content)
                    ? m.content.map((b: any) => b.text || '').join(' ')
                    : '';

            const truncated = rawText.length > MAX_COMPRESSED_CHARS
                ? rawText.substring(0, MAX_COMPRESSED_CHARS) + '…'
                : rawText;

            compressed.push({
                role: m.role as BedrockMessage['role'],
                content: truncated || '(context captured in session memory)'
            });
        }

        for (const m of recentMessages) {
            compressed.push({
                role: m.role as BedrockMessage['role'],
                content: m.content,
                ...(m.images ? { images: m.images } : {})
            } as BedrockMessage);
        }

        return compressed;
    }

    /**
     * Hardcoded fallback prompt — used when DB/Redis are unavailable.
     * This ensures the agent never starts without a persona.
     */
    private static getHardcodedFallback(): string {
        return `You are the DinDin AI. You are efficient and helpful.`;
    }
}
