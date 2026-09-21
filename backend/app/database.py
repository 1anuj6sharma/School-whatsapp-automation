from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.config import settings
from app.utils.logger import logger

class Base(DeclarativeBase):
    pass

def get_normalized_db_url(raw_url):
    from sqlalchemy.engine import URL
    if isinstance(raw_url, URL):
        return raw_url

    url = str(raw_url).strip() if raw_url else ""
    if not url:
        return "sqlite+aiosqlite:///./school_whatsapp.db"

    # Convert common sync prefixes to their async driver equivalents if needed
    if url.startswith("mssql://") or url.startswith("mssql+pyodbc://"):
        url = url.replace("mssql://", "mssql+aioodbc://", 1).replace("mssql+pyodbc://", "mssql+aioodbc://", 1)
    elif url.startswith("postgresql://") or url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1).replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("mysql://"):
        url = url.replace("mysql://", "mysql+aiomysql://", 1)
    elif url.startswith("sqlite://") and not url.startswith("sqlite+aiosqlite://"):
        url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)

    return url

def create_engine_with_fallback(primary_url):
    url_str = str(primary_url)
    connect_args = {"check_same_thread": False} if "sqlite" in url_str else {}
    try:
        eng = create_async_engine(primary_url, echo=False, future=True, connect_args=connect_args)
        logger.info(f"[Database] Engine initialized with target: {url_str.split('@')[-1] if '@' in url_str else url_str}")
        return eng, primary_url
    except Exception as ex:
        logger.warning(f"[Database] Primary engine creation failed for {url_str}: {ex}")
        # Fallback to local SQLite if absolutely necessary
        fallback_url = "sqlite+aiosqlite:///./school_whatsapp.db"
        eng = create_async_engine(fallback_url, echo=False, future=True, connect_args={"check_same_thread": False})
        return eng, fallback_url

db_url = get_normalized_db_url(settings.get_database_url())
engine, db_url = create_engine_with_fallback(db_url)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

_tables_initialized = False

def _import_all_models():
    """Explicitly imports all ORM models so Base.metadata is fully populated."""
    from app.models.class_model import Class
    from app.models.student import Student
    from app.models.template import MessageTemplate
    from app.models.campaign import MessageCampaign
    from app.models.message_log import MessageLog
    return [Class, Student, MessageTemplate, MessageCampaign, MessageLog]

async def _ensure_database_exists():
    db_type = (settings.DB_TYPE or "").lower().strip()
    if db_type == "mssql":
        import os
        from pathlib import Path
        from sqlalchemy.engine import URL

        db_name = settings.DB_NAME.strip() if settings.DB_NAME else "SchoolWhatsAppDB"
        safe_db_name = "".join(c for c in db_name if c.isalnum() or c in ("_", "-"))
        if not safe_db_name:
            safe_db_name = "SchoolWhatsAppDB"

        host = (settings.DB_HOST or "localhost").strip()
        is_container = os.path.exists("/.dockerenv") or Path("/app").is_dir() or bool(os.environ.get("RUNNING_IN_DOCKER"))
        if is_container and host in ("localhost", "127.0.0.1"):
            host = "host.docker.internal"

        master_url = URL.create(
            drivername="mssql+aioodbc",
            username=settings.DB_USER.strip() if settings.DB_USER else None,
            password=settings.DB_PASSWORD if settings.DB_PASSWORD else None,
            host=host,
            port=settings.DB_PORT or 1433,
            database="master",
            query={
                "driver": settings.resolve_odbc_driver(),
                "TrustServerCertificate": "yes"
            }
        )
        try:
            master_engine = create_async_engine(master_url, echo=False, isolation_level="AUTOCOMMIT")
            async with master_engine.connect() as conn:
                check_and_create = text(
                    f"IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'{safe_db_name}') "
                    f"BEGIN CREATE DATABASE [{safe_db_name}]; END"
                )
                await conn.execute(check_and_create)
                logger.info(f"[Database] Confirmed SQL Server database [{safe_db_name}] exists.")
            await master_engine.dispose()
        except Exception as e:
            logger.info(f"[Database] Notice on master check for [{safe_db_name}]: {e}")

async def init_db():
    """
    Automatically creates the database (if missing) and all missing tables in the configured database
    (SQL Server, PostgreSQL, SQLite, MySQL) if they do not exist.
    """
    global engine, AsyncSessionLocal, _tables_initialized
    try:
        await _ensure_database_exists()
        _import_all_models()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            _tables_initialized = True
            logger.info("[Database] All tables checked/created in SchoolWhatsAppDB successfully.")
    except Exception as ex:
        logger.warning(f"[Database] Table creation error on configured engine ({ex}). Falling back to persistent local SQLite.")
        db_url_fallback = settings.get_database_url()
        if not str(db_url_fallback).startswith("sqlite"):
            db_url_fallback = "sqlite+aiosqlite:///./data/school_whatsapp.db"
        engine = create_async_engine(
            db_url_fallback,
            echo=False,
            future=True,
            connect_args={"check_same_thread": False}
        )
        AsyncSessionLocal = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False
        )
        _import_all_models()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            _tables_initialized = True
            logger.info("[Database] Fallback SQLite tables created successfully.")

async def get_db():
    """
    FastAPI dependency yielding an async database session.
    Guarantees that tables exist before running queries or inserts.
    """
    global _tables_initialized
    if not _tables_initialized:
        await init_db()

    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_db_status_info() -> dict:
    dialect_name = engine.dialect.name.upper()
    if "MSSQL" in dialect_name:
        friendly_name = "Microsoft SQL Server"
    elif "POSTGRES" in dialect_name:
        friendly_name = "PostgreSQL"
    elif "MYSQL" in dialect_name:
        friendly_name = "MySQL"
    elif "SQLITE" in dialect_name:
        friendly_name = "SQLite (Local DB)"
    else:
        friendly_name = dialect_name

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {
            "status": "connected",
            "dialect": friendly_name,
            "engine": engine.dialect.name
        }
    except Exception as ex:
        return {
            "status": "error",
            "dialect": friendly_name,
            "error": str(ex)
        }
