from typing import List, Optional, Dict, Any
from datetime import datetime
from lib.mongodb import get_database
from models.collection import Collection, CollectionPermission
from models.user import User, UserRole
from bson import ObjectId

class CollectionService:
    def __init__(self):
        self._db = None
        self._collections_collection = None
    
    @property
    def db(self):
        if self._db is None:
            self._db = get_database()
        return self._db
    
    @property
    def collections_collection(self):
        if self._collections_collection is None:
            self._collections_collection = self.db.collections
        return self._collections_collection

    async def get_all_collections(self) -> List[Collection]:
        """Get all collections"""
        try:
            collections_cursor = self.collections_collection.find({})
            collections = []
            async for collection_doc in collections_cursor:
                collection_doc["id"] = str(collection_doc.pop("_id"))
                collections.append(Collection(**collection_doc))
            return collections
        except Exception as e:
            print(f"Error getting all collections: {e}")
            return []

    async def get_collection_by_id(self, collection_id: str) -> Optional[Collection]:
        """Get collection by ID"""
        try:
            collection_doc = await self.collections_collection.find_one({"_id": ObjectId(collection_id)})
            if collection_doc:
                collection_doc["id"] = str(collection_doc.pop("_id"))
                return Collection(**collection_doc)
            return None
        except Exception as e:
            print(f"Error getting collection by ID: {e}")
            return None

    async def create_collection(self, name: str, permission: CollectionPermission, created_by: User, model_id: Optional[str] = None) -> Collection:
        """Create a new collection"""
        try:
            # Validate collection name
            if not name or not name.strip():
                raise ValueError("Collection name cannot be empty")
            
            name = name.strip()
            if len(name) < 3:
                raise ValueError("Collection name must be at least 3 characters long")
            
            if len(name) > 100:
                raise ValueError("Collection name cannot exceed 100 characters")
            
            # Check for invalid characters (only allow alphanumeric, spaces, hyphens, underscores)
            import re
            if not re.match(r'^[a-zA-Z0-9\s\-_]+$', name):
                raise ValueError("Collection name can only contain letters, numbers, spaces, hyphens, and underscores")
            
            # Check for duplicate name
            existing_collection = await self.collections_collection.find_one({"name": name})
            if existing_collection:
                raise ValueError(f"Collection with name '{name}' already exists")
            
            collection_doc = {
                "_id": ObjectId(),
                "name": name,
                "permission": permission,  # Remove .value since permission is already a string
                "createdBy": created_by.username,
                "createdAt": datetime.utcnow().isoformat()
            }
            
            # Only add modelId if it's provided
            if model_id:
                collection_doc["modelId"] = model_id
            
            result = await self.collections_collection.insert_one(collection_doc)
            collection_doc["id"] = str(collection_doc.pop("_id"))
            return Collection(**collection_doc)
        except Exception as e:
            print(f"Error creating collection: {e}")
            raise ValueError(f"Failed to create collection: {str(e)}")

    async def update_collection(self, collection_id: str, updates: Dict[str, Any]) -> Optional[Collection]:
        """Update collection"""
        try:
            # Remove None values
            updates = {k: v for k, v in updates.items() if v is not None}
            if not updates:
                return await self.get_collection_by_id(collection_id)
            
            result = await self.collections_collection.find_one_and_update(
                {"_id": ObjectId(collection_id)},
                {"$set": updates},
                return_document=True
            )
            
            if result:
                result["id"] = str(result.pop("_id"))
                return Collection(**result)
            return None
        except Exception as e:
            print(f"Error updating collection: {e}")
            return None

    async def delete_collection(self, collection: Collection, current_user: User) -> bool:
        """Delete collection"""
        try:
            result = await self.collections_collection.delete_one({"_id": ObjectId(collection.id)})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting collection: {e}")
            return False

    def can_user_access_collection(self, user: User, collection: Collection) -> bool:
        """Check if user can access collection"""
        # Public collections can be accessed by anyone
        if collection.permission == "public":
            return True
        
        # Private collections can only be accessed by creator
        if collection.permission == "private":
            return collection.createdBy == user.username
        
        # Department collections can be accessed by same department users
        if collection.permission == "department":
            return (collection.createdBy == user.username or 
                   user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN])
        
        # Default to no access
        return False

# Create singleton instance
collection_service = CollectionService() 