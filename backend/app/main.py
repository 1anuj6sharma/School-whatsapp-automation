from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import init_db
from app.seed import seed_database
from app.utils.logger import logger
from app.routers import (
    health_router,
    classes_router,
    students_router,
    templates_router,
    campaigns_router,
    message_logs_router,
    messages_router,
    webhooks_router,
    whatsapp_auth_router
)

from app.services.campaign_service import campaign_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing School WhatsApp Automation Backend...")
    try:
        await init_db()
        await seed_database()
        await campaign_service.cleanup_stale_campaigns()
        logger.info("Database initialized, auto-seeded, and stale tasks recovered successfully.")
    except Exception as ex:
        logger.error(f"Failed to initialize database on startup: {str(ex)}")
    yield
    logger.info("Shutting down School WhatsApp Automation Backend...")

app = FastAPI(
    title="School WhatsApp Automation API",
    description="Production-grade School WhatsApp Broadcast & Automated Messaging Engine",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(health_router)
app.include_router(classes_router)
app.include_router(students_router)
app.include_router(templates_router)
app.include_router(campaigns_router)
app.include_router(message_logs_router)
app.include_router(messages_router)
app.include_router(webhooks_router)
app.include_router(whatsapp_auth_router)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error at {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please check server logs."}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=3010, reload=True)
