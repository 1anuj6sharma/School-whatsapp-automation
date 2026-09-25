import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Search for .env in current working dir, parent dir, or app root
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

env_files = []
if (BASE_DIR / ".env").exists():
    env_files.append(str(BASE_DIR / ".env"))
if (ROOT_DIR / ".env").exists():
    env_files.append(str(ROOT_DIR / ".env"))

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=tuple(env_files) if env_files else (".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Meta WhatsApp Cloud API Settings
    WHATSAPP_PHONE_NUMBER_ID: str = Field(default="", description="WhatsApp Cloud API Phone Number ID")
    WHATSAPP_BUSINESS_ACCOUNT_ID: str = Field(default="", description="WhatsApp Business Account ID (WABA ID)")
    WHATSAPP_ACCESS_TOKEN: str = Field(default="", description="Meta User/System Access Token")
    WHATSAPP_API_VERSION: str = Field(default="v26.0", description="Meta Graph API Version")
    WHATSAPP_VERIFY_TOKEN: str = Field(default="school_whatsapp_verify_token_secret_123", description="Webhook Verification Token")
    WHATSAPP_MAX_CONCURRENCY: int = Field(default=5, description="Maximum concurrent WhatsApp sending requests")

    # Meta Embedded Signup & App OAuth Credentials
    META_APP_ID: str = Field(default="", description="Meta App ID for Embedded Signup / Facebook JS SDK")
    META_APP_SECRET: str = Field(default="", description="Meta App Secret for server-side OAuth code exchange")
    META_CONFIG_ID: str = Field(default="", description="Optional Meta Embedded Signup Configuration ID")
    META_REDIRECT_URI: str = Field(default="", description="Optional explicit redirect_uri to use during OAuth code exchange")
    FRONTEND_URL: str = Field(default="http://localhost:3010", description="Frontend base URL (used as redirect_uri fallback)")

    # Database Settings: Supports individual parameters or full DATABASE_URL
    DB_TYPE: str = Field(default="sqlite", description="mssql | postgres | sqlite")
    DB_HOST: str | None = Field(default=None, description="Database host (e.g. localhost, 127.0.0.1)")
    DB_PORT: int | None = Field(default=None, description="Database port (e.g. 1433, 5432)")
    DB_USER: str | None = Field(default=None, description="Database username")
    DB_PASSWORD: str | None = Field(default=None, description="Database password")
    DB_NAME: str | None = Field(default="SchoolWhatsAppDB", description="Database name")
    DB_DRIVER: str = Field(default="ODBC Driver 17 for SQL Server", description="ODBC Driver name for SQL Server")

    DATABASE_URL: str | None = Field(
        default=None,
        description="Async Database connection URL for SQL Server / PostgreSQL / SQLite"
    )

    def resolve_odbc_driver(self) -> str:
        preferred = (self.DB_DRIVER or "").strip()
        try:
            import pyodbc
            available = pyodbc.drivers()
            if available:
                if preferred and preferred in available:
                    return preferred
                for candidate in ["ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server", "FreeTDS"]:
                    if candidate in available:
                        return candidate
                return available[0]
        except Exception:
            pass
        return preferred or "ODBC Driver 18 for SQL Server"

    def get_database_url(self):
        from sqlalchemy.engine import URL

        db_type = (self.DB_TYPE or "").lower().strip()

        # If user explicitly configured MSSQL or DB_TYPE != sqlite, build the MSSQL URL
        if db_type == "mssql":
            host = (self.DB_HOST or "localhost").strip()
            # If running inside a container, localhost points to the container itself; route to host.docker.internal
            is_container = os.path.exists("/.dockerenv") or Path("/app").is_dir() or bool(os.environ.get("RUNNING_IN_DOCKER"))
            if is_container and host in ("localhost", "127.0.0.1"):
                host = "host.docker.internal"

            port = self.DB_PORT or 1433
            db_name = self.DB_NAME.strip() if self.DB_NAME else "SchoolWhatsAppDB"
            driver = self.resolve_odbc_driver()

            return URL.create(
                drivername="mssql+aioodbc",
                username=self.DB_USER.strip() if self.DB_USER else None,
                password=self.DB_PASSWORD if self.DB_PASSWORD else None,
                host=host,
                port=port,
                database=db_name,
                query={
                    "driver": driver,
                    "TrustServerCertificate": "yes"
                }
            )

        elif db_type in ("postgres", "postgresql"):
            host = (self.DB_HOST or "localhost").strip()
            is_container = os.path.exists("/.dockerenv") or Path("/app").is_dir() or bool(os.environ.get("RUNNING_IN_DOCKER"))
            if is_container and host in ("localhost", "127.0.0.1"):
                host = "host.docker.internal"

            port = self.DB_PORT or 5432
            db_name = self.DB_NAME.strip() if self.DB_NAME else "school_whatsapp"

            return URL.create(
                drivername="postgresql+asyncpg",
                username=self.DB_USER.strip() if self.DB_USER else "postgres",
                password=self.DB_PASSWORD if self.DB_PASSWORD else "postgres",
                host=host,
                port=port,
                database=db_name
            )

        # If DATABASE_URL was provided and not overridden by DB_TYPE
        if self.DATABASE_URL and not str(self.DATABASE_URL).startswith("sqlite"):
            return self.DATABASE_URL

        # Persistent SQLite storage in mounted volume
        data_dir = Path("/app/data") if Path("/app/data").is_dir() else BASE_DIR / "data"
        try:
            data_dir.mkdir(parents=True, exist_ok=True)
            db_file = data_dir / "school_whatsapp.db"
            return f"sqlite+aiosqlite:///{db_file.as_posix()}"
        except Exception:
            return "sqlite+aiosqlite:///./school_whatsapp.db"

    # CORS Settings
    CORS_ORIGINS: list[str] = [
        "http://localhost:3010",
        "http://127.0.0.1:3010",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]

settings = Settings()
