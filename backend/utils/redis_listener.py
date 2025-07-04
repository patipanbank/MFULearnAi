import asyncio
import json
import os
from utils.websocket_manager import ws_manager
from utils.redis_memory_manager import memory_manager

import redis.asyncio as aioredis  # type: ignore

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

def clear_chat_memory(session_id: str, user_id: str | None = None) -> bool:
    """Clear Redis memory for a specific chat session"""
    try:
        import redis
        redis_client = redis.Redis.from_url(REDIS_URL)
        
        if user_id:
            # Clear specific user session
            pattern = f"*user_{user_id}_session_{session_id}*"
        else:
            # Clear all sessions with this ID
            pattern = f"*session_{session_id}*"
            
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
            print(f"🧹 Cleared Redis memory: {len(keys)} keys for session {session_id}")
            return True
        return False
    except Exception as e:
        print(f"❌ Failed to clear Redis memory: {e}")
        return False

async def pubsub_listener():
    """Subscribe to mfu:chat:pubsub:* channels and forward messages to websockets."""
    redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis.pubsub()
    
    # Use the same pattern as memory manager
    pattern = f"{memory_manager.PUBSUB_PREFIX}:*"
    await pubsub.psubscribe(pattern)
    print(f"🔍 Redis listener subscribed to pattern: {pattern}")

    async for message in pubsub.listen():
        if message is None:
            continue
        if message["type"] not in ("pmessage", "message"):
            continue
        channel = message["channel"]  # pattern mfu:chat:pubsub:<session_id>
        data = message["data"]
        try:
            # extract session_id from mfu:chat:pubsub:<session_id>
            if isinstance(channel, bytes):
                channel = channel.decode()
            session_id = channel.split(":", 3)[3]  # Get the session_id part
            print(f"📨 Redis listener received message for session {session_id}: {data[:100]}...")
            await ws_manager.broadcast(session_id, data)
        except Exception as e:
            print(f"❌ Redis listener error: {e}") 