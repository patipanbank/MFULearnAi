from __future__ import annotations

"""Storage service for uploading files to S3-compatible object storage (MinIO).

Usage:
    url = await storage_service.upload_file(file_bytes, filename, content_type)
"""

import os
import uuid
from typing import Final

import boto3
from botocore.client import Config
from boto3.session import Session as _BotoSession

# Load config from env
_S3_ENDPOINT: Final[str] = os.getenv("S3_ENDPOINT", "http://minio:9000")
_S3_ACCESS_KEY: Final[str] = os.getenv("S3_ACCESS_KEY", "minioadmin")
_S3_SECRET_KEY: Final[str] = os.getenv("S3_SECRET_KEY", "minioadmin123")
_S3_REGION: Final[str] = os.getenv("S3_REGION", "us-east-1")
_S3_BUCKET: Final[str] = os.getenv("S3_BUCKET", "uploads")
_PUBLIC_ENDPOINT: Final[str] = os.getenv("S3_PUBLIC_ENDPOINT", _S3_ENDPOINT)

_session = _BotoSession()
_s3 = _session.client(
    "s3",
    endpoint_url=_S3_ENDPOINT,
    aws_access_key_id=_S3_ACCESS_KEY,
    aws_secret_access_key=_S3_SECRET_KEY,
    region_name=_S3_REGION,
    config=Config(signature_version="s3v4"),
)


class StorageService:
    async def upload_file(self, data: bytes, filename: str, content_type: str) -> str:
        """Upload bytes to bucket and return public URL."""
        key = f"{uuid.uuid4().hex}/{filename}"
        _s3.put_object(Bucket=_S3_BUCKET, Key=key, Body=data, ContentType=content_type)
        return f"{_PUBLIC_ENDPOINT}/{_S3_BUCKET}/{key}"


storage_service = StorageService() 