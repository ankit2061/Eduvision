"""
DigitalOcean Spaces (S3-compatible) helper for audio file storage.
"""

import io
import uuid
import boto3
from botocore.client import Config as BotoConfig
from loguru import logger
from app.config import get_settings

settings = get_settings()


def _get_client():
    return boto3.client(
        "s3",
        region_name=settings.do_spaces_region,
        endpoint_url=settings.do_spaces_endpoint,
        aws_access_key_id=settings.do_spaces_key,
        aws_secret_access_key=settings.do_spaces_secret,
        config=BotoConfig(signature_version="s3v4"),
    )


def upload_audio(
    audio_bytes: bytes,
    prefix: str = "audio",
    content_type: str = "audio/mpeg",
    filename: str | None = None,
) -> str:
    """
    Upload audio bytes to DO Spaces. Returns the public (or presigned) URL.
    """
    client = _get_client()
    key = f"{prefix}/{filename or str(uuid.uuid4())}.mp3"

    client.put_object(
        Bucket=settings.do_spaces_bucket,
        Key=key,
        Body=io.BytesIO(audio_bytes),
        ContentType=content_type,
        ACL="public-read",
    )
    url = f"{settings.do_spaces_endpoint}/{settings.do_spaces_bucket}/{key}"
    logger.info(f"[DO Spaces] Uploaded: {url}")
    return url


def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a time-limited presigned URL for private objects."""
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.do_spaces_bucket, "Key": key},
        ExpiresIn=expires_in,
    )
