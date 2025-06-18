from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class SystemPrompt(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    prompt: str
    updatedBy: str
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "prompt": "You are a helpful assistant.",
                "updatedBy": "admin_user"
            }
        } 