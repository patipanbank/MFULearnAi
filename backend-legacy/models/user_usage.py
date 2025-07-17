from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class UserUsage(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    userId: str
    dailyTokens: int = 0
    tokenLimit: int = 100000
    lastReset: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "userId": "user123",
                "dailyTokens": 500,
                "tokenLimit": 100000
            }
        } 