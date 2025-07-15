from datetime import datetime, time, timezone
from lib.mongodb import get_database
from models.user_usage import UserUsage
from bson import ObjectId

class UsageService:
    async def get_usage_by_user(self, user_id: str):
        db = get_database()
        return await db.get_collection("user_usage").find_one({"_id": ObjectId(user_id)})

    async def update_usage(self, user_id: str, tokens_used: int, a_tokens_used: int):
        db = get_database()
        usage_collection = db.get_collection("user_usage")
        
        # Atomically find and update the document, or create if it doesn't exist
        result = await usage_collection.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {
                "$inc": {
                    "tokens_used": tokens_used,
                    "a_tokens_used": a_tokens_used
                },
                "$setOnInsert": {
                    "last_updated": datetime.utcnow()
                }
            },
            upsert=True,
            return_document=True # Use `True` for pymongo's ReturnDocument.AFTER
        )
        return result

usage_service = UsageService() 