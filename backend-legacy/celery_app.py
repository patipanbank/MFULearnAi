from __future__ import annotations

"""Celery application instance for MFULearnAI backend.

Usage:
$ celery -A celery_app.celery worker -l info -Q chat

Broker & backend both point at REDIS_URL (env already set in docker-compose).
"""

import os
from celery import Celery  # type: ignore
from celery.signals import worker_process_init  # type: ignore

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery = Celery("mfu_chatbot", broker=REDIS_URL, backend=REDIS_URL)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    result_expires=3600,
)

# Import tasks module explicitly so Celery registers them
from tasks import chat_tasks  # noqa: F401

# Discover task modules in local tasks package
# celery.autodiscover_tasks(["tasks"])

# เชื่อมต่อ MongoDB ทุกครั้งที่ child-process ของ Celery ถูกสร้างขึ้น
@worker_process_init.connect
def init_mongo_connection(**_):
    """Ensure Mongo connection is ready inside each Celery worker process."""
    import asyncio
    from lib.mongodb import connect_to_mongo

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    # หาก event loop กำลังรันไม่ได้ให้ใช้ run_until_complete
    if loop.is_running():
        # กรณีใช้ event loop ที่รันอยู่ (unlikely ใน worker)
        loop.create_task(connect_to_mongo())
    else:
        loop.run_until_complete(connect_to_mongo()) 