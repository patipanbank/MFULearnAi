import asyncio
import uuid
import logging
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.mcp import JSONRPCError, JSONRPCResponse
from app.services.mcp_service import MCPService

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: Optional[Dict[str, Any]] = None
    id: Optional[Any] = None

# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS = [
    {
        "name": "check_camera_status",
        "description": (
            "Check real-time online/offline status of CCTV cameras "
            "by searching name, id, or location. Pings the camera IP."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "Camera name, id, or location keyword (e.g. 'E1', 'ประตูหน้า')"
                }
            },
            "required": ["location"]
        }
    },
    {
        "name": "find_cameras_by_location",
        "description": (
            "Find cameras by location from the database. "
            "Returns stored status without pinging."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "Location keyword to search (e.g. 'อาคาร E')"
                }
            },
            "required": ["location"]
        }
    }
]

# ---------------------------------------------------------------------------
# WebSocket Handler
# ---------------------------------------------------------------------------

@router.websocket("/ws")
async def mcp_websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    """
    WebSocket endpoint for MCP.
    Handles JSON-RPC over persistent connection.
    """
    await websocket.accept()
    session_id = str(uuid.uuid4())
    logger.info(f"MCP WebSocket session started: {session_id}")
    
    service = MCPService(db)

    try:
        while True:
            # 1. Receive JSON-RPC Request
            data = await websocket.receive_text()
            try:
                rpc_data = json.loads(data)
                rpc = JSONRPCRequest(**rpc_data)
            except Exception as e:
                logger.warning(f"Invalid JSON-RPC received: {data}")
                error_res = JSONRPCResponse(
                    id=None,
                    error=JSONRPCError(code=-32700, message=f"Parse error: {str(e)}")
                )
                await websocket.send_text(error_res.model_dump_json())
                continue

            # 2. Dispatch call
            try:
                response = await _dispatch(rpc, service, session_id)
                
                # 3. Send Response (if not a notification)
                if response:
                    await websocket.send_text(response.model_dump_json())
            
            except Exception as exc:
                logger.exception(f"Error processing MCP request in session {session_id}")
                error_res = JSONRPCResponse(
                    id=rpc.id,
                    error=JSONRPCError(code=-32000, message=str(exc))
                )
                await websocket.send_text(error_res.model_dump_json())

    except WebSocketDisconnect:
        logger.info(f"MCP WebSocket session closed: {session_id}")
    except Exception as e:
        logger.error(f"Unexpected WebSocket error: {str(e)}")
    finally:
        # Cleanup if needed
        pass


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

async def _dispatch(
    rpc: JSONRPCRequest,
    service: MCPService,
    session_id: str
) -> Optional[JSONRPCResponse]:
    """Route JSON-RPC method to the correct handler."""

    method = rpc.method

    if method == "initialize":
        return JSONRPCResponse(
            id=rpc.id,
            result={
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "cctv-mcp-websocket", "version": "1.1.0"}
            }
        )

    if method == "notifications/initialized":
        logger.info(f"Session fully initialized via WS: {session_id}")
        return None

    if method == "tools/list":
        return JSONRPCResponse(id=rpc.id, result={"tools": TOOL_DEFINITIONS})

    if method == "tools/call":
        return await _handle_tool_call(rpc, service)

    return JSONRPCResponse(
        id=rpc.id,
        error=JSONRPCError(code=-32601, message=f"Method not found: {method}")
    )


async def _handle_tool_call(
    rpc: JSONRPCRequest,
    service: MCPService
) -> JSONRPCResponse:
    params = rpc.params or {}
    tool_name: str = params.get("name", "")
    tool_args: dict = params.get("arguments", {})

    if not tool_name:
        return JSONRPCResponse(
            id=rpc.id,
            error=JSONRPCError(code=-32602, message="Missing tool name")
        )

    try:
        if tool_name == "check_camera_status":
            location = tool_args.get("location", "").strip()
            if not location:
                return JSONRPCResponse(
                    id=rpc.id,
                    error=JSONRPCError(code=-32602, message="Missing required argument: location")
                )
            result = await service.check_camera_status(location)
            return _text_response(rpc.id, result)

        if tool_name == "find_cameras_by_location":
            location = tool_args.get("location", "").strip()
            if not location:
                return JSONRPCResponse(
                    id=rpc.id,
                    error=JSONRPCError(code=-32602, message="Missing required argument: location")
                )
            result = service.find_cameras_by_location(location)
            return _text_response(rpc.id, result)

    except Exception as e:
        logger.error(f"Tool {tool_name} failed: {str(e)}")
        return JSONRPCResponse(
            id=rpc.id,
            error=JSONRPCError(code=-32603, message=f"Internal tool error: {str(e)}")
        )

    return JSONRPCResponse(
        id=rpc.id,
        error=JSONRPCError(code=-32601, message=f"Unknown tool: {tool_name}")
    )


def _text_response(rpc_id: Any, data: Any) -> JSONRPCResponse:
    """Wrap tool result as MCP text content block."""
    text = json.dumps(data, ensure_ascii=False, indent=2) if not isinstance(data, str) else data
    return JSONRPCResponse(
        id=rpc_id,
        result={"content": [{"type": "text", "text": text}]}
    )
