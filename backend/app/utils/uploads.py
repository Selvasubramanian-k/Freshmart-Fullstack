import secrets
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
ALLOWED_IMAGES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_UPLOAD_BYTES = 2 * 1024 * 1024


async def save_image(file: UploadFile, max_bytes: int = MAX_UPLOAD_BYTES) -> str:
    """Save an uploaded JPG/PNG/WEBP under /uploads and return its public path."""
    ext = ALLOWED_IMAGES.get(file.content_type or "")
    if not ext:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only JPG, PNG or WEBP images are allowed")
    data = await file.read()
    if len(data) > max_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Image must be {max_bytes // (1024 * 1024)} MB or smaller")
    UPLOAD_DIR.mkdir(exist_ok=True)
    name = f"{secrets.token_hex(8)}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return f"/uploads/{name}"
