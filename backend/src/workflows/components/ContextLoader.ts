import { HistoryService } from '../../services/HistoryService';
import { PolicyService } from '../../services/PolicyService';
import { AGENT_EVENTS, AgentContext } from '../types/AgentTypes';

export class ContextLoader {
    static async loadContext(
        ctx: AgentContext,
        emit: (type: string, payload: any) => void
    ) {
        emit(AGENT_EVENTS.STATUS, { message: 'กำลังโหลดบริบทการสนทนา...' });

        // User Context for Policy Service
        const userContext = {
            userId: ctx.userId,
            role: ctx.userRole,
            department: ctx.userDepartment
        };

        const [historyResult, policyResult] = await Promise.all([
            HistoryService.getContext(ctx.userId, ctx.sessionId),
            PolicyService.check(ctx.message, userContext)
        ]);

        const { messages: history, smartContext } = historyResult;
        const { policyContext, isRelevant: policyRelevant } = policyResult;

        if (policyRelevant) {
            emit(AGENT_EVENTS.METADATA, { policyRelevant: true });
        }

        emit(AGENT_EVENTS.CONTEXT_LOADED, {
            historyCount: history.length,
            hasSmartContext: !!smartContext,
            smartContextVersion: smartContext?.version || 0,
            policyRelevant
        });

        return { history, smartContext, policyContext };
    }
}
