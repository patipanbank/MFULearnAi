export declare class ChatProcessingService {
    private agentCache;
    constructor();
    processMessage(chatId: string, userId: string, content: string, images?: Array<{
        url: string;
        mediaType: string;
    }>): Promise<void>;
    private processWithAI;
    private getOrCreateAgent;
    private executeAgent;
    private handleAgentEvent;
    getStats(): any;
}
export declare const chatProcessingService: ChatProcessingService;
//# sourceMappingURL=ChatProcessingService.d.ts.map