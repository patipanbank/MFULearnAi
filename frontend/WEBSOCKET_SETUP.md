# WebSocket Setup Guide

## Environment Variables

Create a `.env` file in the frontend directory with the following variables:

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:5001

# Application Configuration
VITE_APP_NAME=MFU Learn AI
VITE_APP_VERSION=1.0.0
```

## WebSocket Features

### Enhanced WebSocket Manager
- **Auto-reconnection**: Automatically reconnects when connection is lost
- **Heartbeat**: Sends ping/pong messages to keep connection alive
- **Error handling**: Comprehensive error handling and user feedback
- **Connection status**: Real-time connection status indicators
- **Message broadcasting**: Sync messages across multiple browser tabs

### Backend WebSocket Server
- **Authentication**: JWT token-based authentication
- **Heartbeat monitoring**: Server-side connection health monitoring
- **Message types supported**:
  - `ping/pong`: Heartbeat messages
  - `message`: Send chat messages
  - `chunk`: Streaming response chunks
  - `complete`: Response completion
  - `error`: Error messages
  - `cancel`: Cancel generation
  - `message_edited`: Message edit broadcasts
  - `chat_updated`: Chat list updates

### Connection Flow
1. Client connects with JWT token in URL parameters
2. Server validates token and establishes connection
3. Client sends heartbeat pings every 25 seconds
4. Server responds with pongs and monitors connection health
5. Auto-reconnection triggers if connection is lost

### Usage in Chat Component
```typescript
// Initialize WebSocket Manager
const wsManager = new WebSocketManager()

// Setup event handlers
wsManager.onOpen(() => console.log('Connected'))
wsManager.onMessage((data) => handleMessage(data))
wsManager.onError((error) => handleError(error))

// Connect to specific chat
await wsManager.connect(chatId)

// Send messages
wsManager.send({
  type: 'message',
  chatId: chatId,
  messages: messages,
  modelId: modelId
})

// Close connection
wsManager.close()
```

### Connection Status Indicators
- 🟢 Green dot: Connected and active
- 🟡 Yellow dot: Reconnecting
- 🔴 Red dot: Disconnected
- WiFi icon: Real-time connection active
- Disconnect icon: Connection inactive

### Troubleshooting
1. **Connection fails**: Check if backend server is running on port 5001
2. **Authentication errors**: Verify JWT token is valid and not expired
3. **Reconnection issues**: Check network connectivity and server availability
4. **Message not sending**: Ensure WebSocket is connected before sending

### Development
- WebSocket server runs on port 5001 by default
- Enable console logging to see connection events
- Use browser DevTools Network tab to monitor WebSocket traffic 