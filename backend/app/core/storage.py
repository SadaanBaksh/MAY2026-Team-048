import uuid
from typing import Literal
from urllib.parse import urlparse

import boto3
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

UploadKind = Literal["photo", "voice_note"]

_LIMITS: dict[UploadKind, dict] = {
    "photo": {
        "folder": "photos",
        "max_bytes": 10 * 1024 * 1024,
        "content_types": {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
        },
    },
    "voice_note": {
        "folder": "voice-notes",
        "max_bytes": 15 * 1024 * 1024,
        "content_types": {
            "audio/m4a": ".m4a",
            "audio/x-m4a": ".m4a",
            "audio/mp4": ".m4a",
            "audio/mpeg": ".mp3",
            "audio/aac": ".aac",
            "audio/webm": ".webm",
            "audio/ogg": ".ogg",
        },
    },
}

_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
    return _s3_client


def upload_to_s3(file: UploadFile, kind: UploadKind, uploader_id: str) -> str:
    rules = _LIMITS[kind]

    # Browsers can append codec parameters (e.g. "audio/webm;codecs=opus") to the blob's
    # content type, which wouldn't match the plain-mimetype allowlist below.
    content_type = (file.content_type or "").split(";")[0].strip()

    extension = rules["content_types"].get(content_type)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported content type for {kind}: {file.content_type}",
        )

    contents = file.file.read()
    if len(contents) > rules["max_bytes"]:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{kind} exceeds the {rules['max_bytes'] // (1024 * 1024)}MB limit",
        )

    # The uploader's id is baked into the key (not just a DB column) so that anything
    # holding only the URL - e.g. the AI analyzer - can verify ownership via
    # upload_belongs_to() without a DB round-trip.
    key = f"{rules['folder']}/{uploader_id}/{uuid.uuid4()}{extension}"

    _get_s3_client().put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=key,
        Body=contents,
        ContentType=content_type,
    )

    return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"


def upload_belongs_to(url: str, user_id: str) -> bool:
    """Check the {folder}/{uploader_id}/{filename} convention upload_to_s3() writes.
    Anything that doesn't match - a foreign URL, a pre-existing upload from before this
    check existed, a malformed value - is treated as not owned, which is the safe default."""
    parts = urlparse(url).path.lstrip("/").split("/")
    return len(parts) == 3 and parts[1] == user_id
