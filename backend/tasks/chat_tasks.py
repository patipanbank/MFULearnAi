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
                    # Flatten list of dict segments returned by some models (e.g. Bedrock Claude)
                    text_parts = []
                    for part in chunk_payload:
                        if isinstance(part, str):
                            text_parts.append(part)
                        elif isinstance(part, dict):
                            # common keys: "text", "content", "value"
                            if "text" in part and isinstance(part["text"], str):
                                text_parts.append(part["text"])
                            elif "content" in part and isinstance(part["content"], str):
                                text_parts.append(part["content"])
                        else:
                            text_parts.append(str(part))
                    buffer.append("".join(text_parts))
                else:
                    buffer.append(str(chunk_payload))
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