from __future__ import annotations

"""Celery application instance for MFULearnAI backend.

Usage:
$ celery -A celery_app.celery worker -l info -Q chat

Broker & backend both point at REDIS_URL (env already set in docker-compose).
"""

import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery = Celery("mfu_chatbot", broker=REDIS_URL, backend=REDIS_URL)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    result_expires=3600,
)

# Discover task modules inside backend.tasks package
celery.autodiscover_tasks(["backend.tasks"]) 