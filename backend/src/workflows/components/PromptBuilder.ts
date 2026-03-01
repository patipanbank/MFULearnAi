import { AgentContext, WorkflowState, NativeDocBlock, ExtractedTextBlock, BedrockMessage } from '../types/AgentTypes';
import { PromptService, PromptVariableValues } from '../../services/PromptService';
import { SYSTEM_MODELS } from '../../config/models';
import { AGENT_CONSTANTS } from '../types/AgentConstants';
import { LoggerService } from '../../services/LoggerService';
import { AgentTool } from '../../tools/AgentTool';

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

        // --- Fetch dynamic persona prompt from DB ---
        let personaPrompt: string;
        try {
            personaPrompt = await PromptService.getResolvedAgentPrompt(envType, variableValues);
        } catch (err: any) {
            LoggerService.warn('prompt_fetch_fallback', {
                error: err.message,
                envType
            });
            // Fallback to hardcoded prompt in case of DB/Redis failure
            personaPrompt = this.getHardcodedFallback();
        }

        // --- Block 1: Persona & Rules ---
        const systemBlocks: Array<{ text: string }> = [];

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

        // --- Block 2: Session Context ---
        systemBlocks.push({
            text: `=== SESSION CONTEXT ===
${smartContext?.canonical || 'First session.'}
${JSON.stringify(smartContext?.rolling || {}, null, 2)}`
        });

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

        userContent.push({ type: 'text', text: message });

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
        return [
            { role: 'system' as const, content: systemBlocks },
            ...history.slice(-AGENT_CONSTANTS.HISTORY_WINDOW_SIZE).map((m: any) => ({ role: m.role as BedrockMessage['role'], content: m.content, images: m.images })),
            { role: 'user' as const, content: userContent }
        ];
    }

    /**
     * Hardcoded fallback prompt — used when DB/Redis are unavailable.
     * This ensures the agent never starts without a persona.
     */
    private static getHardcodedFallback(): string {
        return `You are the DinDin AI. You are efficient and helpful.`;
    }
}
