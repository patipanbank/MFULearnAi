export declare class LangGraphWebSocketService {
    private wss;
    private connections;
    private pingInterval;
    constructor(server: any);
    private setupWebSocketServer;
    private handleConnection;
    private verifyToken;
    private handleIncomingMessage;
    private handlePing;
    private handleMessage;
    private handleJoinRoom;
    private handleLeaveRoom;
    private handleGetWorkflowState;
    private handleCreateRoom;
    private sendMessage;
    private sendError;
    private startPingInterval;
    shutdown(): Promise<void>;
    getStats(): any;
}
//# sourceMappingURL=LangGraphWebSocketService.d.ts.map