from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class ImagePayload(BaseModel):
    url: str
    mediaType: str

class ChatMessage(BaseModel):
    id: str
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime
    images: Optional[List[ImagePayload]] = None
    # Streaming flags (optional)
    isStreaming: Optional[bool] = None
    isComplete: Optional[bool] = None

class ChatSession(BaseModel):
    id: str
    user_id: str
    messages: List[ChatMessage] = []

class Chat(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    userId: str
    chatname: str = "Untitled Chat"
    name: str
    messages: List[ChatMessage]
    # New agent-based field
    agentId: Optional[str] = None
    # Legacy fields for backward compatibility
    modelId: Optional[str] = None
    collectionNames: Optional[List[str]] = None
    isPinned: bool = False
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "userId": "user123",
                "name": "My First Chat",
                "messages": [],
                "agentId": "agent-abc"
            }
        } 