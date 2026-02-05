import { ChatMessage } from '../../../../shared/types';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { HistoryService } from '../services/HistoryService';
import { ContextService } from '../services/ContextService';
import { KnowledgeService } from '../services/KnowledgeService';
import { Response } from 'express';
import { AgentTool } from '../tools/AgentTool';
import { CalculatorTool } from '../tools/CalculatorTool';

// Registry
const AVAILABLE_TOOLS: AgentTool[] = [
    new CalculatorTool()
];

export class AgentWorkflow {
    static async execute(
        userId: string,
        sessionId: string,
        query: string,
        userRole: string,
        userDepartment: string | undefined, // Added department for RAG
        collectionId: string | undefined,   // Added collectionId for RAG
        res: Response
    ) {
        const MAX_STEPS = 5;
        let steps = 0;

        // 1. Prepare Tools
        const allowedTools = AVAILABLE_TOOLS.filter(t => t.isAllowed(userRole));
        const toolSchemas = allowedTools.map(t => t.schema).join('\n');

        // 1.1 Load History (Agent Memory)
        const { messages: history } = await HistoryService.getContext(userId, sessionId);

        // 1.2 RAG Search (Merged from ChatWorkflow)
        const userContext = { userId, role: userRole, department: userDepartment };
        LoggerService.log('info', 'agent_rag_start', { query, collectionId }, userId);

        const ragContext = await KnowledgeService.search(query, userContext, collectionId);

        LoggerService.log('info', 'agent_rag_result', {
            found: !!ragContext,
            length: ragContext?.length || 0
        }, userId);

        const ragSystemPrompt = ragContext
            ? `\n\n=== KNOWLEDGE BASE CONTEXT ===\n${ragContext}\n==============================\nUse this context to answer the user's question if relevant.`
            : '';

        const systemPrompt = `
You are an intelligent agent capable of using tools to solve problems.

AVAILABLE TOOLS:
${toolSchemas}

${ragSystemPrompt}

INSTRUCTIONS:
1. To use a tool, output a XML block like:
   <tool_use>
     <name>tool_name</name>
     <parameters>
       <param_name>value</param_name>
     </parameters>
   </tool_use>
2. Wait for the user to provide the tool result in <tool_result> tags.
3. Once you have the answer, output it normally without tool tags.
4. Do not loop more than ${MAX_STEPS} times.

Current User Role: ${userRole}
`;

        // Incorporate History
        // Convert history to format if needed, but here we just append.
        // For the Agent Loop, we usually want specific System -> History -> User flow.
        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt, timestamp: new Date() },
            ...history,
            { role: 'user', content: query, timestamp: new Date() }
        ];

        // 2. ReAct Loop
        // Note: For streaming response to frontend, we need to handle "thinking" vs "final answer".
        // Here we might just stream the FINAL answer, or stream status updates.
        // For simplicity, let's stream the final answer only, but log steps.

        // We cannot easily stream the "thought process" if we want to hide it or format it?
        // Let's assume we output "Thinking..." initially if we are in agent mode?
        // Or better: Use the same stream approach but intercept "Thought" blocks?
        // For this implementation, we will NOT stream the intermediate steps to the client to keep it clean, 
        // but we will stream the final response.

        // TODO: This loop is synchronous until final answer. 
        // Use res.write to send "Thinking..." events?
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Agent is thinking...' })}\n\n`);

        while (steps < MAX_STEPS) {
            steps++;
            LoggerService.log('info', 'agent_step', { step: steps, sessionId }, userId);

            // Call Model (Non-Streaming for internal reasoning)
            // We need a non-streaming method in BedrockService or collect stream.
            // We will use streamChat but collect all text.
            let reply = '';
            await new Promise<void>(resolve => {
                const mockRes: any = {
                    write: (chunk: any) => {
                        // Parse SSE format locally
                        const chunkStr = chunk.toString();
                        const lines = chunkStr.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const d = line.replace('data: ', '');
                                if (d === '[DONE]') continue;
                                try {
                                    const j = JSON.parse(d);
                                    if (j.text) reply += j.text;
                                } catch (e) { }
                            }
                        }
                    },
                    end: resolve,
                    setHeader: () => { },
                    on: () => { }
                };
                BedrockService.streamChat(messages, 'anthropic.claude-3-5-sonnet-20240620-v1:0', mockRes, async () => { });
            });

            // Parse for Tool Use
            // Regex for <tool_use>...</tool_use>
            const toolRegex = /<tool_use>[\s\S]*?<\/tool_use>/;
            const match = reply.match(toolRegex);

            if (match) {
                const toolBlock = match[0];
                messages.push({ role: 'assistant', content: reply, timestamp: new Date() });

                // Parse XML
                const nameMatch = toolBlock.match(/<name>(.*?)<\/name>/);
                const name = nameMatch ? nameMatch[1] : null;

                if (name) {
                    const tool = allowedTools.find(t => t.name === name);
                    if (tool) {
                        // Parse Params (Simple Regex for demo, real XML parser robust recommended)
                        // Assuming simple structure
                        const params: any = {};
                        // Capture content between <parameters> and </parameters>
                        const paramBodyMatch = toolBlock.match(/<parameters>([\s\S]*?)<\/parameters>/);
                        if (paramBodyMatch) {
                            const paramBody = paramBodyMatch[1];
                            // Find all tags inside
                            const tagRegex = /<(\w+)>(.*?)<\/\1>/g;
                            let pMatch;
                            while ((pMatch = tagRegex.exec(paramBody)) !== null) {
                                const key = pMatch[1];
                                const val = pMatch[2];
                                // Attempt number conversion
                                params[key] = isNaN(Number(val)) ? val : Number(val);
                            }
                        }

                        // Execute
                        LoggerService.log('info', 'tool_execution', { tool: name, params }, userId);
                        res.write(`data: ${JSON.stringify({ type: 'status', message: `Executing tool: ${name}` })}\n\n`);

                        const result = await tool.execute(params, { userId, role: userRole });

                        // Append Result
                        const resultMsg = `
<tool_result>
    <tool_name>${name}</tool_name>
    <status>${result.success ? 'success' : 'error'}</status>
    <output>${JSON.stringify(result.result || result.error)}</output>
</tool_result>
`;
                        messages.push({ role: 'user', content: resultMsg, timestamp: new Date() });

                    } else {
                        messages.push({ role: 'user', content: `<tool_result><error>Tool ${name} not found or not allowed</error></tool_result>`, timestamp: new Date() });
                    }
                }
            } else {
                // No tool use -> Final Answer
                // Stream this reply to user
                res.write(`data: ${JSON.stringify({ text: reply })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();

                // SAVE HISTORY
                const userMsg: ChatMessage = { role: 'user', content: query, timestamp: new Date() };
                const assistantMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: new Date() };

                await HistoryService.addMessage(userId, sessionId, userMsg);
                await HistoryService.addMessage(userId, sessionId, assistantMsg);
                await HistoryService.saveToPersistentStorage(
                    userId,
                    sessionId,
                    [userMsg, assistantMsg],
                    { totalTokens: 0 }, // TODO: TRACK TOKENS
                    (process.env.ENV_TYPE || 'TEST') as any,
                    'agent-claude-3.5-sonnet'
                );

                return;
            }
        }

        // Timeout / Max Steps Reached
        const timeoutMsg = "I'm sorry, I couldn't complete the task within the step limit.";
        res.write(`data: ${JSON.stringify({ text: timeoutMsg })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();

        // Save Failure
        const userMsg: ChatMessage = { role: 'user', content: query, timestamp: new Date() };
        const assistantMsg: ChatMessage = { role: 'assistant', content: timeoutMsg, timestamp: new Date() };
        await HistoryService.addMessage(userId, sessionId, userMsg);
        await HistoryService.addMessage(userId, sessionId, assistantMsg);
        await HistoryService.saveToPersistentStorage(
            userId,
            sessionId,
            [userMsg, assistantMsg],
            { totalTokens: 0 },
            (process.env.ENV_TYPE || 'TEST') as any,
            'agent-claude-3.5-sonnet'
        );
    }
}
