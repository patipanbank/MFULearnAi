import axios from 'axios';

const CONNECT_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 30_000;
const ENDPOINT_WAIT_INTERVAL_MS = 100;
const ENDPOINT_WAIT_MAX_ATTEMPTS = 100;

export class MCPClient {
    private endpoint: string | null = null;
    private readonly sseUrl: string;
    private requestId = 1;
    private pendingRequests = new Map<number, (response: any) => void>();
    private eventSourceStream: any = null;
    private connected = false;

    constructor(baseUrl: string) {
        this.sseUrl = `${baseUrl.replace(/\/$/, '')}/sse`;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    async connect(): Promise<void> {
        return Promise.race([
            this._connect(),
            this._timeoutPromise(CONNECT_TIMEOUT_MS, 'MCP connect timeout')
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
        try {
            this.eventSourceStream?.destroy();
        } catch (_) { }
        this.connected = false;
        this.endpoint = null;
    }

    // -------------------------------------------------------------------------
    // Connection
    // -------------------------------------------------------------------------

    private async _connect(): Promise<void> {
        console.log(`[MCP Client] Connecting to SSE at ${this.sseUrl}...`);

        const response = await axios.get(this.sseUrl, {
            responseType: 'stream',
            headers: {
                Accept: 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive'
            },
            timeout: 0
        });

        this.eventSourceStream = response.data;
        this.connected = true;
        this._listenToStream(this.eventSourceStream);

        await this._waitForEndpoint();
        await this._handshake();

        console.log('[MCP Client] Handshake complete.');
    }

    private _listenToStream(stream: any): void {
        let buffer = '';
        let currentEvent = 'message';

        stream.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                const trimmed = line.trim();

                if (trimmed === '') {
                    currentEvent = 'message'; // reset event type on blank line
                    continue;
                }

                if (trimmed.startsWith('event: ')) {
                    currentEvent = trimmed.slice(7).trim();
                } else if (trimmed.startsWith('data: ')) {
                    const data = trimmed.slice(6).trim();
                    if (data) this._processEvent(currentEvent, data);
                }
                // ignore comment lines (": ...")
            }
        });

        stream.on('error', (err: Error) => {
            console.error('[MCP Client] SSE stream error:', err.message);
            this.connected = false;
        });

        stream.on('end', () => {
            console.warn('[MCP Client] SSE stream ended unexpectedly.');
            this.connected = false;
        });
    }

    private async _waitForEndpoint(): Promise<void> {
        for (let i = 0; i < ENDPOINT_WAIT_MAX_ATTEMPTS; i++) {
            if (this.endpoint) return;
            await this._sleep(ENDPOINT_WAIT_INTERVAL_MS);
        }
        throw new Error('MCP endpoint not received via SSE');
    }

    private async _handshake(): Promise<void> {
        const initResponse = await this.request('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'mful-learnai', version: '1.0.0' }
        });

        if (initResponse.error) {
            throw new Error(`Initialize failed: ${initResponse.error.message}`);
        }

        await this._notify('notifications/initialized');
    }

    // -------------------------------------------------------------------------
    // SSE event processing
    // -------------------------------------------------------------------------

    private _processEvent(event: string, dataStr: string): void {
        try {
            if (event === 'endpoint') {
                this.endpoint = this._resolveEndpoint(dataStr);
                console.log(`[MCP Client] Endpoint updated to: ${this.endpoint}`);
                return;
            }

            if (event === 'message') {
                const message = JSON.parse(dataStr);
                this._handleIncomingMessage(message);
            }
        } catch (err) {
            console.error('[MCP Client] Failed to parse SSE event:', dataStr, err);
        }
    }

    private _resolveEndpoint(raw: string): string {
        let path = raw;
        // strip surrounding quotes if present
        if (raw.startsWith('"')) {
            try { path = JSON.parse(raw); } catch (_) { }
        }

        if (path.startsWith('http')) return path;

        const base = new URL(this.sseUrl);
        return `${base.protocol}//${base.host}${path.startsWith('/') ? path : `/${path}`}`;
    }

    private _handleIncomingMessage(message: any): void {
        const { id } = message;
        if (id !== undefined && this.pendingRequests.has(id)) {
            this.pendingRequests.get(id)!(message);
            this.pendingRequests.delete(id);
        }
    }

    // -------------------------------------------------------------------------
    // JSON-RPC transport
    // -------------------------------------------------------------------------

    private request(method: string, params: any): Promise<any> {
        if (!this.endpoint) throw new Error('MCP endpoint not initialized');

        const id = this.requestId++;

        return new Promise(async (resolve, reject) => {
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

            const body = { jsonrpc: '2.0', id, method, params };

            try {
                const postRes = await axios.post(this.endpoint!, body, {
                    timeout: REQUEST_TIMEOUT_MS - 5_000,
                    headers: { 'Content-Type': 'application/json' }
                });

                // Hybrid mode: server returned result directly in POST body
                if (postRes.data?.id !== undefined && this.pendingRequests.has(postRes.data.id)) {
                    clearTimeout(timer);
                    this.pendingRequests.delete(postRes.data.id);
                    resolve(postRes.data);
                }
                // Otherwise wait for SSE message event

            } catch (err: any) {
                // Server may return JSON-RPC error in response body even on 4xx/5xx
                const errorData = err.response?.data;
                if (errorData?.id !== undefined && this.pendingRequests.has(errorData.id)) {
                    clearTimeout(timer);
                    this.pendingRequests.delete(errorData.id);
                    resolve(errorData);
                    return;
                }

                clearTimeout(timer);
                this.pendingRequests.delete(id);
                reject(new Error(`POST failed (${method}): ${err.message}`));
            }
        });
    }

    private async _notify(method: string, params?: any): Promise<void> {
        if (!this.endpoint) throw new Error('MCP endpoint not initialized');
        const body: any = { jsonrpc: '2.0', method };
        if (params !== undefined) body.params = params;
        try {
            await axios.post(this.endpoint, body);
        } catch (err: any) {
            console.warn(`[MCP Client] Notification "${method}" failed:`, err.message);
        }
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    private _sleep(ms: number): Promise<void> {
        return new Promise(r => setTimeout(r, ms));
    }

    private _timeoutPromise(ms: number, message: string): Promise<never> {
        return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
    }
}