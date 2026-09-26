from app.routers.health import router as health_router
from app.routers.classes import router as classes_router
from app.routers.students import router as students_router
from app.routers.templates import router as templates_router
from app.routers.campaigns import router as campaigns_router
from app.routers.message_logs import router as message_logs_router
from app.routers.messages import router as messages_router
from app.routers.webhooks import router as webhooks_router
from app.routers.media import router as media_router
from app.routers.auth import router as auth_router

__all__ = [
    "health_router",
    "classes_router",
    "students_router",
    "templates_router",
    "campaigns_router",
    "message_logs_router",
    "messages_router",
    "webhooks_router",
    "media_router",
    "auth_router",
]

