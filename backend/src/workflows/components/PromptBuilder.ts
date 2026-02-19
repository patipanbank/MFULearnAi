import { AgentContext, WorkflowState, NativeDocBlock, ExtractedTextBlock } from '../types/AgentTypes';

export class PromptBuilder {
    static buildInitialMessages(ctx: AgentContext, state: WorkflowState) {
        const { message, images } = ctx;
        const { smartContext, nativeDocBlocks, extractedTextBlocks, history } = state;

        // --- Logic: Refusal & Policy ---
        const hasPolicyContext = !!state.policyContext;
        const isOrganizationalQuery = /policy|regulation|guideline|document|files|contract|agreement|budget|contact|email|who is|fee|calendar|schedule|deadline|registration|course|gpa|grade/i.test(message);

        let refusalRule: string;
        if (hasPolicyContext) {
            // Policy context already injected — DO NOT tell model to search for policies
            refusalRule = `- UNIVERSITY POLICY CONTEXT has been provided below. It was ALREADY RETRIEVED from the Knowledge Base. Answer policy questions using ONLY this context.\n- CRITICAL: The 'search' tool EXCLUDES policy documents by design. Using it for policy questions will return ZERO results and waste a step. Do NOT use 'search' for policy-related questions.\n- For non-policy questions, you may use the 'search' tool normally.`;
        } else if (isOrganizationalQuery) {
            refusalRule = `- If the Knowledge Base or Context does not explicitly contain the answer, you MUST use the 'search' tool to find it. Do NOT say "I don't have enough information" without searching first.`;
        } else {
            refusalRule = `- Basic factual questions may be answered using internal knowledge.\n- WARNING: If the question pertains to specific organizational policies absent in context, you MUST use the Search tool.`;
        }

        // --- Block 1: Persona & Rules ---
        const systemBlocks: Array<{ text: string }> = [];
        systemBlocks.push({
            text: `You are the DinDin Ai. You are efficient and helpful.
You can see and analyze attached images. Use this capability to answer questions about visual content.
=== TRUTH PRIORITY ===
1. University Policy Context (if provided below — this is AUTHORITATIVE for policy questions)
2. Canonical Memory
3. Tool Results (Search/Calc)
4. Attached Files
5. Internal Knowledge

=== CRITICAL RULES ===
- Use the 'search' tool if you need information about the University or System (but NOT for policies if Policy Context is already provided).
- Use the 'calculator' tool for any math.
${refusalRule}
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
            ...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content, images: m.images })),
            { role: 'user', content: userContent }
        ];
    }
}
