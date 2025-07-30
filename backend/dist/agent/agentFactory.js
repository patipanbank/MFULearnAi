"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgent = createAgent;
function createAgent(llm, tools, prompt) {
    return {
        async run(messages, options) {
            const onEvent = options?.onEvent;
            const maxSteps = options?.maxSteps ?? 5;
            let history = [...messages];
            let scratchpad = [];
            let finalAnswer = '';
            for (let step = 0; step < maxSteps; step++) {
                const fullPrompt = [
                    prompt,
                    ...history.map(m => `${m.role}: ${m.content}`),
                    ...(scratchpad.length ? ['\nAgent scratchpad:', ...scratchpad] : [])
                ].join('\n');
                const llmResponse = await llm.generate(fullPrompt);
                if (onEvent)
                    onEvent({ type: 'chunk', data: llmResponse });
                const toolMatch = llmResponse.match(/\[TOOL:(\w+)\](.*)/s);
                if (toolMatch) {
                    const toolName = toolMatch[1];
                    const toolInput = toolMatch[2]?.trim() || '';
                    if (onEvent)
                        onEvent({ type: 'tool_start', data: { tool_name: toolName, tool_input: toolInput } });
                    const toolFn = tools[toolName];
                    let toolResult = '';
                    const sessionId = options?.sessionId || messages?.sessionId || '';
                    const config = options?.config || undefined;
                    if (toolFn) {
                        try {
                            toolResult = await toolFn(toolInput, sessionId, config);
                            if (onEvent)
                                onEvent({ type: 'tool_result', data: { tool_name: toolName, output: toolResult } });
                        }
                        catch (e) {
                            toolResult = `Tool error: ${e.message}`;
                            if (onEvent)
                                onEvent({ type: 'tool_error', data: { tool_name: toolName, error: toolResult } });
                        }
                    }
                    else {
                        toolResult = `Tool not found: ${toolName}`;
                        if (onEvent)
                            onEvent({ type: 'tool_error', data: { tool_name: toolName, error: toolResult } });
                    }
                    scratchpad.push(`\n[TOOL:${toolName}] ${toolInput}\n[RESULT:${toolName}] ${toolResult}`);
                    history.push({ role: 'function', content: `[${toolName} result]: ${toolResult}` });
                    continue;
                }
                else {
                    finalAnswer = llmResponse;
                    break;
                }
            }
            if (onEvent)
                onEvent({ type: 'end', data: { answer: finalAnswer } });
            return finalAnswer;
        }
    };
}
//# sourceMappingURL=agentFactory.js.map