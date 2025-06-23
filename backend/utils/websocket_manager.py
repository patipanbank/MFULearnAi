from typing import Dict, Set
from fastapi import WebSocket

class WebSocketManager:
    """ตัวจัดการ mapping session_id -> set[WebSocket]"""

    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        self.active_connections[session_id].add(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

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