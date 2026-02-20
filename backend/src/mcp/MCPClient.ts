import WebSocket from 'ws';

const CONNECT_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 30_000;

export class MCPClient {
    private ws: WebSocket | null = null;
    private readonly wsUrl: string;
    private requestId = 1;
    private pendingRequests = new Map<number, (response: any) => void>();
    private connected = false;

    constructor(baseUrl: string) {
        // Convert http/https to ws/wss and append /ws endpoint
        const base = baseUrl.replace(/\/$/, '');
        this.wsUrl = base.replace(/^http/, 'ws') + '/ws';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    async connect(): Promise<void> {
        if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;

        console.log(`[MCP Client] Connecting to WebSocket at ${this.wsUrl}...`);

        return Promise.race([
            this._connect(),
            this._timeoutPromise(CONNECT_TIMEOUT_MS, 'MCP WebSocket connect timeout')
        ]);
    }

    async listTools(): Promise<any[]> {
        const response = await this.request('tools/list', {});
        if (response.error) throw new Error(response.error.message);
        return response.result.tools;
    }

    async callTool(name: string, args: Record<string, any>): Promise<string> {
        const response = await this.request('tools/call', { name, arguments: args });

        if (response.error) {
            throw new Error(`Tool "${name}" failed: ${response.error.message}`);
        }

        const content = response.result?.content;
        if (!content) return JSON.stringify(response.result);

        const textBlock = content.find((c: any) => c.type === 'text');
        return textBlock ? textBlock.text : JSON.stringify(content);
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
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
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });

            ws.on('message', (data: Buffer) => {
                this._handleIncomingMessage(data.toString());
            });

            ws.on('error', (err: Error) => {
                console.error('[MCP Client] WebSocket error:', err.message);
                this.connected = false;
                reject(err);
            });

            ws.on('close', () => {
                if (this.connected) {
                    console.warn('[MCP Client] WebSocket connection closed.');
                }
                this.connected = false;
            });
        });
    }

    private async _handshake(): Promise<void> {
        const initResponse = await this.request('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'mful-learnai-ws', version: '1.1.0' }
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

    private request(method: string, params: any): Promise<any> {
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
