from __future__ import annotations

import asyncio
from datetime import datetime
from bson import ObjectId
from typing import Dict, Any, List

from celery_app import celery
from services.chat_service import chat_service
from services.chat_history_service import chat_history_service
from models.chat import ChatMessage


@celery.task(name="generate_answer")
def generate_answer(payload: Dict[str, Any]):
    """Background task: call chat_service.chat (async generator) and persist output.

    Expected payload keys: session_id, user_id, message, model_id,
    collection_names, images, system_prompt, temperature, max_tokens, agent_id (optional)
    """
    session_id: str = payload["session_id"]
    print(f"🎯 Celery task started for session {session_id}")
    print(f"📝 Message: {payload.get('message', 'No message')}")
    print(f"🤖 Agent ID: {payload.get('agent_id', 'No agent')}")
    print(f"🔧 Model ID: {payload.get('model_id', 'No model')}")

    # helper to run async generator inside sync Celery task
    async def _run() -> None:
        buffer: List[str] = []
        assistant_id = str(ObjectId())

        async for chunk in chat_service.chat(**{k: v for k, v in payload.items() if k != 'agent_id'}):
            data = None
            try:
                import json

                data = json.loads(chunk)
            except Exception:
                continue

            if data["type"] == "chunk":
                chunk_payload = data["data"]

                # Normalize chunk_payload to string to avoid join errors
                if isinstance(chunk_payload, list):
                    # Flatten list of dict or message segments returned by some models
                    text_parts = []
                    for part in chunk_payload:
                        if isinstance(part, str):
                            text_parts.append(part)
                        elif isinstance(part, dict):
                            # Extract common keys
                            for key in ("text", "content", "value"):
                                if key in part and isinstance(part[key], str):
                                    text_parts.append(part[key])
                                    break
                        else:
                            # Fallback to string representation
                            text_parts.append(str(part))
                    chunk_text = "".join(text_parts)
                    buffer.append(chunk_text)

                elif isinstance(chunk_payload, dict):
                    # Handle single dict payload
                    extracted = None
                    for key in ("text", "content", "value"):
                        if key in chunk_payload and isinstance(chunk_payload[key], str):
                            extracted = chunk_payload[key]
                            break
                    if extracted is None:
                        extracted = str(chunk_payload)
                    buffer.append(extracted)

                else:
                    buffer.append(str(chunk_payload))

                # publish to redis for streaming
                try:
                    import os, redis, json  # type: ignore
                    redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
                    message = json.dumps({"type": "chunk", "data": buffer[-1]})
                    redis_client.publish(f"chat:{session_id}", message)
                    print(f"📤 Published chunk to Redis: chat:{session_id}")
                except Exception as pub_err:
                    print(f"❌ Redis publish error: {pub_err}")
            elif data["type"] == "end":
                final_text = "".join(buffer)
                await chat_history_service.add_message_to_chat(
                    session_id,
                    ChatMessage(
                        id=assistant_id,
                        role="assistant",
                        content=final_text,
                        timestamp=datetime.utcnow(),
                        isStreaming=False,
                        isComplete=True,
                    ),
                )

                # publish end event
                try:
                    import os, redis, json  # type: ignore
                    redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
                    message = json.dumps({"type": "end"})
                    redis_client.publish(f"chat:{session_id}", message)
                    print(f"🏁 Published end event to Redis: chat:{session_id}")
                except Exception as pub_err:
                    print(f"❌ Redis publish error: {pub_err}")

    # รัน coroutine บน event loop เดียวกับที่ Mongo เชื่อมอยู่เพื่อหลีกเลี่ยงปัญหา "attached to a different loop"
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        # ถ้า loop กำลังรันอยู่ (ไม่น่าเกิดใน Celery prefork) ให้สร้าง task แล้วรอ
        fut = asyncio.run_coroutine_threadsafe(_run(), loop)
        fut.result()
    else:
        loop.run_until_complete(_run()) 