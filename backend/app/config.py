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
    WHATSAPP_ACCESS_TOKEN: str = Field(default="", description="Meta User/System Access Token")
    WHATSAPP_API_VERSION: str = Field(default="v26.0", description="Meta Graph API Version")
    WHATSAPP_VERIFY_TOKEN: str = Field(default="school_whatsapp_verify_token_secret_123", description="Webhook Verification Token")
    WHATSAPP_MAX_CONCURRENCY: int = Field(default=5, description="Maximum concurrent WhatsApp sending requests")

    # Database Settings (Uses zero-config local SQLite by default)
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./school_whatsapp.db",
        description="Async Database connection URL"
    )

    # Test numbers for quick MVP testing
    TEST_RECIPIENT_1: str = Field(default="", description="Test Recipient 1 WhatsApp Number (e.g. 919876543210)")
    TEST_RECIPIENT_2: str = Field(default="", description="Test Recipient 2 WhatsApp Number (e.g. 919876543211)")
    RECIPIENT_NUMBERS: str = Field(default="", description="Optional comma-separated list of recipient numbers")

    def get_recipient_list(self) -> list[str]:
        numbers = []
        if self.RECIPIENT_NUMBERS:
            for num in self.RECIPIENT_NUMBERS.split(","):
                cleaned = num.strip()
                if cleaned and cleaned not in numbers:
                    numbers.append(cleaned)
        if self.TEST_RECIPIENT_1 and self.TEST_RECIPIENT_1.strip() not in numbers:
            numbers.append(self.TEST_RECIPIENT_1.strip())
        if self.TEST_RECIPIENT_2 and self.TEST_RECIPIENT_2.strip() not in numbers:
            numbers.append(self.TEST_RECIPIENT_2.strip())
        return numbers

    # CORS Settings
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

settings = Settings()
