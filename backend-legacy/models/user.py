from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    ADMIN = 'Admin'
    STAFFS = 'Staffs'
    STUDENTS = 'Students'
    SUPER_ADMIN = 'SuperAdmin'

class User(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    nameID: str
    username: str
    password: Optional[str] = None
    email: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    department: Optional[str] = None
    role: UserRole = UserRole.STUDENTS
    groups: List[str] = []
    created: datetime = Field(default_factory=datetime.utcnow)
    updated: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "nameID": "12345",
                "username": "johndoe",
                "email": "johndoe@example.com",
                "role": "Students"
            }
        } 