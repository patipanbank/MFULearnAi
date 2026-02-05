import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
    correlationId: string;
    userId?: string;
}

export const contextStorage = new AsyncLocalStorage<RequestContext>();

export const ContextService = {
    run: (context: RequestContext, callback: () => void) => {
        contextStorage.run(context, callback);
    },

    get: (): RequestContext | undefined => {
        return contextStorage.getStore();
    },

    getCorrelationId: (): string => {
        const store = contextStorage.getStore();
        return store?.correlationId || 'unknown';
    }
};
