import { AgentContext, WorkflowState, NativeDocBlock, ExtractedTextBlock } from '../types/AgentTypes';
import { AGENT_CONSTANTS } from '../types/AgentConstants';
import { LoggerService } from '../../services/LoggerService';

export class PromptBuilder {
    static buildInitialMessages(ctx: AgentContext, state: WorkflowState) {
        const { message, images } = ctx;
        const { smartContext, nativeDocBlocks, extractedTextBlocks, history } = state;

        // --- Block 1: Persona & Rules ---
        const systemBlocks: Array<{ text: string }> = [];
        systemBlocks.push({
            text: `You are the DinDin Ai. You are efficient and helpful.
You can see and analyze attached images. Use this capability to answer questions about visual content.
=== TRUTH PRIORITY ===
1. Tool Results (Search/Calc)
2. Canonical Memory
3. Attached Files
4. Internal Knowledge

=== CRITICAL RULES ===
- Use the 'search' tool if the user asks about specific University information, policies, regulations, fees, schedules, or personnel.
- Use the 'calculator' tool for any math.
- Use 'search' when the question involves specific organizational data that may change over time.
- Do NOT answer from internal knowledge alone for organization-specific questions.
- Always start by planning your next step if complex.
- If the attached files or search results do NOT contain the answer, say so clearly. Do NOT guess.`
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
            LoggerService.debug('[PromptBuilder] Processing images', JSON.stringify(images.map((i: any) => ({
                type: i?.type,
                format: i?.format,
                sourceKeys: i?.source ? Object.keys(i.source) : 'missing',
                hasBytes: i?.source?.bytes ? true : false
            })), null, 2));

            // Bedrock Converse API expects { image: { source: { bytes: ... }, format: ... } }
            // But our 'bedrock-text' proxy expects { type: 'image', source: ... } to process it correctly.
            // It will then unwrap it to { image: ... } and hopefully handle Base64 conversion.
            userContent.push(...images.map((img: any) => ({
                type: 'image',
                source: img
            })));
        }

        // --- Final Message Stack ---
        return [
            { role: 'system', content: systemBlocks },
            ...history.slice(-AGENT_CONSTANTS.HISTORY_WINDOW_SIZE).map((m: any) => ({ role: m.role, content: m.content, images: m.images })),
            { role: 'user', content: userContent }
        ];
    }
}
