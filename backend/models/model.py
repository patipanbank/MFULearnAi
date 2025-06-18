from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class ModelType(str, Enum):
    OFFICIAL = 'official'
    PERSONAL = 'personal'
    DEPARTMENT = 'department'

class Model(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    collections: List[str] = []
    createdBy: str
    modelType: ModelType
    department: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "name": "My Custom Model",
                "collections": ["collection1", "collection2"],
                "createdBy": "user123",
                "modelType": "personal"
            }
        } 