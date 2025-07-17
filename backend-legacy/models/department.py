from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class Department(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    description: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "name": "School of Information Technology",
                "description": "IT Department"
            }
        } 