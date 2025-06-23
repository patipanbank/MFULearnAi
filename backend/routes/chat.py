from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import List, Optional
import jwt
import json
from bson import ObjectId
import asyncio

from services.chat_service import chat_service
from services.chat_history_service import chat_history_service
from services.agent_service import agent_service
from models.user import User, UserRole
from models.chat import ImagePayload, Chat as ChatHistoryModel, ChatMessage
from middleware.role_guard import role_guard, get_current_user_with_roles
from config.config import settings
from tasks.chat_tasks import generate_answer  # lazy import to avoid circular
from datetime import datetime as _dt
from utils.websocket_manager import ws_manager

router = APIRouter(
    tags=["Chat"]
)

# Legacy request format (kept for backward compatibility)
class ChatRequest(BaseModel):
    session_id: str
    message: str
    model_id: str
    collection_names: List[str]
    images: Optional[List[ImagePayload]] = Field(default=None)

# New agent-based request format
class AgentChatRequest(BaseModel):
    session_id: str
    message: str
    agent_id: str
    images: Optional[List[ImagePayload]] = Field(default=None)

# -------- New Chat Creation ---------

class CreateChatRequest(BaseModel):
    """Create a new chat before first message (Plan A).

    Front-end supplies either agent_id (preferred) หรือ legacy model_id/collection_names.
    Optional name สามารถตั้งเองได้ ไม่ส่งมาก็ใช้ "New Chat".
    """

    name: Optional[str] = Field(default="New Chat")
    agent_id: Optional[str] = None
    model_id: Optional[str] = None  # legacy fallback

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Untitled Chat",
                "agent_id": "68589ad661d8cf458c1d19f0"
            }
        }

@router.get("/history/{session_id}", response_model=ChatHistoryModel)
async def get_chat_history(session_id: str, current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))):
    """
    Retrieves the full chat history for a given session ID.
    Ensures that the user requesting the history is the one who owns it.
    """
    chat_history = await chat_history_service.get_chat_by_id(session_id)
    if not chat_history:
        raise HTTPException(status_code=404, detail="Chat history not found")
    
    # Simple authorization check: does the user ID in the chat match the current user?
    if str(chat_history.userId) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to view this chat history")
        
    return chat_history

@router.get("/history", response_model=List[ChatHistoryModel])
async def get_user_chat_history(current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))):
    """
    Retrieves all chat history for the current user.
    """
    chat_history = await chat_history_service.get_chat_history_for_user(str(current_user.id))
    return chat_history

