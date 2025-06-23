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

        async for chunk in chat_service.chat(**payload):
            data = None
            try:
                import json

                data = json.loads(chunk)
            except Exception:
                continue

            if data["type"] == "chunk":
                buffer.append(data["data"])
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

    asyncio.run(_run()) 