export declare class WebSocketService {
    private wss;
    private pingInterval;
    private userSessions;
    constructor(server: any);
    private setupWebSocketServer;
    private handleConnection;
    private verifyToken;
    private handleMessage;
    private handlePing;
    private handleJoinRoom;
    private handleCreateRoom;
    private handleChatMessage;
    private handleLeaveRoom;
    private sendError;
    private startPingInterval;
    stop(): void;
    getStats(): any;
}
//# sourceMappingURL=websocketService.d.ts.map