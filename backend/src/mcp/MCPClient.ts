import axios from 'axios';

export class MCPClient {
    private endpoint: string | null = null;
    private sseUrl: string;
    private requestId = 1;
    private pendingRequests = new Map<number, (response: any) => void>();
    private eventSourceStream: any = null;
    private connected = false;

    constructor(baseUrl: string) {
        const cleanBase = baseUrl.replace(/\/$/, "");
        this.sseUrl = `${cleanBase}/sse`;
    }

    async connect() {
        return Promise.race([
            this._connect(),
            new Promise<void>((_, reject) =>
                setTimeout(() => reject(new Error('MCP connect timeout (30s)')), 30_000)
            )
        ]);
    }

    private async _connect() {
        console.log(`[MCP Client] Connecting to SSE at ${this.sseUrl}...`);

        try {
            const response = await axios.get(this.sseUrl, {
                responseType: 'stream',
                headers: {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                },
                timeout: 0
            });

            this.eventSourceStream = response.data;
            this.connected = true;

            let buffer = '';

            this.eventSourceStream.on('data', (chunk: Buffer) => {
                const text = chunk.toString();
                buffer += text;

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let currentEvent = 'message';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine === '') {
                        currentEvent = 'message';
                        continue;
                    }

                    if (trimmedLine.startsWith('event: ')) {
                        currentEvent = trimmedLine.substring(7).trim();
                    } else if (trimmedLine.startsWith('data: ')) {
                        const dataStr = trimmedLine.substring(6).trim();
                        if (!dataStr) continue;
                        console.debug(`[MCP Client] Received Data: ${dataStr}`);
                        this.processEvent(currentEvent, dataStr);
                    }
                }
            });

            this.eventSourceStream.on('error', (err: any) => {
                console.error("[MCP Client] SSE Stream Error:", err.message);
                this.connected = false;
            });

            // Wait until endpoint is set
            let waitCount = 0;
            while (!this.endpoint && waitCount < 100) {
                await new Promise(r => setTimeout(r, 100));
                waitCount++;
            }

            if (!this.endpoint) {
                throw new Error("MCP Endpoint not received via SSE");
            }

            // 1. Send 'initialize'
            console.log(`[MCP Client] Sending initialize (id=${this.requestId}) to ${this.endpoint}`);
            const initResponse = await this.request('initialize', {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: {
                    name: "mful-learnai",
                    version: "1.0.0"
                }
            });

            if (initResponse.error) {
                throw new Error(`Initialize failed: ${initResponse.error.message}`);
            }

            // 2. Send 'notifications/initialized'
            console.log(`[MCP Client] Sending notifications/initialized`);
            await this.notify('notifications/initialized');

            console.log(`[MCP Client] Handshake complete.`);

        } catch (error: any) {
            console.error("[MCP Client] Connection Failed:", error.message);
            throw error;
        }
    }

    private processEvent(event: string, dataStr: string) {
        try {
            if (event === 'endpoint') {
                let endpointPath = dataStr;
                if (dataStr.startsWith('"')) {
                    try { endpointPath = JSON.parse(dataStr); } catch (e) { }
                }

                if (endpointPath.startsWith('http')) {
                    this.endpoint = endpointPath;
                } else {
                    const base = new URL(this.sseUrl);
                    const path = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
                    this.endpoint = `${base.protocol}//${base.host}${path}`;
                }
                console.log(`[MCP Client] Endpoint updated to: ${this.endpoint}`);
            }
            else if (event === 'message') {
                const message = JSON.parse(dataStr);
                this.handleMessage(message);
            }
        } catch (e) {
            console.error("[MCP Client] Failed to parse SSE data:", dataStr, e);
        }
    }

    private handleMessage(message: any) {
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
            const resolver = this.pendingRequests.get(message.id);
            if (resolver) {
                resolver(message);
                this.pendingRequests.delete(message.id);
            }
        }
    }

    async listTools() {
        const response = await this.request('tools/list', {});
        if (response.error) throw new Error(response.error.message);
        return response.result.tools;
    }

    async callTool(name: string, args: any) {
        const response = await this.request('tools/call', {
            name,
            arguments: args
        });

        if (response.error) {
            throw new Error(`Tool call failed: ${response.error.message}`);
        }

        const textObj = response.result.content?.find((c: any) => c.type === 'text');
        if (!textObj && response.result) return JSON.stringify(response.result);

        return textObj ? textObj.text : JSON.stringify(response.result.content);
    }

    private async notify(method: string, params?: any): Promise<void> {
        if (!this.endpoint) throw new Error("MCP Endpoint not initialized");

        const body: any = {
            jsonrpc: '2.0',
            method
        };
        if (params !== undefined) {
            body.params = params;
        }

        try {
            await axios.post(this.endpoint!, body);
        } catch (e: any) {
            console.error(`[MCP Client] Notification failed: ${e.message}`);
        }
    }

    private request(method: string, params: any): Promise<any> {
        if (!this.endpoint) throw new Error("MCP Endpoint not initialized");

        const id = this.requestId++;

        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`RPC Request Timeout (${method} with id ${id}) (30s)`));
                }
            }, 30000);

            this.pendingRequests.set(id, (response) => {
                clearTimeout(timeout);
                resolve(response);
            });

            const body = {
                jsonrpc: '2.0',
                id,
                method,
                params
            };

            try {
                const postRes = await axios.post(this.endpoint!, body);

                // HYBRID MODE: Check if server returned result directly in POST response body
                if (postRes.data && postRes.data.id === id) {
                    console.debug(`[MCP Client] Resolved ${method} (id:${id}) via direct POST response`);
                    if (this.pendingRequests.has(id)) {
                        clearTimeout(timeout);
                        const response = postRes.data;
                        this.pendingRequests.delete(id);
                        resolve(response);
                    }
                }
            } catch (e: any) {
                // Check if error response contains a JSON-RPC error with matching ID
                if (e.response && e.response.data && e.response.data.id === id) {
                    console.debug(`[MCP Client] Received error for ${method} (id:${id}) via direct POST response`);
                    if (this.pendingRequests.has(id)) {
                        clearTimeout(timeout);
                        const response = e.response.data;
                        this.pendingRequests.delete(id);
                        resolve(response);
                        return;
                    }
                }

                clearTimeout(timeout);
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Failed to send request: ${e.message}`));
                }
            }
        });
    }

    disconnect() {
        if (this.eventSourceStream) {
            try {
                this.eventSourceStream.destroy();
            } catch (e) { }
        }
        this.connected = false;
    }
}
