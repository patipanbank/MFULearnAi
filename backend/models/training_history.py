from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class TrainingAction(str, Enum):
    UPLOAD = 'upload'
    DELETE = 'delete'
    CREATE_COLLECTION = 'create_collection'
    UPDATE_COLLECTION = 'update_collection'
    DELETE_COLLECTION = 'delete_collection'

class TrainingHistory(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    userId: str
    username: str
    collectionName: str
    documentName: Optional[str] = None
    action: TrainingAction
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    details: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "userId": "user123",
                "username": "johndoe",
                "collectionName": "my-collection",
                "action": "upload",
                "documentName": "document1.pdf"
            }
        } 