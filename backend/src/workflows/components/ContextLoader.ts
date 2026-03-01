import { ChatMessage, SmartContext } from '../../../../shared/types';
import { HistoryService } from '../../services/HistoryService';
import { AGENT_EVENTS, AgentContext } from '../types/AgentTypes';
import { AGENT_MESSAGES } from '../types/AgentConstants';

export interface ContextLoadResult {
    history: ChatMessage[];
    smartContext: SmartContext | null;
}

export class ContextLoader {
    static async loadContext(
        ctx: AgentContext,
        emit: (type: string, payload: Record<string, unknown>) => void
    ): Promise<ContextLoadResult> {
        emit(AGENT_EVENTS.STATUS, { message: AGENT_MESSAGES.STATUS_LOADING_CONTEXT });

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
