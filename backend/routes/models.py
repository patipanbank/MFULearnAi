from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Optional
from pydantic import BaseModel

from services.model_service import model_service
from models.model import Model, ModelType
from middleware.role_guard import get_current_user_with_roles
from models.user import User, UserRole

router = APIRouter()

# Request Models
class CreateModelRequest(BaseModel):
    name: str
    modelType: ModelType
    department: Optional[str] = None

class UpdateCollectionsRequest(BaseModel):
    collections: List[str]

# Response Models
class ModelResponse(Model):
     class Config:
        from_attributes = True

@router.get("", response_model=List[Model])
async def get_models(
    current_user: User = Depends(get_current_user_with_roles([UserRole.STUDENTS, UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    return await model_service.get_models(user=current_user)

@router.get("/{model_id}", response_model=Model)
async def get_model(
    model_id: str, 
    current_user: User = Depends(get_current_user_with_roles([UserRole.STUDENTS, UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    model = await model_service.get_model_by_id(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    is_admin = current_user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]
    is_owner = model.createdBy == current_user.username
    is_department_member = model.modelType == ModelType.DEPARTMENT and current_user.department and model.department == current_user.department

    if not (is_admin or is_owner or model.modelType == ModelType.OFFICIAL or is_department_member):
        raise HTTPException(status_code=403, detail="Not authorized to access this model")
    
    return model

@router.post("", response_model=Model, status_code=201)
async def create_model(
    model_data: dict = Body(...),
    current_user: User = Depends(get_current_user_with_roles([UserRole.STUDENTS, UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    try:
        new_model = await model_service.create_model(model_data, current_user)
        return new_model
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{model_id}/collections", response_model=Model)
async def update_model_collections(
    model_id: str, 
    request_data: UpdateCollectionsRequest,
    current_user: User = Depends(get_current_user_with_roles([UserRole.STUDENTS, UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    updated_model = await model_service.update_model_collections(model_id, request_data.collections, current_user)
    if not updated_model:
        raise HTTPException(status_code=404, detail="Model not found or user does not have permission to update.")
    return updated_model

@router.delete("/{model_id}", status_code=204)
async def delete_model(model_id: str, current_user: User = Depends(get_current_user_with_roles([UserRole.STUDENTS, UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    try:
        success = await model_service.delete_model(model_id, current_user)
        if not success:
            raise HTTPException(status_code=404, detail="Model not found or user does not have permission to delete.")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e)) 