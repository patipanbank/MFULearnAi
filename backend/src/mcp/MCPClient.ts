import WebSocket from 'ws';

const CONNECT_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_CONNECT_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1_000; // 1 second

export class MCPClient {
    private ws: WebSocket | null = null;
    private readonly wsUrl: string;
    private requestId = 1;
    private pendingRequests = new Map<number, (response: any) => void>();
    private connected = false;
    private isReconnecting = false;

    constructor(baseUrl: string) {
        const base = baseUrl.replace(/\/$/, '');
        this.wsUrl = base.replace(/^http/, 'ws') + '/ws';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Connect with retry logic and exponential backoff.
     */
    async connect(retries = MAX_CONNECT_RETRIES, delay = INITIAL_RETRY_DELAY): Promise<void> {
        if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;

        try {
            console.log(`[MCP Client] Connecting to ${this.wsUrl} (Attempts left: ${retries})...`);
            await Promise.race([
                this._connect(),
                this._timeoutPromise(CONNECT_TIMEOUT_MS, 'MCP WebSocket connect timeout')
            ]);
            // Reset state on success
            this.isReconnecting = false;
        } catch (err: any) {
            if (retries > 0) {
                console.warn(`[MCP Client] Connection failed: ${err.message}. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                return this.connect(retries - 1, delay * 2);
            }
            throw new Error(`MCP Client failed to connect after multiple attempts: ${err.message}`);
        }
    }

    async listTools(): Promise<any[]> {
        const response = await this.requestWithRetry('tools/list', {});
        if (response.error) throw new Error(response.error.message);
        return response.result.tools;
    }

    async callTool(name: string, args: Record<string, any>): Promise<string> {
        const response = await this.requestWithRetry('tools/call', { name, arguments: args });

        if (response.error) {
            throw new Error(`Tool "${name}" failed: ${response.error.message}`);
        }

        const content = response.result?.content;
        if (!content) return JSON.stringify(response.result);

        const textBlock = content.find((c: any) => c.type === 'text');
        return textBlock ? textBlock.text : JSON.stringify(content);
    }

    disconnect(): void {
        this.connected = false;
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
            this.ws = null;
        }
    }

    // -------------------------------------------------------------------------
    // Connection & Handshake
    // -------------------------------------------------------------------------

    private async _connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(this.wsUrl);

            ws.on('open', async () => {
                this.ws = ws;
                this.connected = true;
                try {
                    await this._handshake();
                    console.log('[MCP Client] Handshake complete.');
                    this._setupKeepAlive();
                    resolve();
                } catch (err) {
                    this.connected = false;
                    ws.close();
                    reject(err);
                }
            });

            ws.on('message', (data: Buffer) => {
                this._handleIncomingMessage(data.toString());
            });

            ws.on('error', (err: Error) => {
                if (!this.connected) reject(err);
                console.error('[MCP Client] WebSocket error:', err.message);
            });

            ws.on('close', () => {
                const wasConnected = this.connected;
                this.connected = false;
                this.ws = null;

                if (wasConnected) {
                    console.warn('[MCP Client] Connection lost. Triggering auto-reconnect...');
                    this._handleReconnection();
                }
            });
        });
    }

    private async _handleReconnection() {
        if (this.isReconnecting) return;
        this.isReconnecting = true;
        try {
            await this.connect();
        } catch (err) {
            console.error('[MCP Client] Auto-reconnect failed.');
            this.isReconnecting = false;
        }
    }

    private _setupKeepAlive() {
        // Optional: Implement Ping/Pong if needed for long-lived idle connections
    }

    private async _handshake(): Promise<void> {
        const initResponse = await this._requestRaw('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'mful-learnai-ws', version: '1.2.0' }
        });

        if (initResponse.error) {
            throw new Error(`Initialize failed: ${initResponse.error.message}`);
        }

        await this._notify('notifications/initialized');
    }

    private _handleIncomingMessage(dataStr: string): void {
        try {
            const message = JSON.parse(dataStr);
            const { id } = message;

            if (id !== undefined && this.pendingRequests.has(id)) {
                this.pendingRequests.get(id)!(message);
                this.pendingRequests.delete(id);
            }
        } catch (err) {
            console.error('[MCP Client] Failed to parse WebSocket message:', dataStr, err);
        }
    }

    // -------------------------------------------------------------------------
    // JSON-RPC transport
    // -------------------------------------------------------------------------

    /**
     * Public request method with retry logic for transient failures.
     */
    async requestWithRetry(method: string, params: any, attempts = 2): Promise<any> {
        try {
            if (!this.connected) {
                await this.connect();
            }
            return await this._requestRaw(method, params);
        } catch (err: any) {
            if (attempts > 1) {
                console.warn(`[MCP Client] Request "${method}" failed, retrying...`);
                return this.requestWithRetry(method, params, attempts - 1);
            }
            throw err;
        }
    }

    private _requestRaw(method: string, params: any): Promise<any> {
        if (!this.connected || !this.ws) throw new Error('MCP Client not connected');

        const id = this.requestId++;
        const body = { jsonrpc: '2.0', id, method, params };

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`RPC timeout: ${method} (id=${id})`));
                }
            }, REQUEST_TIMEOUT_MS);

            this.pendingRequests.set(id, (response) => {
                clearTimeout(timer);
                resolve(response);
            });

            try {
                this.ws!.send(JSON.stringify(body));
            } catch (err: any) {
                clearTimeout(timer);
                this.pendingRequests.delete(id);
                reject(new Error(`WebSocket send failed (${method}): ${err.message}`));
            }
        });
    }

    private async _notify(method: string, params?: any): Promise<void> {
        if (!this.connected || !this.ws) return;
        const body: any = { jsonrpc: '2.0', method };
        if (params !== undefined) body.params = params;

        try {
            this.ws.send(JSON.stringify(body));
        } catch (err: any) {
            console.warn(`[MCP Client] Notification "${method}" failed:`, err.message);
        }
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    private _timeoutPromise(ms: number, message: string): Promise<never> {
        return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
    }
}

