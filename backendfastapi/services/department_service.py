from lib.mongodb import get_database
from models.department import Department
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from typing import List, Optional
from datetime import datetime

class DepartmentService:
    def _prepare_department_data(self, department_data: dict) -> dict:
        """Convert ObjectId to string before creating Department model"""
        if "_id" in department_data and isinstance(department_data["_id"], ObjectId):
            department_data["_id"] = str(department_data["_id"])
        return department_data

    async def get_all_departments(self) -> List[Department]:
        db = get_database()
        departments_cursor = db.get_collection("departments").find().sort("name", 1)
        departments_list = await departments_cursor.to_list(length=None)
        return [Department(**self._prepare_department_data(dept)) for dept in departments_list]

    async def get_department_by_id(self, id: str) -> Optional[Department]:
        db = get_database()
        department = await db.get_collection("departments").find_one({"_id": ObjectId(id)})
        return Department(**self._prepare_department_data(department)) if department else None

    async def get_department_by_name(self, name: str) -> Optional[Department]:
        db = get_database()
        department = await db.get_collection("departments").find_one({"name": name.lower().strip()})
        return Department(**self._prepare_department_data(department)) if department else None

    async def create_department(self, department_data: dict) -> Department:
        db = get_database()
        # Normalize department name
        if "name" in department_data:
            department_data["name"] = department_data["name"].lower().strip()
            
        department_data["createdAt"] = datetime.utcnow()
        department_data["updatedAt"] = datetime.utcnow()
        
        try:
            result = await db.get_collection("departments").insert_one(department_data)
            department_data["_id"] = str(result.inserted_id)
            return Department(**department_data)
        except DuplicateKeyError:
            raise ValueError("Department with this name already exists")

    async def update_department(self, id: str, department_data: dict) -> Optional[Department]:
        db = get_database()
        update_data = {k: v for k, v in department_data.items() if v is not None}
        if not update_data:
            raise ValueError("No fields to update")
        
        # Normalize department name if present
        if "name" in update_data:
            update_data["name"] = update_data["name"].lower().strip()
            
        update_data["updatedAt"] = datetime.utcnow()
            
        try:
            updated_department = await db.get_collection("departments").find_one_and_update(
                {"_id": ObjectId(id)},
                {"$set": update_data},
                return_document=True
            )
            return Department(**self._prepare_department_data(updated_department)) if updated_department else None
        except DuplicateKeyError:
            raise ValueError("Department with this name already exists")

    async def delete_department(self, id: str) -> Optional[Department]:
        db = get_database()
        deleted_department = await db.get_collection("departments").find_one_and_delete({"_id": ObjectId(id)})
        return Department(**self._prepare_department_data(deleted_department)) if deleted_department else None

department_service = DepartmentService()

async def ensure_department_exists(department_name: str) -> Department:
    """
    Ensures a department exists by name, creating it if it doesn't exist.
    Returns the existing or newly created department.
    Raises ValueError if department_name is invalid.
    """
    if not department_name or not isinstance(department_name, str):
        raise ValueError("Invalid department name")
        
    normalized_name = department_name.lower().strip()
    if not normalized_name:
        raise ValueError("Department name cannot be empty")
    
    try:
        # Try to find existing department
        existing_department = await department_service.get_department_by_name(normalized_name)
        if existing_department:
            return existing_department
            
        # Create new department if it doesn't exist
        new_department = await department_service.create_department({
            "name": normalized_name,
            "description": f"Automatically created department for {department_name}"
        })
        print(f"✅ Created new department: {department_name}")
        return new_department
        
    except Exception as e:
        print(f"❌ Error in ensure_department_exists: {str(e)}")
        raise ValueError(f"Failed to ensure department exists: {str(e)}") 