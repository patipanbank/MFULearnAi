import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export class MCPClient {
    private endpoint: string | null = null;
    private sseUrl: string;
    private requestId = 0;
    private pendingRequests = new Map<number, (response: any) => void>();
    private eventSourceStream: any = null;
    private connected = false;

    constructor(baseUrl: string) {
        // e.g. http://localhost:3001
        // Ensure no trailing slash
        const cleanBase = baseUrl.replace(/\/$/, "");
        this.sseUrl = `${cleanBase}/sse`;
        // Fallback endpoint, should be updated by 'endpoint' event
        this.endpoint = `${cleanBase}/message`;
    }

    async connect() {
        console.log(`[MCP Client] Connecting to SSE at ${this.sseUrl}...`);

        try {
            const response = await axios.get(this.sseUrl, {
                responseType: 'stream',
                headers: {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                },
                timeout: 0 // Keep alive indefinitely
            });

            this.eventSourceStream = response.data;
            this.connected = true;

            let buffer = '';

            // Stream Processor with buffering for partial lines
            this.eventSourceStream.on('data', (chunk: Buffer) => {
                const text = chunk.toString();
                buffer += text;

                const lines = buffer.split('\n');
                // The last element is potentially incomplete, keep it in buffer
                buffer = lines.pop() || '';

                let currentEvent = 'message'; // Default event type

                for (const line of lines) {
                    if (line.trim() === '') {
                        // End of event block
                        currentEvent = 'message'; // Reset default
                        continue;
                    }

                    if (line.startsWith('event: ')) {
                        currentEvent = line.substring(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6).trim();
                        if (!dataStr) continue;

                        this.processEvent(currentEvent, dataStr);
                    }
                }
            });

            this.eventSourceStream.on('error', (err: any) => {
                console.error("[MCP Client] SSE Stream Error:", err.message);
                this.connected = false;
            });

            // Initialize handshake logic - wait slightly for endpoint event?
            // Actually, usually send 'initialize' immediately to the fallback endpoint or wait.
            // Let's rely on the endpoint event for the *next* calls, but initial might go to default.

        } catch (error: any) {
            console.error("[MCP Client] Connection Failed:", error.message);
            throw error;
        }
    }

    private processEvent(event: string, dataStr: string) {
        try {
            if (event === 'endpoint') {
                // Server tells us where to post messages
                // It might send a full URL or relative path
                // "data: /message?sessionId=..."
                // or "data: http://..."
                // Sometimes it is NOT JSON stringified if it's just a string, but standard is data: <data>

                let endpointPath = dataStr;
                // Try JSON parse if it looks like a string wrapped in quotes? 
                // data: "/message?..." could be parsed.
                if (dataStr.startsWith('"')) {
                    try { endpointPath = JSON.parse(dataStr); } catch (e) { }
                }

                if (endpointPath.startsWith('http')) {
                    this.endpoint = endpointPath;
                } else {
                    const base = new URL(this.sseUrl);
                    // Ensure slash
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
                // this.pendingRequests.delete(message.id); // Done by the resolver caller? No, done here.
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

        // MCP usually returns content array
        const textObj = response.result.content?.find((c: any) => c.type === 'text');
        // Handle result being just an object or string
        if (!textObj && response.result) return JSON.stringify(response.result);

        return textObj ? textObj.text : JSON.stringify(response.result.content);
    }

    private request(method: string, params: any): Promise<any> {
        // If endpoint is not ready, wait or fail.
        // For simplicity, fail if null (but ctor sets default)
        if (!this.endpoint) throw new Error("MCP Endpoint not initialized");

        const id = this.requestId++;

        return new Promise(async (resolve, reject) => {
            // Set timeout for request
            const timeout = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error("RPC Request Timeout"));
                }
            }, 10000);

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
                await axios.post(this.endpoint!, body);
            } catch (e: any) {
                clearTimeout(timeout);
                this.pendingRequests.delete(id);
                reject(new Error(`Failed to send request: ${e.message}`));
            }
        });
    }

    disconnect() {
        if (this.eventSourceStream) {
            try {
                this.eventSourceStream.destroy();
            } catch (e) {
                // ignore
            }
        }
        this.connected = false;
    }
}
