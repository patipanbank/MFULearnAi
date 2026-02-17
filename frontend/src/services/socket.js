import { io } from 'socket.io-client'

let socket = null

/**
 * Get or create the Socket.IO client singleton.
 * Auto-connects with JWT auth token.
 * Falls back to polling if WebSocket is blocked by proxy.
 */
export function getSocket() {
    if (socket && socket.connected) return socket

    const token = localStorage.getItem('auth_token')
    if (!token) {
        console.warn('[Socket] No auth token found')
        return null
    }

    // Disconnect existing socket if any
    if (socket) {
        socket.disconnect()
    }

    socket = io({
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'], // WS preferred, polling fallback
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
    })

    socket.on('connect', () => {
        console.log(`[Socket] Connected: id=${socket.id}, transport=${socket.io.engine.transport.name}`)
    })

    socket.io.engine.on('upgrade', (transport) => {
        console.log(`[Socket] Upgraded to: ${transport.name}`)
    })

    socket.on('connect_error', (err) => {
        console.error(`[Socket] Connection error: ${err.message}`)
    })

    socket.on('disconnect', (reason) => {
        console.log(`[Socket] Disconnected: ${reason}`)
    })

    return socket
}

/**
 * Disconnect and cleanup the socket.
 * Call on logout.
 */
export function disconnectSocket() {
    if (socket) {
        socket.disconnect()
        socket = null
    }
}
