from datetime import datetime
from lib.mongodb import get_database
from models.chat import Chat, ChatMessage
from bson import ObjectId
from typing import List, Optional

class ChatHistoryService:
    async def get_chat_history_for_user(self, user_id: str) -> List[Chat]:
        db = get_database()
        chats_cursor = db.get_collection("chats").find({"userId": user_id}).sort("createdAt", -1)
        return [Chat(**chat) async for chat in chats_cursor]

    async def get_chat_by_id(self, chat_id: str) -> Optional[Chat]:
        db = get_database()
        chat = await db.get_collection("chats").find_one({"_id": ObjectId(chat_id)})
        return Chat(**chat) if chat else None

    async def create_chat(self, user_id: str, name: str, model_id: str) -> Chat:
        db = get_database()
        chat = Chat(
            _id=None,
            userId=user_id,
            name=name,
            modelId=model_id,
            messages=[]
        )
        result = await db.get_collection("chats").insert_one(chat.model_dump(by_alias=True))
        chat.id = str(result.inserted_id)
        return chat

    async def add_message_to_chat(self, chat_id: str, message: ChatMessage) -> Optional[Chat]:
        db = get_database()
        result = await db.get_collection("chats").find_one_and_update(
            {"_id": ObjectId(chat_id)},
            {"$push": {"messages": message.model_dump()}, "$set": {"updatedAt": datetime.utcnow()}},
            return_document=True
        )
        return Chat(**result) if result else None
        
    async def delete_chat(self, chat_id: str) -> bool:
        db = get_database()
        result = await db.get_collection("chats").delete_one({"_id": ObjectId(chat_id)})
        return result.deleted_count > 0

chat_history_service = ChatHistoryService() 