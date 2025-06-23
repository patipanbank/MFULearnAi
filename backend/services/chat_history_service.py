from datetime import datetime
from lib.mongodb import get_database
from models.chat import Chat, ChatMessage
from bson import ObjectId
from typing import List, Optional

class ChatHistoryService:
    async def get_chat_history_for_user(self, user_id: str) -> List[Chat]:
        db = get_database()
        chats_cursor = db.get_collection("chats").find({"userId": user_id}).sort("createdAt", -1)
        chats = []
        async for chat in chats_cursor:
            # Handle backward compatibility
            if "_id" in chat:
                chat["_id"] = str(chat["_id"])
            chats.append(Chat(**chat))
        return chats

    async def get_chat_by_id(self, chat_id: str) -> Optional[Chat]:
        db = get_database()
        chat = await db.get_collection("chats").find_one({"_id": ObjectId(chat_id)})
        if chat:
            # Handle backward compatibility
            if "_id" in chat:
                chat["_id"] = str(chat["_id"])
            return Chat(**chat)
        return None

    async def create_chat(self, user_id: str, name: str, agent_id: Optional[str] = None, model_id: Optional[str] = None) -> Chat:
        """Create a new chat with agent_id (preferred) or model_id (legacy)"""
        db = get_database()
        
        chat_data = {
            "userId": user_id,
            "name": name,
            "messages": [],
            "isPinned": False,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        # Prefer agent_id over model_id
        if agent_id:
            chat_data["agentId"] = agent_id
        elif model_id:
            chat_data["modelId"] = model_id
        
        result = await db.get_collection("chats").insert_one(chat_data)
        
        # Create Chat object
        chat_data["_id"] = str(result.inserted_id)
        return Chat(**chat_data)

    async def create_chat_legacy(self, user_id: str, name: str, model_id: str) -> Chat:
        """Legacy method for backward compatibility"""
        return await self.create_chat(user_id, name, model_id=model_id)

    async def add_message_to_chat(self, chat_id: str, message: ChatMessage) -> Optional[Chat]:
        db = get_database()
        result = await db.get_collection("chats").find_one_and_update(
            {"_id": ObjectId(chat_id)},
            {
                "$push": {"messages": message.model_dump()}, 
                "$set": {"updatedAt": datetime.utcnow()}
            },
            return_document=True
        )
        if result and "_id" in result:
            result["_id"] = str(result["_id"])
            return Chat(**result)
        return None
        
    async def delete_chat(self, chat_id: str) -> bool:
        db = get_database()
        result = await db.get_collection("chats").delete_one({"_id": ObjectId(chat_id)})
        return result.deleted_count > 0

    async def update_chat_agent(self, chat_id: str, agent_id: str) -> Optional[Chat]:
        """Update chat to use new agent_id and remove legacy modelId"""
        db = get_database()
        result = await db.get_collection("chats").find_one_and_update(
            {"_id": ObjectId(chat_id)},
            {
                "$set": {
                    "agentId": agent_id,
                    "updatedAt": datetime.utcnow()
                },
                "$unset": {"modelId": "", "collectionNames": ""}
            },
            return_document=True
        )
        if result and "_id" in result:
            result["_id"] = str(result["_id"])
            return Chat(**result)
        return None

chat_history_service = ChatHistoryService() 