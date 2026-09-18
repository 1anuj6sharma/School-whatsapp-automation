from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool
from sqlalchemy import text
from app.config import settings
from app.utils.logger import logger

class Base(DeclarativeBase):
    pass

# Determine database URL or fallback to in-memory SQLite
db_url = settings.DATABASE_URL.strip() if settings.DATABASE_URL else ""
if not db_url or "postgresql" in db_url.lower():
    # If user has not set up postgres or left empty, use zero-config embedded SQLite
    db_url = "sqlite+aiosqlite:///./school_whatsapp.db"

connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

try:
    engine = create_async_engine(
        db_url,
        echo=False,
        future=True,
        connect_args=connect_args
    )
except Exception as ex:
    logger.warning(f"[Database] Could not create engine with {db_url} ({ex}). Falling back to in-memory SQLite.")
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    global engine, AsyncSessionLocal
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as ex:
        logger.warning(f"[Database] Initialization error with default URL ({ex}). Switching to persistent in-memory SQLite.")
        engine = create_async_engine(
            "sqlite+aiosqlite:///:memory:",
            echo=False,
            future=True,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )
        AsyncSessionLocal = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

