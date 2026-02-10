import { ExecutionPlan, ExecutionTrace, TraceStep, WorkflowStep } from './types';
import { ParameterExtractor } from './ParameterExtractor';
import { LoggerService } from '../LoggerService';
import { AgentTool } from '../../tools/AgentTool';

export class ToolOrchestrator {

    static async execute(
        userId: string,
        query: string,
        plan: ExecutionPlan,
        availableTools: AgentTool[], // Typed as any[] or specific Tool interface
        context: any,
        onProgress?: (step: WorkflowStep) => void
    ): Promise<ExecutionTrace> {

        const trace: ExecutionTrace = {
            traceId: (global as any).crypto ? (global as any).crypto.randomUUID() : Math.random().toString(36).substring(7),
            policyId: plan.policyId,
            steps: [],
            metadata: { startTime: new Date().toISOString() }
        };

        const toolsMap = new Map(availableTools.map(t => [t.name, t]));

        for (const step of plan.steps) {
            const stepStart = Date.now();

            // Check Condition
            if (step.condition === 'if_previous_success') {
                const prevStep = trace.steps[trace.steps.length - 1];
                if (prevStep && prevStep.status !== 'SUCCESS') {
                    LoggerService.info('Skipping step due to previous failure', { stepId: step.id });
                    trace.steps.push({
                        stepId: step.id,
                        tool: step.tool,
                        input: {},
                        output: null,
                        status: 'SKIPPED',
                        durationMs: 0,
                        timestamp: new Date().toISOString()
                    });
                    continue;
                }
            }

            if (onProgress) onProgress(step);

            // 1. Extract Parameters
            const args = await ParameterExtractor.extract(userId, query, step, context);

            // 2. Resolve Tool
            const toolInstance = toolsMap.get(step.tool);

            let status: TraceStep['status'] = 'SUCCESS';
            let output: any = null;
            let errorMsg: string | undefined;

            if (!toolInstance) {
                status = 'FAILURE';
                errorMsg = `Tool '${step.tool}' not found or not allowed.`;
                LoggerService.error('tool_not_found', { tool: step.tool }, userId);
            } else {
                try {
                    // R6.1: Full Execution Trace
                    LoggerService.info('tool_execution_start', { tool: step.tool, args }, userId);
                    console.log(`[ToolOrchestrator] Running ${step.tool} with args:`, JSON.stringify(args));

                    const toolResult = await toolInstance.execute(args, context);

                    if (!toolResult.success) {
                        throw new Error(toolResult.error || 'Unknown tool failure');
                    }
                    output = toolResult.result;

                    LoggerService.info('tool_execution_success', { tool: step.tool, outputSummary: typeof output === 'string' ? output.substring(0, 100) : 'Object' }, userId);
                    console.log(`[ToolOrchestrator] ${step.tool} Success`);

                } catch (e: any) {
                    status = (e.message === 'Timeout') ? 'TIMEOUT' : 'FAILURE';
                    errorMsg = e.message;
                    output = { error: e.message };

                    LoggerService.error('tool_execution_failure', { tool: step.tool, error: e.message }, userId);
                    console.error(`[ToolOrchestrator] ${step.tool} Failed:`, e.message);
                }
            }

            // 3. Record Trace
            trace.steps.push({
                stepId: step.id,
                tool: step.tool,
                input: args,
                output: output,
                status,
                error: errorMsg,
                durationMs: Date.now() - stepStart,
                timestamp: new Date().toISOString()
            });

            // Stop if critical failure? Policy dependent. 
            // For now, continue unless specific conditions.
        }

        return trace;
    }
}
