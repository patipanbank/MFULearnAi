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
                formatted_chunk = None
                
                # ปรับปรุงการประมวลผล chunk_payload ที่มาจาก LangChain
                try:
                    # กรณีเป็น list
                    if isinstance(chunk_payload, list):
                        text_parts = []
                        for part in chunk_payload:
                            if isinstance(part, str):
                                text_parts.append(part)
                            elif isinstance(part, dict):
                                for key in ("text", "content", "value"):
                                    if key in part and isinstance(part[key], str):
                                        text_parts.append(part[key])
                                        break
                            else:
                                # สร้างข้อความที่อ่านได้แทนการใช้ str(part) โดยตรง
                                try:
                                    text_parts.append(str(part))
                                except:
                                    text_parts.append("[Complex data]")
                        formatted_chunk = "".join(text_parts)
                        
                    # กรณีเป็น dict
                    elif isinstance(chunk_payload, dict):
                        if "output" in chunk_payload and isinstance(chunk_payload["output"], list):
                            # กรณีพิเศษสำหรับการตอบกลับที่มีโครงสร้างซับซ้อน (เช่นที่คุณเห็น)
                            outputs = []
                            for item in chunk_payload["output"]:
                                if isinstance(item, dict) and "text" in item:
                                    outputs.append(item["text"])
                            formatted_chunk = " ".join(outputs)
                        else:
                            # กรณี dict ปกติ
                            extracted = None
                            for key in ("text", "content", "value"):
                                if key in chunk_payload and isinstance(chunk_payload[key], str):
                                    extracted = chunk_payload[key]
                                    break
                            if extracted is None:
                                # แทนที่จะใช้ str(chunk_payload) ซึ่งอาจสร้างข้อมูล JSON ที่ไม่มีประโยชน์
                                # พยายามดึงข้อความที่อ่านได้
                                if "output" in chunk_payload:
                                    extracted = str(chunk_payload["output"])
                                else:
                                    extracted = "AI is processing..."
                            formatted_chunk = extracted
                    
                    # กรณีอื่นๆ
                    else:
                        # พยายามแปลงเป็นข้อความที่มีความหมาย
                        chunk_str = str(chunk_payload)
                        # ตรวจสอบข้อความว่าเป็น JSON object หรือไม่
                        if chunk_str.startswith('{') and chunk_str.endswith('}'):
                            try:
                                parsed = json.loads(chunk_str)
                                if "text" in parsed:
                                    formatted_chunk = parsed["text"]
                                elif "content" in parsed:
                                    formatted_chunk = parsed["content"]
                                elif "output" in parsed:
                                    if isinstance(parsed["output"], list) and len(parsed["output"]) > 0:
                                        formatted_chunk = " ".join([str(item) for item in parsed["output"]])
                                    else:
                                        formatted_chunk = str(parsed["output"])
                                else:
                                    formatted_chunk = chunk_str
                            except:
                                formatted_chunk = chunk_str
                        else:
                            formatted_chunk = chunk_str
                            
                    # ถ้ายังไม่มีค่า formatted_chunk ให้ใช้ค่า default
                    if formatted_chunk is None:
                        formatted_chunk = "AI is generating response..."
                        
                    buffer.append(formatted_chunk)
                    
                    # publish to redis แบบที่มีการประมวลผลแล้ว
                    try:
                        import os, redis  # type: ignore
                        redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
                        redis_client.publish(f"chat:{session_id}", json.dumps({"type": "chunk", "data": formatted_chunk}))
                    except Exception as pub_err:
                        print(f"Redis publish error: {pub_err}")
                        
                except Exception as format_err:
                    print(f"Error formatting chunk: {format_err}")
                    # หากเกิดข้อผิดพลาดในการ format ให้ส่งข้อความว่ากำลังประมวลผลแทน
                    buffer.append("Processing...")
                    try:
                        import os, redis  # type: ignore
                        redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
                        redis_client.publish(f"chat:{session_id}", json.dumps({"type": "chunk", "data": "Processing..."}))
                    except Exception as pub_err:
                        print(f"Redis publish error: {pub_err}")

            elif data["type"] == "end":
                # สรุปข้อความทั้งหมดเป็นข้อความเดียว
                final_text = "".join(buffer)
                
                # ตรวจสอบว่า final_text อาจจะเป็น JSON string แบบซับซ้อนหรือไม่
                if final_text.startswith('{') and final_text.endswith('}'):
                    try:
                        parsed = json.loads(final_text)
                        if isinstance(parsed, dict):
                            if 'output' in parsed and isinstance(parsed['output'], list):
                                if all(isinstance(item, dict) and 'text' in item for item in parsed['output']):
                                    # กรณีพิเศษเหมือนตัวอย่างที่คุณเจอ
                                    texts = [item.get('text', '') for item in parsed['output']]
                                    final_text = ' '.join(texts)
                    except:
                        # ถ้าแปลงไม่ได้ ก็ใช้ข้อความเดิม
                        pass
                
                # บันทึกข้อความลงฐานข้อมูล
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
                    redis_client.publish(f"chat:{session_id}", json.dumps({"type": "end"}))
                except Exception as pub_err:
                    print(f"Redis publish error: {pub_err}")

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