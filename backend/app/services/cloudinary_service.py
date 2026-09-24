"""Cloudinary upload helpers."""
from __future__ import annotations

import asyncio
import uuid

import cloudinary
import cloudinary.uploader

from app.config import settings


async def upload_school_logo(content: bytes, school_id: uuid.UUID) -> str:
    """Upload a validated school logo and return its HTTPS URL."""
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    result = await asyncio.to_thread(
        cloudinary.uploader.upload,
        content,
        public_id=f"edumagng/schools/{school_id}/logo",
        overwrite=True,
        resource_type="image",
        invalidate=True,
    )
    secure_url = result.get("secure_url")
    if not secure_url:
        raise RuntimeError("Cloudinary did not return an upload URL")
    return str(secure_url)
