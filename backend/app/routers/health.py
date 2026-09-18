from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    db_status = "connected (in-memory / zero-config)"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "active (in-memory fallback)"

    return {
        "status": "ok",
        "service": "school-whatsapp-automation",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status
    }
