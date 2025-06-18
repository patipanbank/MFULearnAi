from lib.mongodb import get_database
from models.model import Model, ModelType
from models.collection import Collection, CollectionPermission
from middleware.role_guard import TokenPayload
from services.training_history_service import training_history_service, TrainingAction
from models.user import UserRole, User
from bson import ObjectId
from typing import List, Optional
from .department_service import department_service
from .chroma_service import chroma_service
from datetime import datetime

class ModelService:
    async def get_all_models(self) -> List[Model]:
        db = get_database()
        models_cursor = db.get_collection("models").find()
        return [Model(**model) async for model in models_cursor]

    async def get_model_by_id(self, model_id: str) -> Optional[Model]:
        db = get_database()
        model = await db.get_collection("models").find_one({"_id": ObjectId(model_id)})
        return Model(**model) if model else None

    async def create_model(self, model_data: dict, user: User) -> Model:
        model_type_str = model_data.get("modelType")
        department_name = model_data.get("department")

        is_admin = user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]
        
        try:
            model_type = ModelType(model_type_str)
        except ValueError:
            raise ValueError(f"Invalid model type: {model_type_str}")

        if model_type in [ModelType.OFFICIAL, ModelType.DEPARTMENT] and not is_admin:
            raise ValueError("Only Admin or SuperAdmin can create official or department models")
        
        if model_type == ModelType.DEPARTMENT and not department_name:
            raise ValueError("Department is required for department models")
            
        model_dict = {
            "name": model_data["name"],
            "createdBy": user.username,
            "modelType": model_type,
            "department": department_name if model_type == ModelType.DEPARTMENT else None,
        }
        
        model = Model(**model_dict)
        db = get_database()
        result = await db.get_collection("models").insert_one(model.model_dump(by_alias=True))
        model.id = str(result.inserted_id)
        return model

    async def get_models(self, user: User) -> List[Model]:
        db = get_database()
        models_cursor = db.get_collection("models").find()
        all_models = await models_cursor.to_list(length=None)

        filtered_models = []
        for model_data in all_models:
            model = Model(**model_data)
            if model.modelType == ModelType.OFFICIAL:
                filtered_models.append(model)
            elif model.modelType == ModelType.PERSONAL and model.createdBy == user.username:
                filtered_models.append(model)
            elif model.modelType == ModelType.DEPARTMENT and user.department and model.department == user.department:
                filtered_models.append(model)
        
        return filtered_models

    async def update_model_collections(self, model_id: str, collections: list[str], user: User) -> Optional[Model]:
        db = get_database()
        model_to_update = await self.get_model_by_id(model_id)
        if not model_to_update:
            return None

        is_admin = user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]
        is_owner = model_to_update.createdBy == user.username
        
        if not (is_admin or is_owner):
            raise ValueError("User does not have permission to update this model's collections")
        
        updated_model_doc = await db.get_collection("models").find_one_and_update(
            {"_id": ObjectId(model_id)},
            {"$set": {"collections": collections, "updatedAt": datetime.utcnow()}},
            return_document=True
        )

        if not updated_model_doc:
            return None

        for collection_name in collections:
             await training_history_service.record_action(
                user_id=str(user.id),
                username=user.username,
                collection_name=collection_name,
                action=TrainingAction.UPDATE_COLLECTION,
                details={
                    "modelId": model_id,
                    "modelName": model_to_update.name,
                    "updated_by": user.username
                }
            )

        return Model(**updated_model_doc)

    async def delete_model(self, model_id: str, user: User) -> bool:
        db = get_database()
        model_to_delete = await self.get_model_by_id(model_id)
        if not model_to_delete:
            return False

        is_admin = user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]
        is_owner = model_to_delete.createdBy == user.username
        
        if not (is_admin or is_owner):
            raise ValueError("User does not have permission to delete this model")

        result = await db.get_collection("models").delete_one({"_id": ObjectId(model_id)})
        return result.deleted_count > 0

    async def create_collection(self, name: str, permission: CollectionPermission, created_by: User, model_id: str) -> Collection:
        db = get_database()
        
        collection = Collection(
            _id=None,
            name=name,
            permission=permission,
            createdBy=created_by.username
        )

        insert_result = await db.get_collection("collections").insert_one(collection.model_dump(by_alias=True))
        
        try:
            await chroma_service._get_collection(name)
            
            await training_history_service.record_action(
                user_id=str(created_by.id),
                username=created_by.username,
                collection_name=name,
                action=TrainingAction.CREATE_COLLECTION,
                details={'permission': permission.value}
            )
        except Exception as e:
            await db.get_collection("collections").delete_one({"_id": insert_result.inserted_id})
            raise e
        
        collection.id = str(insert_result.inserted_id)
        return collection

    async def update_collection(self, collection_id: str, updates: dict) -> Optional[Collection]:
        db = get_database()
        if "permission" in updates and isinstance(updates["permission"], CollectionPermission):
            updates["permission"] = updates["permission"].value

        updated_doc = await db.get_collection("collections").find_one_and_update(
            {"_id": ObjectId(collection_id)},
            {"$set": updates},
            return_document=True
        )
        
        return Collection(**updated_doc) if updated_doc else None

    async def delete_collection(self, collection: Collection, user: User):
        db = get_database()
        delete_result = await db.get_collection("collections").delete_one({"_id": ObjectId(collection.id)})
        
        if delete_result.deleted_count == 0:
            print(f"Warning: Collection with id {collection.id} not found in MongoDB for deletion.")
        
        try:
            await chroma_service.delete_collection(collection.name)
            
            await training_history_service.record_action(
                user_id=str(user.id),
                username=user.username,
                collection_name=collection.name,
                action=TrainingAction.DELETE_COLLECTION,
                details={'deleted_by': user.username}
            )
        except Exception as e:
            print(f"Error deleting collection '{collection.name}' from ChromaDB: {e}")
            raise

    async def get_all_collections(self) -> List[Collection]:
        db = get_database()
        collections_cursor = db.get_collection("collections").find()
        all_collections = await collections_cursor.to_list(length=None)
        return [Collection(**c) for c in all_collections]

    async def get_collection_by_id(self, collection_id: str) -> Optional[Collection]:
        db = get_database()
        collection_doc = await db.get_collection("collections").find_one({"_id": ObjectId(collection_id)})
        return Collection(**collection_doc) if collection_doc else None

    def can_user_access_collection(self, user: User, collection: Collection) -> bool:
        if user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
            return True
        if collection.createdBy == user.username:
            return True
        return False

model_service = ModelService() 