import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

let ioInstance: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server with JWT authentication.
 * Clients connect to /socket.io and are placed into user-specific rooms.
 */
export function setupSocketIO(httpServer: HTTPServer): SocketIOServer {
    const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
    const JWT_SECRET = process.env.JWT_SECRET || (ENV_TYPE === 'PROD' ? '' : 'dev-secret');

    const io = new SocketIOServer(httpServer, {
        path: '/socket.io',
        cors: {
            origin: ENV_TYPE === 'PROD'
                ? (process.env.CORS_ORIGIN || 'https://mfulearnai.mfu.ac.th')
                : true,
            credentials: true
        },
        transports: ['websocket', 'polling'], // WebSocket preferred, polling fallback
        pingInterval: 25000,
        pingTimeout: 20000,
    });

    // ── JWT Authentication Middleware ──
    io.use((socket: any, next: (err?: any) => void) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            socket.data.userId = decoded.userId;
            socket.data.role = decoded.role;
            socket.data.department = decoded.department;
            next();
        } catch (err) {
            next(new Error('Invalid or expired token'));
        }
    });

    // ── Connection Handler ──
    io.on('connection', (socket: any) => {
        const userId = socket.data.userId;
        console.log(`[Socket.IO] Connected: userId=${userId}, transport=${socket.conn.transport.name}`);

        // Join user-specific room for targeted event delivery
        socket.join(`user:${userId}`);

        // Log transport upgrades (polling → websocket)
        socket.conn.on('upgrade', (transport: any) => {
            console.log(`[Socket.IO] Upgraded: userId=${userId}, transport=${transport.name}`);
        });

        socket.on('disconnect', (reason: string) => {
            console.log(`[Socket.IO] Disconnected: userId=${userId}, reason=${reason}`);
        });
    });

    ioInstance = io;
    console.log('[Socket.IO] Server initialized');
    return io;
}

/**
 * Get the singleton Socket.IO instance.
 * Used by AgentEventStore to emit events.
 */
export function getIO(): SocketIOServer {
    if (!ioInstance) {
        throw new Error('[Socket.IO] Server not initialized — call setupSocketIO first');
    }
    return ioInstance;
}
