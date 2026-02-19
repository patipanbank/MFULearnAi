import { AgentContext, WorkflowState, NativeDocBlock, ExtractedTextBlock } from '../types/AgentTypes';
import { PromptService, PromptVariableValues } from '../../services/PromptService';
import { SYSTEM_MODELS } from '../../config/models';
import { LoggerService } from '../../services/LoggerService';

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
    static async buildInitialMessages(ctx: AgentContext, state: WorkflowState, allowedTools: any[] = []) {
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
            hasPolicyContext: String(!!state.policyContext),
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

        // --- Logic: Refusal & Policy ---
        const hasPolicyContext = !!state.policyContext;
        const isOrganizationalQuery = /policy|regulation|guideline|document|files|contract|agreement|budget|contact|email|who is|fee|calendar|schedule|deadline|registration|course|gpa|grade/i.test(message);

        let refusalRule: string;
        if (hasPolicyContext) {
            refusalRule = `- UNIVERSITY POLICY CONTEXT has been provided below. It was ALREADY RETRIEVED from the Knowledge Base. Answer policy questions using ONLY this context.\n- CRITICAL: The 'search' tool EXCLUDES policy documents by design. Using it for policy questions will return ZERO results and waste a step. Do NOT use 'search' for policy-related questions.\n- For non-policy questions, you may use the 'search' tool normally.`;
        } else if (isOrganizationalQuery) {
            refusalRule = `- If the Knowledge Base or Context does not explicitly contain the answer, you MUST use the 'search' tool to find it. Do NOT say "I don't have enough information" without searching first.`;
        } else {
            refusalRule = `- Basic factual questions may be answered using internal knowledge.\n- WARNING: If the question pertains to specific organizational policies absent in context, you MUST use the Search tool.`;
        }

        // --- Block 1: Persona & Rules ---
        const systemBlocks: Array<{ text: string }> = [];

        // Dynamically build tool instructions
        let toolInstructions = '';
        if (toolNames.includes('search')) {
            toolInstructions += '- Use the \'search\' tool if you need information about the University or System (but NOT for policies if Policy Context is already provided).\n';
        }
        if (toolNames.includes('calculator')) {
            toolInstructions += '- Use the \'calculator\' tool for any math.\n';
        }

        // Generic instruction for other tools if they exist
        const extraTools = toolNames.filter(name => name !== 'search' && name !== 'calculator');
        if (extraTools.length > 0) {
            toolInstructions += `- Use these additional tools when appropriate: ${extraTools.join(', ')}.\n`;
        }

        systemBlocks.push({
            text: `${personaPrompt}
You can see and analyze attached images. Use this capability to answer questions about visual content.
=== TRUTH PRIORITY ===
1. University Policy Context (if provided below — this is AUTHORITATIVE for policy questions)
2. Canonical Memory
3. Tool Results (from available tools: ${toolListStr})
4. Attached Files
5. Internal Knowledge

=== CRITICAL RULES ===
${toolInstructions}${refusalRule}
- Always start by planning your next step if complex.
- If the attached files or search results do NOT contain the answer, say so clearly. Do NOT guess.`
        });

        // --- Block 2: Session Context ---
        systemBlocks.push({
            text: `=== SESSION CONTEXT ===
${smartContext?.canonical || 'First session.'}
${JSON.stringify(smartContext?.rolling || {}, null, 2)}`
        });

        // --- Block: Policies ---
        if (state.policyContext) {
            systemBlocks.push({ text: state.policyContext });
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

        userContent.push({ type: 'text', text: message });

        if (images && images.length > 0) {
            console.log('[PromptBuilder] Processing images:', JSON.stringify(images.map((i: any) => ({
                type: i?.type,
                format: i?.format,
                sourceKeys: i?.source ? Object.keys(i.source) : 'missing',
                hasBytes: i?.source?.bytes ? true : false
            })), null, 2));

            userContent.push(...images.map((img: any) => ({
                type: 'image',
                source: img
            })));
        }

        // --- Final Message Stack ---
        return [
            { role: 'system', content: systemBlocks },
            ...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content, images: m.images })),
            { role: 'user', content: userContent }
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
