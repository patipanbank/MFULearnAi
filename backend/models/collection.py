from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class CollectionPermission(str, Enum):
    PUBLIC = 'PUBLIC'
    PRIVATE = 'PRIVATE'

class Collection(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    permission: CollectionPermission
    createdBy: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "name": "My Document Collection",
                "permission": "PRIVATE",
                "createdBy": "user123"
            }
        } 