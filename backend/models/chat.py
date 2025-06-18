from pydantic import BaseModel, Field
from typing import List, Optional, Union, Any
from datetime import datetime

class Image(BaseModel):
    data: str
    mediaType: str

class File(BaseModel):
    name: str
    data: str
    mediaType: str
    size: int

class Source(BaseModel):
    modelId: str
    collectionName: str
    filename: str
    similarity: float

class ImagePayload(BaseModel):
    media_type: str
    data: str # base64 encoded string

class Document(BaseModel):
    id: str
    collection_name: str
    filename: str
    content: str
    metadata: dict = {}
    similarity: float

class ChatMessage(BaseModel):
    id: Union[int, str]
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    images: Optional[List[Image]] = None
    files: Optional[List[File]] = None
    sources: Optional[List[Source]] = None
    isImageGeneration: Optional[bool] = None
    isComplete: Optional[bool] = None
    isEdited: Optional[bool] = None

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
    modelId: str
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
                "modelId": "model-abc"
            }
        } 