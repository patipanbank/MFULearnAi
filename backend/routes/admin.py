from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel, EmailStr

from services.user_service import user_service
from services.system_prompt_service import system_prompt_service
from models.user import User
from models.system_prompt import SystemPrompt
from middleware.role_guard import role_guard, TokenPayload

router = APIRouter()

# Pydantic models for request bodies
class CreateAdminRequest(BaseModel):
    username: str
    password: str
    firstName: str
    lastName: str
    email: EmailStr
    department: str

class UpdateAdminRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    
class SystemPromptRequest(BaseModel):
    prompt: str

# Response Models
class AdminResponse(BaseModel):
    id: str
    username: str
    nameID: str
    email: EmailStr
    firstName: str
    lastName: str
    department: str
    role: str

    class Config:
        from_attributes = True

# Admin User Management
@router.get("/all", response_model=List[AdminResponse])
async def get_all_admins(current_user: TokenPayload = Depends(role_guard(["SuperAdmin"]))):
    admins = await user_service.get_all_admins()
    return admins

@router.get("/{admin_id}", response_model=AdminResponse)
async def get_admin(admin_id: str, current_user: TokenPayload = Depends(role_guard(["SuperAdmin"]))):
    admin = await user_service.get_admin_by_id(admin_id)
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    return admin

@router.post("/create", response_model=AdminResponse, status_code=201)
async def create_admin(admin_data: CreateAdminRequest, current_user: TokenPayload = Depends(role_guard(["SuperAdmin"]))):
    try:
        new_admin = await user_service.create_admin(admin_data.model_dump())
        return new_admin
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{admin_id}", response_model=AdminResponse)
async def update_admin(admin_id: str, admin_data: UpdateAdminRequest, current_user: TokenPayload = Depends(role_guard(["SuperAdmin"]))):
    try:
        updated_admin = await user_service.update_admin(admin_id, admin_data.model_dump(exclude_unset=True))
        if not updated_admin:
            raise HTTPException(status_code=404, detail="Admin not found")
        return updated_admin
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{admin_id}", status_code=204)
async def delete_admin(admin_id: str, current_user: TokenPayload = Depends(role_guard(["SuperAdmin"]))):
    success = await user_service.delete_admin(admin_id)
    if not success:
        raise HTTPException(status_code=404, detail="Admin not found")
    return None # No content response

# System Prompt Management
@router.get("/system-prompt", response_model=SystemPrompt)
async def get_system_prompt(current_user: TokenPayload = Depends(role_guard(["SuperAdmin"]))):
    prompt = await system_prompt_service.get_system_prompt()
    return prompt

@router.put("/system-prompt", response_model=SystemPrompt)
async def update_system_prompt(prompt_data: SystemPromptRequest, current_user: TokenPayload = Depends(role_guard(["SuperAdmin"]))):
    try:
        updated_prompt = await system_prompt_service.update_system_prompt(prompt_data.prompt, current_user.username)
        return updated_prompt
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) 