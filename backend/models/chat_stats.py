from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date

class ChatStats(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    date: date
    uniqueUsers: List[str] = []
    totalChats: int = 0
    totalTokens: int = 0

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "date": "2024-01-01",
                "uniqueUsers": ["user1", "user2"],
                "totalChats": 10,
                "totalTokens": 5000
            }
        } 