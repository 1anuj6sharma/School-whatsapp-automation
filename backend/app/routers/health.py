from datetime import datetime
from fastapi import APIRouter
from app.database import get_db_status_info

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check():
    db_info = await get_db_status_info()
    return {
        "status": "ok" if db_info["status"] == "connected" else "degraded",
        "service": "school-whatsapp-automation",
        "timestamp": datetime.utcnow().isoformat(),
        "database": f"{db_info.get('dialect', 'Database')} ({db_info.get('status', 'unknown')})",
        "db_dialect": db_info.get("dialect", "SQL Database"),
        "db_status": db_info.get("status", "unknown")
    }
