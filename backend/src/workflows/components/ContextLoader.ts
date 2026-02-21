import { HistoryService } from '../../services/HistoryService';
import { AGENT_EVENTS, AgentContext } from '../types/AgentTypes';

export interface ContextLoadResult {
    history: any[];
    smartContext: any;
}

export class ContextLoader {
    static async loadContext(
        ctx: AgentContext,
        emit: (type: string, payload: any) => void
    ): Promise<ContextLoadResult> {
        emit(AGENT_EVENTS.STATUS, { message: 'กำลังโหลดบริบทการสนทนา...' });

        const { messages: history, smartContext } = await HistoryService.getContext(
            ctx.userId,
            ctx.sessionId
        );

        emit(AGENT_EVENTS.CONTEXT_LOADED, {
            historyCount: history.length,
            hasSmartContext: !!smartContext,
            smartContextVersion: smartContext?.version || 0
        });

        return { history, smartContext };
    }
}
