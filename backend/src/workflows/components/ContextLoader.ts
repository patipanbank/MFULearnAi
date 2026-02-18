import { HistoryService } from '../../services/HistoryService';
import { AGENT_EVENTS } from '../types/AgentTypes';

export class ContextLoader {
    static async loadContext(
        userId: string,
        sessionId: string,
        emit: (type: string, payload: any) => void
    ) {
        emit(AGENT_EVENTS.STATUS, { message: 'กำลังโหลดบริบทการสนทนา...' });
        const { messages: history, smartContext } = await HistoryService.getContext(
            userId,
            sessionId
        );

        emit(AGENT_EVENTS.CONTEXT_LOADED, {
            historyCount: history.length,
            hasSmartContext: !!smartContext,
            smartContextVersion: smartContext?.version || 0
        });

        return { history, smartContext };
    }
}
