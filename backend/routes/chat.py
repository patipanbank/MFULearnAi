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
        # Declare variables with defaults to prevent UnboundLocalError
        session_id: str | None = None
        agent_id: str | None = None
        model_id: str | None = None
        collection_names: list[str] = []
        system_prompt: str | None = None
        temperature: float = 0.7
        max_tokens: int = 4000
        
        # 2. Wait for the initial message from the client (could be create_room or message)
        initial_message = await websocket.receive_text()
        data = json.loads(initial_message)

        event_type = data.get("type")

        # Defaults (now declared above)
        # session_id: str | None = None
        message: str | None = data.get("message")
        images_data = data.get("images", [])
        # agent_id: str | None = None

        if event_type == "create_room":
            # --- Handle explicit room creation handshake ---
            agent_id = data.get("agent_id") or data.get("agentId")

            # If agent_id provided, load agent config for later reuse
            if agent_id:
                try:
                    agent = await agent_service.get_agent_by_id(agent_id)
                    if not agent:
                        await websocket.send_text(json.dumps({"type": "error", "data": "Agent not found"}))
                        await websocket.close()
                        return

                    model_id = agent.modelId
                    collection_names = agent.collectionNames or []
                    system_prompt = agent.systemPrompt
                    temperature = agent.temperature
                    max_tokens = agent.maxTokens
                except Exception as e:
                    await websocket.send_text(json.dumps({"type": "error", "data": f"Failed to load agent: {str(e)}"}))
                    await websocket.close()
                    return
            else:
                model_id = None
                collection_names = []
                system_prompt = None
                temperature = 0.7
                max_tokens = 4000

            # Create chat document immediately
            new_chat = await chat_history_service.create_chat(
                user_id=user_id,
                name=data.get("name", "New Chat"),
                agent_id=agent_id,
                model_id=model_id,
            )
            session_id = new_chat.id

            # Acknowledge room creation to client
            await websocket.send_text(json.dumps({"type": "room_created", "data": {"chatId": session_id}}))

            # Register the websocket BEFORE dispatching the celery task to avoid race conditions.
            await ws_manager.connect(str(session_id), websocket)

            # Proceed waiting for next message
            # Replace data with an empty dict for the while loop
            data = {}

        else:
            # Legacy initial message path (contains message)
            session_id = data.get("session_id")
            # message = data.get("message") # Already fetched
            # images_data = data.get("images", []) # Already fetched
            agent_id = data.get("agent_id")
            # downstream legacy handling continues

        images: list[ImagePayload] = [ImagePayload(**img) for img in images_data] if images_data else []

        # This block now ONLY handles the initial message if it's NOT a create_room event.
        if message:
            # 4. Basic validation – ensure required fields present
            if not session_id or not model_id or not isinstance(collection_names, list):
                await websocket.send_text(json.dumps({"type": "error", "data": "Missing required fields"}))
                await websocket.close()
                return

            # 4.1 Ensure chat document exists – create if new and inform client
            db_chat = None
            try:
                if len(session_id) == 24:
                    db_chat = await chat_history_service.get_chat_by_id(session_id)
            except Exception:
                db_chat = None

            if db_chat is None:
                new_chat = await chat_history_service.create_chat(
                    user_id=user_id,
                    name="New Chat",
                    agent_id=agent_id,
                    model_id=model_id,
                )
                session_id = new_chat.id
                await websocket.send_text(json.dumps({"type": "room_created", "data": {"chatId": session_id}}))
            
            # --- Key Fix: Register websocket BEFORE dispatching background task ---
            await ws_manager.connect(str(session_id), websocket)

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

            # 6. Enqueue Celery task
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

            # 7. Ack
            await websocket.send_text(json.dumps({"type": "accepted", "data": {"chatId": session_id}}))
        else:
            # This path is taken for event_type 'create_room', where the client
            # is expected to send a subsequent message.
            await ws_manager.connect(str(session_id), websocket)

        try:
            # Keep connection alive; process all incoming user messages.
            while True:
                try:
                    raw_msg = await websocket.receive_text()
                except WebSocketDisconnect:
                    break

                try:
                    incoming = json.loads(raw_msg)
                except Exception as e:
                    print(f"⚠️ Malformed WS message: {e}")
                    continue

                etype = incoming.get("type", "message")

                if etype == "ping":
                    await websocket.send_text("pong")
                    continue

                if etype == "create_room":
                    # This check is faulty as a user should be able to create
                    # multiple new chats from the same WebSocket connection.
                    # The frontend logic already ensures this is only sent with intent.
                    # if len(session_id or "") == 24:
                    #     # Room already exists; ignore
                    #     continue

                    cr_agent_id = incoming.get("agent_id") or incoming.get("agentId")

                    cr_model_id: str | None = None
                    cr_collection_names: list[str] = []
                    cr_system_prompt: str | None = None
                    cr_temperature = 0.7
                    cr_max_tokens = 4000

                    if cr_agent_id:
                        try:
                            cr_agent = await agent_service.get_agent_by_id(cr_agent_id)
                            if cr_agent:
                                cr_model_id = cr_agent.modelId
                                cr_collection_names = cr_agent.collectionNames or []
                                cr_system_prompt = cr_agent.systemPrompt
                                cr_temperature = cr_agent.temperature
                                cr_max_tokens = cr_agent.maxTokens
                        except Exception as exc:
                            await websocket.send_text(json.dumps({"type":"error","data":f"Failed to load agent: {exc}"}))
                            continue

                    new_chat = await chat_history_service.create_chat(
                        user_id=user_id,
                        name=incoming.get("name", "New Chat"),
                        agent_id=cr_agent_id,
                        model_id=cr_model_id,
                    )

                    session_id = new_chat.id

                    # Update context variables for subsequent messages
                    agent_id = cr_agent_id or agent_id
                    model_id = cr_model_id or model_id
                    collection_names = cr_collection_names or collection_names
                    system_prompt = cr_system_prompt or system_prompt
                    temperature = cr_temperature
                    max_tokens = cr_max_tokens

                    await websocket.send_text(json.dumps({"type":"room_created","data":{"chatId":session_id}}))

                    # Connect to pubsub room
                    await ws_manager.connect(str(session_id), websocket)
                    continue  # wait next message

                if etype != "message":
                    # Unknown or unhandled event type
                    continue

                new_message: str | None = incoming.get("text") or incoming.get("message")
                if not new_message:
                    continue  # nothing useful

                # Allow switching chat room within same socket if client sends chatId field
                incoming_session_id = incoming.get("chatId") or incoming.get("session_id", session_id)

                # Guard against placeholder or invalid ids (e.g., "chat_123...")
                if len(incoming_session_id) != 24:
                    # Ignore invalid session_id; keep using current valid one
                    incoming_session_id = session_id

                # If session changed, join new room in manager
                if incoming_session_id != session_id:
                    # Leave previous room
                    ws_manager.disconnect(str(session_id), websocket)
                    session_id = incoming_session_id
                    await ws_manager.connect(str(session_id), websocket)

                new_images_data = incoming.get("images", [])
                new_agent_id = incoming.get("agent_id") or incoming.get("agentId", agent_id)

                # If agent changed, reload its config
                if new_agent_id and new_agent_id != agent_id:
                    try:
                        agent = await agent_service.get_agent_by_id(new_agent_id)
                        if not agent:
                            await websocket.send_text(json.dumps({"type": "error", "data": "Agent not found"}))
                            continue

                        model_id = agent.modelId
                        collection_names = agent.collectionNames or []
                        system_prompt = agent.systemPrompt
                        temperature = agent.temperature
                        max_tokens = agent.maxTokens
                        agent_id = new_agent_id
                    except Exception as e:
                        await websocket.send_text(json.dumps({"type": "error", "data": f"Failed to load agent: {str(e)}"}))
                        continue

                # Persist the user message
                await chat_history_service.add_message_to_chat(
                    str(session_id),
                    ChatMessage(
                        id=str(ObjectId()),
                        role="user",
                        content=new_message,
                        timestamp=_dt.utcnow(),
                        images=[ImagePayload(**img) for img in new_images_data] if new_images_data else None,
                        isStreaming=False,
                        isComplete=True,
                    ),
                )

                # Dispatch background generation task
                task_payload = {
                    "session_id": session_id,
                    "user_id": user_id,
                    "message": new_message,
                    "model_id": model_id,
                    "collection_names": collection_names,
                    "images": new_images_data,
                    "system_prompt": system_prompt,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "agent_id": agent_id,
                }

                generate_answer.delay(task_payload)

                # Immediate ack so UI knows message accepted
                await websocket.send_text(json.dumps({"type": "accepted", "data": {"chatId": session_id}}))
        except WebSocketDisconnect:
            ws_manager.disconnect(str(session_id), websocket)
            pass
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