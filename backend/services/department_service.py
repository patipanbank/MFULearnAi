from lib.mongodb import get_database
from models.department import Department
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from typing import List, Optional

class DepartmentService:
    async def get_all_departments(self) -> List[Department]:
        db = get_database()
        departments_cursor = db.get_collection("departments").find().sort("name", 1)
        departments_list = await departments_cursor.to_list(length=None)
        return [Department(**dept) for dept in departments_list]

    async def get_department_by_id(self, id: str) -> Optional[Department]:
        db = get_database()
        department = await db.get_collection("departments").find_one({"_id": ObjectId(id)})
        return Department(**department) if department else None

    async def get_department_by_name(self, name: str) -> Optional[Department]:
        db = get_database()
        department = await db.get_collection("departments").find_one({"name": name})
        return Department(**department) if department else None

    async def create_department(self, department_data: dict) -> Department:
        db = get_database()
        department = Department(**department_data)
        try:
            result = await db.get_collection("departments").insert_one(department.model_dump(by_alias=True))
            department.id = str(result.inserted_id)
            return department
        except DuplicateKeyError:
            raise ValueError("Department with this name already exists")

    async def update_department(self, id: str, department_data: dict) -> Optional[Department]:
        db = get_database()
        update_data = {k: v for k, v in department_data.items() if v is not None}
        if not update_data:
            raise ValueError("No fields to update")
            
        try:
            updated_department = await db.get_collection("departments").find_one_and_update(
                {"_id": ObjectId(id)},
                {"$set": update_data},
                return_document=True
            )
            return Department(**updated_department) if updated_department else None
        except DuplicateKeyError:
            raise ValueError("Department with this name already exists")

    async def delete_department(self, id: str) -> Optional[Department]:
        db = get_database()
        deleted_department = await db.get_collection("departments").find_one_and_delete({"_id": ObjectId(id)})
        return Department(**deleted_department) if deleted_department else None

department_service = DepartmentService()

async def ensure_department_exists(department_name: str):
    if not department_name or not department_name.strip():
        return False
    
    existing_department = await department_service.get_department_by_name(department_name)
    if existing_department:
        return False
        
    await department_service.create_department({
        "name": department_name,
        "description": f"Automatically created department for {department_name}"
    })
    print(f"Automatically created department: {department_name}")
    return True 