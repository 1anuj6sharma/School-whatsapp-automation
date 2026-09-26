import os
import uuid
import aiofiles
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Request
from app.utils.logger import logger

router = APIRouter(prefix="/api/media", tags=["Media"])

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

@router.post("/upload")
async def upload_media(request: Request, file: UploadFile = File(...)):
    """
    Uploads an image file (.jpg, .png, .webp) up to 5MB and returns its accessible URL.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of 5MB."
        )

    unique_filename = f"{uuid.uuid4().hex}{ext}"
    target_path = UPLOAD_DIR / unique_filename

    async with aiofiles.open(target_path, "wb") as f:
        await f.write(content)

    logger.info(f"[MediaRouter] Uploaded media saved: {target_path} ({len(content)} bytes)")

    # Build relative and absolute URL
    base_url = str(request.base_url).rstrip("/")
    file_url = f"{base_url}/uploads/{unique_filename}"

    return {
        "success": True,
        "filename": unique_filename,
        "url": file_url,
        "relative_url": f"/uploads/{unique_filename}",
        "size_bytes": len(content)
    }
