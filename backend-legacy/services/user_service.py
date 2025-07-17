from lib.mongodb import get_database
from models.user import User, UserRole
from utils.security import verify_password, get_password_hash
from services.department_service import ensure_department_exists
from bson import ObjectId
from datetime import datetime
from pymongo.errors import DuplicateKeyError

class UserService:
    async def get_user_by_id(self, user_id: str):
        """
        Generic function to fetch any user by their MongoDB document ID.
        """
        db = get_database()
        user = await db.get_collection("users").find_one({"_id": ObjectId(user_id)})
        if user and "_id" in user:
            user["_id"] = str(user["_id"])
        return User(**user) if user else None

    async def get_all_admins(self):
        db = get_database()
        admins_cursor = db.get_collection("users").find({"role": UserRole.ADMIN}).sort("created", -1)
        admins = await admins_cursor.to_list(length=None)
        for admin in admins:
            if "_id" in admin:
                admin["_id"] = str(admin["_id"])
        return [User(**admin) for admin in admins]

    async def get_admin_by_id(self, admin_id: str):
        db = get_database()
        admin = await db.get_collection("users").find_one({"_id": ObjectId(admin_id), "role": UserRole.ADMIN})
        if admin and "_id" in admin:
            admin["_id"] = str(admin["_id"])
        return User(**admin) if admin else None

    async def create_admin(self, admin_data: dict):
        db = get_database()
        if not all(k in admin_data for k in ['username', 'password', 'firstName', 'lastName', 'email', 'department']):
             raise ValueError("Please fill in all required fields")

        if await db.get_collection("users").find_one({"username": admin_data["username"]}):
            raise ValueError("This username already exists")

        await ensure_department_exists(admin_data["department"])

        hashed_password = get_password_hash(admin_data["password"])
        
        # We need to manually create the document to insert, as the User model doesn't expect an _id on creation
        new_admin_doc = {
            "_id": ObjectId(),
            "nameID": admin_data["username"],
            "username": admin_data["username"],
            "password": hashed_password,
            "email": admin_data["email"],
            "firstName": admin_data["firstName"],
            "lastName": admin_data["lastName"],
            "department": admin_data["department"],
            "role": UserRole.ADMIN,
            "groups": ['Admin'],
            "created": datetime.utcnow(),
            "updated": datetime.utcnow()
        }

        await db.get_collection("users").insert_one(new_admin_doc)
        
        # Convert ObjectId to string for Pydantic model
        new_admin_doc["_id"] = str(new_admin_doc["_id"])
        
        # Return a User model instance created from the inserted document
        return User(**new_admin_doc)
    
    async def update_admin(self, admin_id: str, admin_data: dict):
        db = get_database()
        admin_to_update = await db.get_collection("users").find_one({"_id": ObjectId(admin_id), "role": UserRole.ADMIN})
        if not admin_to_update:
            return None

        update_fields = {}
        
        if "username" in admin_data and admin_data["username"] != admin_to_update.get("username"):
            if await db.get_collection("users").find_one({"username": admin_data["username"]}):
                 raise ValueError("This username already exists")
            update_fields["username"] = admin_data["username"]
            update_fields["nameID"] = admin_data["username"]

        if "password" in admin_data and admin_data["password"]:
            update_fields["password"] = get_password_hash(admin_data["password"])
        
        if "department" in admin_data:
             await ensure_department_exists(admin_data["department"])
             update_fields["department"] = admin_data["department"]

        for field in ["firstName", "lastName", "email"]:
            if field in admin_data:
                update_fields[field] = admin_data[field]
        
        if not update_fields:
            return User(**admin_to_update)

        update_fields["updated"] = datetime.utcnow()

        result = await db.get_collection("users").find_one_and_update(
            {"_id": ObjectId(admin_id)},
            {"$set": update_fields},
            return_document=True
        )
        if result and "_id" in result:
            result["_id"] = str(result["_id"])
        return User(**result) if result else None


    async def delete_admin(self, admin_id: str):
        db = get_database()
        result = await db.get_collection("users").find_one_and_delete({"_id": ObjectId(admin_id), "role": UserRole.ADMIN})
        return result is not None


    async def find_admin_by_username(self, username: str):
        db = get_database()
        user = await db.get_collection("users").find_one({
            "username": username,
            "role": {"$in": [UserRole.ADMIN, UserRole.SUPER_ADMIN]}
        })
        if user and "_id" in user:
            user["_id"] = str(user["_id"])
        return User(**user) if user else None

    async def verify_admin_password(self, password: str, hashed_password: str) -> bool:
        return verify_password(password, hashed_password)

    async def find_or_create_saml_user(self, profile: dict):
        db = get_database()
        username = profile.get('username')
        if not username:
            raise ValueError("Username is required from SAML profile")

        department_name = profile.get('department', '').lower()
        if department_name:
            await ensure_department_exists(department_name)
        
        groups = profile.get('groups', [])
        if not isinstance(groups, list):
            groups = [groups]

        def map_group_to_role(user_groups: list) -> UserRole:
            # The original code has a specific group ID for students.
            # Replicating that logic. A better approach might be more flexible.
            is_student = any(g == 'S-1-5-21-893890582-1041674030-1199480097-43779' for g in user_groups)
            return UserRole.STUDENTS if is_student else UserRole.STAFFS

        user_data_to_update = {
            "nameID": profile.get('nameID'),
            "username": username,
            "email": profile.get('email'),
            "firstName": profile.get('firstName'),
            "lastName": profile.get('lastName'),
            "department": department_name,
            "groups": groups,
            "role": map_group_to_role(groups),
            "updated": datetime.utcnow()
        }

        # Remove None values so they don't overwrite existing data
        user_data_to_update = {k: v for k, v in user_data_to_update.items() if v is not None}

        updated_user = await db.get_collection("users").find_one_and_update(
            {"username": username},
            {
                "$set": user_data_to_update,
                "$setOnInsert": {"created": datetime.utcnow()}
            },
            upsert=True,
            return_document=True
        )
        
        # Convert ObjectId to string for Pydantic model
        if updated_user and "_id" in updated_user:
            updated_user["_id"] = str(updated_user["_id"])
        
        return User(**updated_user)

user_service = UserService() 