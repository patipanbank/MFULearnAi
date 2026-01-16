"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWebSocket = void 0;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const chat_1 = require("../services/chat");
const usage_service_1 = require("../services/usage.service");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const HEARTBEAT_INTERVAL = 30000;
const WS_PORT = 5001;
/**
 * Chat WebSocket server handler
 */
class ChatWebSocketServer {
    constructor() {
        this.heartbeatInterval = null;
        this.wss = new ws_1.WebSocketServer({
            port: WS_PORT,
            path: '/ws',
            clientTracking: true,
            verifyClient: this.verifyClient.bind(this),
        });
        this.setupEventHandlers();
        this.startHeartbeat();
        console.log(`WebSocket server started on port ${WS_PORT}`);
    }
    /**
     * Verify client connection with JWT token
     */
    verifyClient(info, callback) {
        try {
            const url = new URL(info.req.url, `http://${info.req.headers.host}`);
            const token = url.searchParams.get('token');
            if (!token) {
                callback(false, 401, 'No token provided');
                return;
            }
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            info.req.user = decoded;
            callback(true);
        }
        catch (error) {
            console.error('WebSocket authentication error:', error);
            callback(false, 401, 'Invalid token');
        }
    }
    /**
     * Set up WebSocket server event handlers
     */
    setupEventHandlers() {
        this.wss.on('connection', this.handleConnection.bind(this));
        this.wss.on('close', () => {
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
            }
        });
    }
    /**
     * Start heartbeat to detect dead connections
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                const extWs = ws;
                if (!extWs.isAlive) {
                    return ws.terminate();
                }
                extWs.isAlive = false;
                extWs.ping();
            });
        }, HEARTBEAT_INTERVAL);
    }
    /**
     * Handle new WebSocket connection
     */
    handleConnection(ws, req) {
        const extWs = ws;
        extWs.isAlive = true;
        // Extract connection parameters
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const urlChatId = url.searchParams.get('chat');
        if (!token) {
            ws.close(1008, 'No authentication token');
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            extWs.userId = decoded.username;
            // Validate and set chatId if provided
            if (urlChatId && this.isValidObjectId(urlChatId)) {
                extWs.chatId = urlChatId;
            }
        }
        catch (error) {
            console.error('Token verification failed:', error);
            ws.close(1008, 'Invalid token');
            return;
        }
        // Set up connection event handlers
        extWs.on('pong', () => {
            extWs.isAlive = true;
        });
        extWs.on('error', (error) => {
            console.error(`WebSocket error for user ${extWs.userId}:`, error);
        });
        extWs.on('message', (message) => {
            this.handleMessage(extWs, message);
        });
    }
    /**
     * Validate MongoDB ObjectId format
     */
    isValidObjectId(id) {
        if (!id)
            return false;
        return /^[0-9a-fA-F]{24}$/.test(id);
    }
    /**
     * Handle incoming WebSocket message
     */
    async handleMessage(ws, rawMessage) {
        try {
            const data = JSON.parse(rawMessage.toString());
            const userId = ws.userId;
            // Handle different message types
            switch (data.type) {
                case 'message_edited':
                    this.handleMessageEdited(ws, data);
                    return;
                case 'cancel':
                    console.log(`User ${userId} cancelled generation for chat ${data.chatId}`);
                    return;
                default:
                    await this.handleChatMessage(ws, data);
            }
        }
        catch (error) {
            console.error('Error processing message:', error);
            this.sendError(ws, error instanceof Error ? error.message : 'Invalid message format');
        }
    }
    /**
     * Handle message edit event
     */
    handleMessageEdited(ws, data) {
        console.log(`User ${ws.userId} edited message in chat ${data.chatId}`);
        // Broadcast to other clients of same user
        this.broadcastToUser(ws.userId, {
            type: 'message_edited',
            chatId: data.chatId,
            messageId: data.messageId,
            content: data.content,
        }, ws);
    }
    /**
     * Handle chat message and generate response
     */
    async handleChatMessage(ws, data) {
        const userId = ws.userId;
        // Check user limits
        const hasRemaining = await usage_service_1.usageService.checkUserLimit(userId);
        if (!hasRemaining) {
            this.sendError(ws, 'You have used all your quota for today. Please wait until tomorrow.');
            return;
        }
        const { messages, modelId, isImageGeneration, chatId } = data;
        if (!messages || !Array.isArray(messages)) {
            this.sendError(ws, 'Invalid messages format');
            return;
        }
        if (!modelId) {
            this.sendError(ws, 'ModelId is required');
            return;
        }
        try {
            let currentChatId;
            // Create or update chat
            if (!chatId) {
                const savedChat = await chat_1.chatService.saveChat(userId, modelId, messages);
                currentChatId = savedChat._id.toString();
                this.send(ws, {
                    type: 'chat_created',
                    chatId: currentChatId,
                });
            }
            else {
                await chat_1.chatService.updateChat(chatId, userId, messages);
                currentChatId = chatId;
            }
            // Generate response
            const query = isImageGeneration
                ? messages[messages.length - 1].content
                : messages.map((msg) => msg.content).join('\n');
            let assistantResponse = '';
            let isCancelled = false;
            // Cancel listener
            const cancelListener = (cancelMsg) => {
                try {
                    const cancelData = JSON.parse(cancelMsg.toString());
                    if (cancelData.type === 'cancel' && cancelData.chatId === currentChatId) {
                        isCancelled = true;
                    }
                }
                catch (error) {
                    // Ignore parse errors
                }
            };
            ws.on('message', cancelListener);
            try {
                for await (const content of chat_1.chatService.generateResponse(messages, query, modelId, userId)) {
                    if (isCancelled)
                        break;
                    assistantResponse += content;
                    this.send(ws, { type: 'content', content });
                }
            }
            finally {
                ws.removeListener('message', cancelListener);
            }
            if (isCancelled) {
                console.log(`Generation cancelled for chat ${currentChatId}`);
                return;
            }
            // Save final response
            const allMessages = [...messages, {
                    id: messages.length + 1,
                    role: 'assistant',
                    content: assistantResponse,
                    timestamp: new Date(),
                    sources: [],
                    isImageGeneration: isImageGeneration || false,
                    isComplete: true,
                }];
            await chat_1.chatService.updateChat(currentChatId, userId, allMessages);
            // Send completion
            this.send(ws, {
                type: 'complete',
                chatId: currentChatId,
                shouldUpdateList: true,
                timestamp: new Date().toISOString(),
            });
            // Notify other clients
            this.broadcastToUser(userId, {
                type: 'chat_updated',
                shouldUpdateList: true,
                timestamp: new Date().toISOString(),
            }, ws);
        }
        catch (error) {
            console.error('Error generating response:', error);
            this.sendError(ws, 'Error generating response');
        }
    }
    /**
     * Send message to WebSocket client
     */
    send(ws, message) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    /**
     * Send error message to client
     */
    sendError(ws, error) {
        this.send(ws, { type: 'error', error });
    }
    /**
     * Broadcast message to all connections of a specific user
     */
    broadcastToUser(userId, message, excludeWs) {
        this.wss.clients.forEach((client) => {
            const extClient = client;
            if (extClient.userId === userId && extClient !== excludeWs) {
                this.send(extClient, message);
            }
        });
    }
    /**
     * Get WebSocket server instance
     */
    getServer() {
        return this.wss;
    }
}
// Export singleton instance
exports.chatWebSocket = new ChatWebSocketServer();
