export declare class SimpleWebSocketService {
    private wss;
    private connections;
    private pingInterval;
    constructor(server: any);
    private setupWebSocketServer;
    private handleConnection;
    private verifyToken;
    private handleMessage;
    private handlePing;
    private handleSendMessage;
    private handleJoinConversation;
    private handleLeaveConversation;
    private sendMessage;
    private sendError;
    private startPingInterval;
    shutdown(): Promise<void>;
    getStats(): any;
}
//# sourceMappingURL=SimpleWebSocketService.d.ts.map