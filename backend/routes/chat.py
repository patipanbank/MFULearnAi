from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import List, Optional
import jwt
import json

from services.chat_service import chat_service
from services.chat_history_service import chat_history_service
from models.user import User, UserRole
from models.chat import ImagePayload, Chat as ChatHistoryModel
from middleware.role_guard import role_guard
from config.config import settings

router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)

# This is kept for reference, but the primary communication will be over WebSocket.
class ChatRequest(BaseModel):
    session_id: str
    message: str
    model_id: str
    collection_names: List[str]
    images: Optional[List[ImagePayload]] = Field(default=None)

@router.get("/history/{session_id}", response_model=ChatHistoryModel)
async def get_chat_history(session_id: str, current_user: User = Depends(role_guard([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))):
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
async def get_user_chat_history(current_user: User = Depends(role_guard([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))):
    """
    Retrieves all chat history for the current user.
    """
    chat_history = await chat_history_service.get_chat_history_for_user(str(current_user.id))
    return chat_history

@router.delete("/{chat_id}")
async def delete_chat(chat_id: str, current_user: User = Depends(role_guard([UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS]))):
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

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    await websocket.accept()
    try:
        if not settings.JWT_SECRET or not settings.JWT_ALGORITHM:
            raise ValueError("JWT_SECRET and JWT_ALGORITHM must be configured")

        # 1. Authenticate user from token
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=1008, reason="Invalid token")
            return

    except jwt.PyJWTError as e:
        await websocket.close(code=1008, reason=f"Token error: {e}")
        return
    except Exception as e:
        await websocket.close(code=1011, reason=f"An unexpected error occurred during auth: {e}")
        return

    try:
        # 2. Wait for the initial message from the client
        initial_message = await websocket.receive_text()
        data = json.loads(initial_message)

        # 3. Extract chat parameters
        session_id = data.get("session_id")
        message = data.get("message")
        model_id = data.get("model_id")
        collection_names = data.get("collection_names")
        images_data = data.get("images", [])
        
        images = [ImagePayload(**img) for img in images_data] if images_data else []


        # 4. Basic validation
        if not all([session_id, message, model_id, isinstance(collection_names, list)]):
            await websocket.send_text(json.dumps({"type": "error", "data": "Missing required fields"}))
            await websocket.close()
            return
            
        # 5. Call the chat service and stream the response
        async for chunk in chat_service.chat(
            session_id=session_id,
            user_id=user_id,
            message=message,
            model_id=model_id,
            collection_names=collection_names,
            images=images
        ):
            await websocket.send_text(chunk) # The service already JSON-encodes and adds newline

    except WebSocketDisconnect:
        print(f"Client {user_id} disconnected")
    except Exception as e:
        error_message = json.dumps({"type": "error", "data": f"An unexpected error occurred: {str(e)}"})
        await websocket.send_text(error_message)
        print(f"Error in websocket for user {user_id}: {e}")
    finally:
        if not websocket.client_state.value == 3: # i.e. not disconnected
            await websocket.close()
        print(f"WebSocket connection closed for user {user_id}") 