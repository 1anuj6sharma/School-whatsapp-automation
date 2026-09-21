from datetime import datetime
from fastapi import APIRouter
from app.config import settings
from app.database import get_db_status_info

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check():
    db_info = await get_db_status_info()
    token = (settings.WHATSAPP_ACCESS_TOKEN or "").strip()
    masked_token = f"{token[:12]}...{token[-6:]}" if len(token) > 18 else ("••••••••" if token else "Not Configured")
    return {
        "status": "ok" if db_info["status"] == "connected" else "degraded",
        "service": "school-whatsapp-automation",
        "timestamp": datetime.utcnow().isoformat(),
        "database": f"{db_info.get('dialect', 'Database')} ({db_info.get('status', 'unknown')})",
        "db_dialect": db_info.get("dialect", "SQL Database"),
        "db_status": db_info.get("status", "unknown"),
        "whatsapp": {
            "phone_number_id": settings.WHATSAPP_PHONE_NUMBER_ID,
            "business_account_id": settings.WHATSAPP_BUSINESS_ACCOUNT_ID,
            "api_version": settings.WHATSAPP_API_VERSION,
            "verify_token": settings.WHATSAPP_VERIFY_TOKEN,
            "access_token": token,
            "access_token_masked": masked_token,
            "max_concurrency": settings.WHATSAPP_MAX_CONCURRENCY,
            "webhook_endpoint": "/webhooks/whatsapp"
        }
    }
