import asyncio
import json
import os
from utils.websocket_manager import ws_manager

import aioredis  # type: ignore

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

async def pubsub_listener():
    """Subscribe to chat:* channels and forward messages to websockets."""
    redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis.pubsub()
    await pubsub.psubscribe("chat:*")

    async for message in pubsub.listen():
        if message is None:
            continue
        if message["type"] not in ("pmessage", "message"):
            continue
        channel = message["channel"]  # pattern chat:<session_id>
        data = message["data"]
        try:
            # extract session_id
            if isinstance(channel, bytes):
                channel = channel.decode()
            session_id = channel.split(":", 1)[1]
            await ws_manager.broadcast(session_id, data)
        except Exception as e:
            print(f"Redis listener error: {e}") 