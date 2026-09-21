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
    WHATSAPP_PHONE_NUMBER_ID: str = Field(default="1393372873849630", description="WhatsApp Cloud API Phone Number ID")
    WHATSAPP_BUSINESS_ACCOUNT_ID: str = Field(default="1086203377344807", description="WhatsApp Business Account ID (WABA ID)")
    WHATSAPP_ACCESS_TOKEN: str = Field(default="", description="Meta User/System Access Token")
    WHATSAPP_API_VERSION: str = Field(default="v26.0", description="Meta Graph API Version")
    WHATSAPP_VERIFY_TOKEN: str = Field(default="school_whatsapp_verify_token_secret_123", description="Webhook Verification Token")
    WHATSAPP_MAX_CONCURRENCY: int = Field(default=5, description="Maximum concurrent WhatsApp sending requests")

    # Database Settings: Supports individual parameters or full DATABASE_URL
    DB_TYPE: str = Field(default="sqlite", description="mssql | postgres | sqlite")
    DB_HOST: str | None = Field(default=None, description="Database host (e.g. localhost, 127.0.0.1)")
    DB_PORT: int | None = Field(default=None, description="Database port (e.g. 1433, 5432)")
    DB_USER: str | None = Field(default=None, description="Database username")
    DB_PASSWORD: str | None = Field(default=None, description="Database password")
    DB_NAME: str | None = Field(default=None, description="Database name")
    DB_DRIVER: str = Field(default="ODBC Driver 17 for SQL Server", description="ODBC Driver name for SQL Server")

    DATABASE_URL: str | None = Field(
        default=None,
        description="Async Database connection URL for SQL Server / PostgreSQL / SQLite"
    )

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        
        # Build URL dynamically from DB_* individual parameters
        db_type = self.DB_TYPE.lower()
        if db_type == "mssql":
            port_part = f":{self.DB_PORT}" if self.DB_PORT else ":1433"
            user_part = f"{self.DB_USER}:{self.DB_PASSWORD}@" if self.DB_USER else ""
            host_part = self.DB_HOST or "localhost"
            db_part = f"/{self.DB_NAME}" if self.DB_NAME else "/SchoolWhatsApp"
            driver_encoded = self.DB_DRIVER.replace(" ", "+")
            return f"mssql+aioodbc://{user_part}{host_part}{port_part}{db_part}?driver={driver_encoded}&TrustServerCertificate=yes"
        elif db_type in ("postgres", "postgresql"):
            port_part = f":{self.DB_PORT}" if self.DB_PORT else ":5432"
            user_part = f"{self.DB_USER}:{self.DB_PASSWORD}@" if self.DB_USER else "postgres:postgres@"
            host_part = self.DB_HOST or "localhost"
            db_part = f"/{self.DB_NAME}" if self.DB_NAME else "/school_whatsapp"
            return f"postgresql+asyncpg://{user_part}{host_part}{port_part}{db_part}"
        
        return "sqlite+aiosqlite:///./school_whatsapp.db"

    # CORS Settings
    CORS_ORIGINS: list[str] = [
        "http://localhost:3010",
        "http://127.0.0.1:3010",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]

settings = Settings()
