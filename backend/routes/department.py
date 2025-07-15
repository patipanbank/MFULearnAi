from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from services.department_service import department_service
from models.department import Department
from middleware.role_guard import role_guard, TokenPayload
from pydantic import BaseModel

router = APIRouter()

class CreateDepartmentRequest(BaseModel):
    name: str
    description: Optional[str] = None

class UpdateDepartmentRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class DepartmentResponse(Department):
    pass

class DeleteResponse(BaseModel):
    message: str
    department: Department

@router.get("/", response_model=List[DepartmentResponse])
async def get_all_departments():
    return await department_service.get_all_departments()

@router.get("/{id}", response_model=DepartmentResponse)
async def get_department_by_id(id: str):
    department = await department_service.get_department_by_id(id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return department

@router.post("/", response_model=DepartmentResponse, status_code=201)
async def create_department(
    department: CreateDepartmentRequest,
    current_user: TokenPayload = Depends(role_guard(["SuperAdmin"]))
):
    try:
        new_department = await department_service.create_department(department.model_dump())
        return new_department
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{id}", response_model=DepartmentResponse)
async def update_department(
    id: str,
    department: UpdateDepartmentRequest,
    current_user: TokenPayload = Depends(role_guard(["SuperAdmin"]))
):
    try:
        updated_department = await department_service.update_department(id, department.model_dump(exclude_unset=True))
        if not updated_department:
            raise HTTPException(status_code=404, detail="Department not found")
        return updated_department
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{id}", response_model=DeleteResponse)
async def delete_department(
    id: str,
    current_user: TokenPayload = Depends(role_guard(["SuperAdmin"]))
):
    deleted_department = await department_service.delete_department(id)
    if not deleted_department:
        raise HTTPException(status_code=404, detail="Department not found")
    return {"message": "Department deleted successfully", "department": deleted_department} 