from lib.mongodb import get_database
from models.training_history import TrainingHistory, TrainingAction
from datetime import datetime
from typing import Optional, Dict, Any

class TrainingHistoryService:
    async def record_action(self, user_id: str, username: str, collection_name: str, action: TrainingAction, details: Optional[Dict[str, Any]] = None, document_name: Optional[str] = None):
        db = get_database()
        
        # Create a dictionary with the required fields
        history_data = {
            "userId": user_id,
            "username": username,
            "collectionName": collection_name,
            "action": action,
        }
        # Add optional fields only if they are not None
        if document_name:
            history_data["documentName"] = document_name
        if details:
            history_data["details"] = details

        # Let Pydantic handle the defaults for id and timestamp
        history_entry = TrainingHistory(**history_data)
        
        await db.get_collection("training_history").insert_one(history_entry.model_dump(by_alias=True))

    async def get_history_by_collection(self, collection_name: str, limit: int = 100):
        db = get_database()
        history_cursor = db.get_collection("training_history").find(
            {"collectionName": collection_name}
        ).sort("timestamp", -1).limit(limit)
        return [TrainingHistory(**item) async for item in history_cursor]
        
    async def get_history_by_user(self, user_id: str, limit: int = 100):
        db = get_database()
        history_cursor = db.get_collection("training_history").find(
            {"userId": user_id}
        ).sort("timestamp", -1).limit(limit)
        return [TrainingHistory(**item) async for item in history_cursor]

training_history_service = TrainingHistoryService() 