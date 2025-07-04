from typing import Dict, Set
from fastapi import WebSocket
import asyncio
import json
import os
import redis
from threading import Thread

class WebSocketManager:
    """ตัวจัดการ mapping session_id -> set[WebSocket]"""

    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
        self.pubsub = self.redis_client.pubsub()
        self.running = False
        self._start_redis_listener()

    def _start_redis_listener(self):
        """Start Redis listener in background thread"""
        if not self.running:
            self.running = True
            thread = Thread(target=self._redis_listener_worker, daemon=True)
            thread.start()

    def _redis_listener_worker(self):
        """Background worker to listen for Redis messages"""
        try:
            print("🔍 Starting Redis listener for chat channels...")
            # Subscribe to all chat channels
            self.pubsub.psubscribe("chat:*")
            print("✅ Redis listener subscribed to chat:* channels")
            
            for message in self.pubsub.listen():
                if message["type"] == "pmessage":
                    channel = message["channel"].decode()
                    session_id = channel.replace("chat:", "")
                    data = message["data"].decode()
                    
                    print(f"📨 Received Redis message for session {session_id}: {data[:100]}...")
                    
                    # Broadcast to all WebSocket connections for this session
                    asyncio.create_task(self._broadcast_to_session(session_id, data))
        except Exception as e:
            print(f"❌ Redis listener error: {e}")
        finally:
            self.running = False

    async def _broadcast_to_session(self, session_id: str, message: str):
        """Broadcast message to all WebSocket connections for a session"""
        if session_id not in self.active_connections:
            print(f"⚠️ No active connections for session {session_id}")
            return
        
        print(f"📤 Broadcasting to {len(self.active_connections[session_id])} connections for session {session_id}")
        dead_sockets = []
        for ws in list(self.active_connections[session_id]):
            try:
                await ws.send_text(message)
                print(f"✅ Message sent to WebSocket for session {session_id}")
            except Exception as e:
                print(f"❌ Failed to send to WebSocket: {e}")
                dead_sockets.append(ws)
        
        # Cleanup dead connections
        for ws in dead_sockets:
            self.disconnect(session_id, ws)

    async def connect(self, session_id: str, websocket: WebSocket):
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        self.active_connections[session_id].add(websocket)
        print(f"WebSocket connected to session {session_id}, total connections: {len(self.active_connections[session_id])}")

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
            print(f"WebSocket disconnected from session {session_id}")

    async def broadcast(self, session_id: str, message: str):
        if session_id not in self.active_connections:
            return
        dead_sockets = []
        for ws in list(self.active_connections[session_id]):
            try:
                await ws.send_text(message)
            except Exception:
                dead_sockets.append(ws)
        # cleanup
        for ws in dead_sockets:
            self.disconnect(session_id, ws)


ws_manager = WebSocketManager() 