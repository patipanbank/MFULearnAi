import { BedrockService } from './BedrockService';
import { ExecutionTrace } from './agent/types'; // Updated to use local types
import { LoggerService } from './LoggerService';

export class ResponseSynthesizer {

    static async generate(
        query: string,
        trace: ExecutionTrace,
        history: any[],
        metadata?: any, // ragContext, fileContext, smartContext
        overrideSystemPrompt?: string
    ): Promise<string> {

        // R5.2: Single Responsibility.
        // R7.2: Response is grounded in Trace.

        const successfulSteps = trace.steps.filter(s => s.status === 'SUCCESS');
        const failedSteps = trace.steps.filter(s => s.status === 'FAILURE' || s.status === 'TIMEOUT');

        // Construct Context
        let traceContext = "=== EXECUTION TRACE ===\n";
        if (trace.steps.length === 0) {
            traceContext += "No tools were executed (Chitchat or Fallback).\n";
        } else if (successfulSteps.length === 0 && failedSteps.length > 0) {
            traceContext += "All tools failed.\n";
            failedSteps.forEach(s => traceContext += `Step ${s.stepId} (${s.tool}): FAILED - ${s.error}\n`);
        } else {
            successfulSteps.forEach(s => {
                let outputStr = '';
                // Special handling for Search Tool to avoid JSON escaping and truncation of valuable knowledge
                if (s.tool === 'search' && typeof s.output === 'string') {
                    outputStr = `\n<<<< SEARCH RESULT START >>>>\n${s.output}\n<<<< SEARCH RESULT END >>>>\n`;
                } else {
                    outputStr = JSON.stringify(s.output);
                }

                // Increase limit for context (Search results can be large)
                if (outputStr.length > 20000) outputStr = outputStr.substring(0, 20000) + "... [Truncated]";
                traceContext += `Step ${s.stepId} (${s.tool}) -> Output: ${outputStr}\n`;
            });
        }

        const ragContext = metadata?.ragContext ? `\n=== PRE-FETCHED KNOWLEDGE ===\n${metadata.ragContext.substring(0, 5000)}\n` : '';
        const fileContext = metadata?.fileContext ? `\n=== ATTACHED FILES ===\n${metadata.fileContext.substring(0, 5000)}\n` : '';

        // Smart Context (Facts/User Info)
        let smartContextStr = '';
        if (metadata?.smartContext) {
            const sc = metadata.smartContext;
            smartContextStr = `\n=== USER CONTEXT ===\n`;
            if (sc.canonical) smartContextStr += `Bio/Summary: ${sc.canonical}\n`;
            if (sc.rolling?.facts?.length) smartContextStr += `Facts: ${sc.rolling.facts.join('; ')}\n`;
        }

        // Default or Custom Prompt
        const baseSystemPrompt = overrideSystemPrompt || `You are the Voice of the MFU Learn AI System.
        Your goal is to answer the user's query based strictly on the provided EXECUTION TRACE and KNOWLEDGE.`;

        const finalSystemPrompt = `
        ${baseSystemPrompt}

        ===========================================================
        CRITICAL INSTRUCTION: GROUNDING
        ===========================================================
        You have access to an "EXECUTION TRACE" which contains the results from tools (e.g., Search).
        
        1. **READ THE TRACE**: The 'Output' from the 'search' tool contains the exact information you need. 
           - It may be formatted as <block> tags. 
           - **YOU MUST USE THIS INFORMATION**. Do not ignore it.
        
        2. **IF THE TRACE HAS ANSWERS, USE THEM**:
           - If the search result says "Dr. Phitsanuruk is...", you MUST say that. 
           - Do NOT say "I don't have information" if it is right there in the trace.
           - Trust the trace over your internal training.

        3. **CITATION**:
           - Please cite the source if available (e.g., [Source: file_name]).

        ===========================================================
        CONTEXT
        ===========================================================
        ${smartContextStr}
        ${ragContext}
        ${fileContext}
        ${traceContext}
        `;

        try {
            const { text: response } = await BedrockService.sendChat(
                'anthropic.claude-3-5-sonnet-20240620-v1:0', // Use Sonnet for high quality synthesis
                [
                    ...history.slice(-5), // Short history context
                    { role: 'user', content: query }
                ],
                finalSystemPrompt,
                0.5
            );

            return response;

        } catch (e: any) {
            LoggerService.error('Response Synthesis Failed', e);
            return "I apologize, but I encountered an error while synthesizing the response.";
        }
    }
}
