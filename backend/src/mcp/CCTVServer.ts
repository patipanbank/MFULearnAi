import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// --- Tool Definitions & Data ---

interface Camera {
    id: string;
    location: string;
    status: string;
    resolution: string;
}

const CAMERAS_FILE = path.join(__dirname, 'data', 'cameras.json');

const loadCameras = (): Camera[] => {
    try {
        const data = fs.readFileSync(CAMERAS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("[CCTV Server] Error loading cameras:", error);
        return [];
    }
};

const TOOLS = [
    {
        name: "check_camera_status",
        description: "Get the status of CCTV cameras filtered by location",
        inputSchema: {
            type: "object",
            properties: {
                location: {
                    type: "string",
                    description: "The location to filter cameras by (e.g., 'หน้าประตู', 'ลานจอดรถ')"
                }
            },
            required: ["location"]
        }
    }
];

// --- Server Setup ---

const app = express();
const PORT = process.env.MCP_PORT || 3001;

app.use(cors());
app.use(express.json());

// Store active SSE connections
const connections = new Map<string, Response>();

// SSE Endpoint
app.get('/sse', (req: Request, res: Response) => {
    const sessionId = uuidv4();
    console.log(`[CCTV Server] New SSE connection: ${sessionId}`);

    // Headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    connections.set(sessionId, res);

    const sendSDK = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // 1. Send endpoint event (Standard MCP Pattern)
    // The client should POST messages to /message?sessionId=<sessionId>
    sendSDK('endpoint', `/message?sessionId=${sessionId}`);

    // Cleanup on close
    req.on('close', () => {
        console.log(`[CCTV Server] Connection closed: ${sessionId}`);
        connections.delete(sessionId);
    });
});

// Message Endpoint (JSON-RPC)
app.post('/message', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const connection = connections.get(sessionId);

    if (!connection) {
        return res.status(404).json({ error: "Session not found" });
    }

    // Acknowledge receipt immediately (Standard MCP)
    res.status(202).send('Accepted');

    const message = req.body;
    await handleMessage(sessionId, message, connection);
});

async function handleMessage(sessionId: string, message: any, connection: Response) {
    // console.log(`[CCTV Server] Received message for ${sessionId}:`, JSON.stringify(message));

    const sendResponse = (result: any) => {
        connection.write(`event: message\ndata: ${JSON.stringify(result)}\n\n`);
    };

    if (message.jsonrpc !== '2.0') return;

    // 1. Initialize
    if (message.method === 'initialize') {
        sendResponse({
            jsonrpc: '2.0',
            id: message.id,
            result: {
                protocolVersion: '2024-11-05', // MCP version
                serverInfo: {
                    name: 'cctv-mcp-server',
                    version: '1.0.0'
                },
                capabilities: {
                    tools: {}
                }
            }
        });
    }
    // 2. Notifications
    else if (message.method === 'notifications/initialized') {
        // No response needed
        console.log(`[CCTV Server] Session ${sessionId} initialized.`);
    }
    // 3. List Tools
    else if (message.method === 'tools/list') {
        sendResponse({
            jsonrpc: '2.0',
            id: message.id,
            result: {
                tools: TOOLS
            }
        });
    }
    // 4. Call Tool
    else if (message.method === 'tools/call') {
        const { name, arguments: args } = message.params;

        try {
            if (name === 'check_camera_status') {
                const cameras = loadCameras();
                const location = args.location || '';
                const filtered = cameras.filter(c => c.location.includes(location));

                sendResponse({
                    jsonrpc: '2.0',
                    id: message.id,
                    result: {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(filtered, null, 2)
                            }
                        ]
                    }
                });
            } else {
                sendResponse({
                    jsonrpc: '2.0',
                    id: message.id,
                    error: {
                        code: -32601,
                        message: "Method not found"
                    }
                });
            }
        } catch (error: any) {
            sendResponse({
                jsonrpc: '2.0',
                id: message.id,
                error: {
                    code: -32603,
                    message: `Internal error: ${error.message}`
                }
            });
        }
    }
    else {
        // Unknown method
        if (message.id) {
            sendResponse({
                jsonrpc: '2.0',
                id: message.id,
                error: {
                    code: -32601,
                    message: "Method not found"
                }
            });
        }
    }
}

// Start Server (if run directly)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`[CCTV Server] Running on http://localhost:${PORT}`);
        console.log(`[CCTV Server] SSE Endpoint: http://localhost:${PORT}/sse`);
    });
}

export default app;