# WebSocket route MUST come before catch-all delete route
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    print(f"🌐 WebSocket connection attempt from: {websocket.client}")
    print(f"🔗 WebSocket URL: {websocket.url}")
    print(f"🔍 Query params: {websocket.query_params}")
    
    # Extract token from query parameters manually
    token = websocket.query_params.get("token")
    print(f"🎫 Token received: {token[:50] if token else 'None'}...")
    
    # Pre-validate token before accepting connection
    if not token:
        print("❌ No token provided in query parameters")
        await websocket.close(code=1008, reason="No token provided")
        return
        
    try:
        # Quick token validation before accepting
        if not settings.JWT_SECRET or not settings.JWT_ALGORITHM:
            print("❌ JWT configuration missing")
            await websocket.close(code=1011, reason="Server configuration error")
            return
            
        # Try to decode token
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        
        if not user_id:
            print("❌ No user_id in token payload")
            await websocket.close(code=1008, reason="Invalid token")
            return
            
        print(f"✅ Token pre-validation successful, user_id: {user_id}")
        
    except jwt.PyJWTError as e:
        print(f"❌ JWT pre-validation error: {e}")
        await websocket.close(code=1008, reason=f"Token error: {e}")
        return
    except Exception as e:
        print(f"❌ Unexpected pre-validation error: {e}")
        await websocket.close(code=1011, reason=f"Validation error: {e}")
        return
    
    try:
        await websocket.accept()
        print("✅ WebSocket connection accepted")
    except Exception as e:
        print(f"❌ Failed to accept WebSocket connection: {e}")
        return
        
    try:
        print(f"🔐 WebSocket auth attempt with token: {token[:50]}...")
        print(f"🔑 JWT_SECRET available: {'Yes' if settings.JWT_SECRET else 'No'}")
        print(f"🔧 JWT_ALGORITHM: {settings.JWT_ALGORITHM}")
        
        if not settings.JWT_SECRET or not settings.JWT_ALGORITHM:
            print("❌ JWT configuration missing")
            raise ValueError("JWT_SECRET and JWT_ALGORITHM must be configured")

        # 1. Authenticate user from token
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        print(f"✅ Token decoded successfully, user_id: {user_id}")
        
        if not user_id:
            print("❌ No user_id in token payload")
            await websocket.close(code=1008, reason="Invalid token")
            return
            
        print(f"🎯 WebSocket authenticated for user: {user_id}")

    except jwt.PyJWTError as e:
        print(f"❌ JWT decode error: {e}")
        await websocket.close(code=1008, reason=f"Token error: {e}")
        return
    except Exception as e:
        print(f"❌ Unexpected auth error: {e}")
        await websocket.close(code=1011, reason=f"An unexpected error occurred during auth: {e}")
        return

    try:
        # 2. Wait for the initial message from the client
        initial_message = await websocket.receive_text()
        data = json.loads(initial_message)

        # 3. Extract chat parameters - support both old and new format
        session_id = data.get("session_id")
        message = data.get("message")
        images_data = data.get("images", [])
        
        # Check if using new agent-based format
        agent_id = data.get("agent_id")
        if agent_id:
            # New agent-based format
            try:
                # Get agent data
                agent = await agent_service.get_agent_by_id(agent_id)
                if not agent:
                    await websocket.send_text(json.dumps({"type": "error", "data": "Agent not found"}))
                    await websocket.close()
                    return
                
                # Extract model and collection info from agent
                model_id = agent.modelId
                collection_names = agent.collectionNames
                system_prompt = agent.systemPrompt
                temperature = agent.temperature
                max_tokens = agent.maxTokens
                
                print(f"🤖 Using agent: {agent.name} (ID: {agent_id})")
                print(f"📝 System prompt: {system_prompt[:100]}...")
                
            except Exception as e:
                await websocket.send_text(json.dumps({"type": "error", "data": f"Failed to load agent: {str(e)}"}))
                await websocket.close()
                return
        else:
            # Legacy format - model_id + collection_names
            model_id = data.get("model_id")
            collection_names = data.get("collection_names")
            system_prompt = None
            temperature = 0.7
            max_tokens = 4000
            
            print(f"⚠️ Using legacy format: model_id={model_id}")
        
        images = [ImagePayload(**img) for img in images_data] if images_data else []

        # 4. Basic validation
        if not all([session_id, message, model_id, isinstance(collection_names, list)]):
            await websocket.send_text(json.dumps({"type": "error", "data": "Missing required fields"}))
            await websocket.close()
            return
            
        # 4.1 Ensure chat document exists – create if new and inform client (Option A)
        db_chat = None
        try:
            # Try load if looks like ObjectId
            if len(session_id) == 24:
                db_chat = await chat_history_service.get_chat_by_id(session_id)
        except Exception:
            db_chat = None

        if db_chat is None:
            # Create new chat in DB and send event back
            new_chat = await chat_history_service.create_chat(
                user_id=user_id,
                name="New Chat",
                agent_id=agent_id,
                model_id=model_id,
            )
            session_id = new_chat.id
            await websocket.send_text(json.dumps({"type": "room_created", "data": {"chatId": session_id}}))

        # 5. Persist user message immediately
        await chat_history_service.add_message_to_chat(
            str(session_id),
            ChatMessage(
                id=str(ObjectId()),
                role="user",
                content=message,
                timestamp=_dt.utcnow(),
                images=images if images else None,
                isStreaming=False,
                isComplete=True,
            ),
        )

        # 6. Enqueue Celery task (background worker) to generate assistant answer
        task_payload = {
            "session_id": session_id,
            "user_id": user_id,
            "message": message,
            "model_id": model_id,
            "collection_names": collection_names,
            "images": images_data,
            "system_prompt": system_prompt,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "agent_id": agent_id,
        }

        generate_answer.delay(task_payload)

        # 7. Send ack back to client but KEEP socket open for streaming
        await websocket.send_text(json.dumps({"type": "accepted", "data": {"chatId": session_id}}))

        # --- Register WebSocket for streaming ---
        await ws_manager.connect(str(session_id), websocket)

        try:
            # Keep connection alive; listen for client pings or allow client to close.
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            ws_manager.disconnect(str(session_id), websocket)

    except WebSocketDisconnect:
        print(f"Client {user_id} disconnected")
    except Exception as e:
        try:
            if websocket.client_state.name != 'DISCONNECTED':
                error_message = json.dumps({"type": "error", "data": f"An unexpected error occurred: {str(e)}"})
                await websocket.send_text(error_message)
        except:
            pass  # Ignore errors when sending error message
        print(f"Error in websocket for user {user_id}: {e}")
    finally:
        try:
            if websocket.client_state.name not in ['DISCONNECTED', 'CLOSED']:
                await websocket.close()
        except:
            pass  # Ignore errors when closing connection
        print(f"WebSocket connection closed for user {user_id}") 

@router.delete("/{chat_id}")
async def delete_chat(chat_id: str, current_user: User = Depends(get_current_user_with_roles([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))):
    """
    Delete a chat session.
    """
    # First check if chat exists and belongs to user
    chat = await chat_history_service.get_chat_by_id(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if str(chat.userId) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this chat")
    
    success = await chat_history_service.delete_chat(chat_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete chat")
    
    return {"message": "Chat deleted successfully"}

@router.post("/create")
async def create_chat_endpoint(
    req: CreateChatRequest,
    current_user: User = Depends(get_current_user_with_roles([
        UserRole.STAFFS,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.STUDENTS,
    ])),
):
    """Pre-create a chat session and return its ObjectId.

    Frontendจะเรียก endpoint นี้ก่อนส่งข้อความแรก เพื่อให้ได้ id คงที่สําหรับ Redis Memory.
    """

    if not (req.agent_id or req.model_id):
        raise HTTPException(status_code=400, detail="agent_id or model_id is required")

    chat = await chat_history_service.create_chat(
        user_id=str(current_user.id),
        name=req.name or "New Chat",
        agent_id=req.agent_id,
        model_id=req.model_id,
    )

    return {"chatId": chat.id} 