import os
from pathlib import Path
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

# Load environment variables from .env files
if (BASE_DIR / ".env").exists():
    load_dotenv(BASE_DIR / ".env")
if (ROOT_DIR / ".env").exists():
    load_dotenv(ROOT_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-school-whatsapp-secret-key-123456789")

DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = ["*"]

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party apps
    "rest_framework",
    "corsheaders",
    # Local apps
    "api.apps.ApiConfig",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "school_whatsapp.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "school_whatsapp.wsgi.application"
ASGI_APPLICATION = "school_whatsapp.asgi.application"

# Database Configuration
db_type = os.getenv("DB_TYPE", "sqlite").lower().strip()

if db_type == "mssql":
    host = os.getenv("DB_HOST", "localhost").strip()
    is_container = os.path.exists("/.dockerenv") or Path("/app").is_dir() or bool(os.environ.get("RUNNING_IN_DOCKER"))
    if is_container and host in ("localhost", "127.0.0.1"):
        host = "host.docker.internal"

    DATABASES = {
        "default": {
            "ENGINE": "mssql",
            "NAME": os.getenv("DB_NAME", "SchoolWhatsAppDB"),
            "USER": os.getenv("DB_USER", "sa"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": host,
            "PORT": os.getenv("DB_PORT", "1433"),
            "OPTIONS": {
                "driver": os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server"),
                "TrustServerCertificate": "yes",
            },
        }
    }
elif db_type in ("postgres", "postgresql"):
    host = os.getenv("DB_HOST", "localhost").strip()
    is_container = os.path.exists("/.dockerenv") or Path("/app").is_dir() or bool(os.environ.get("RUNNING_IN_DOCKER"))
    if is_container and host in ("localhost", "127.0.0.1"):
        host = "host.docker.internal"

    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "school_whatsapp"),
            "USER": os.getenv("DB_USER", "postgres"),
            "PASSWORD": os.getenv("DB_PASSWORD", "postgres"),
            "HOST": host,
            "PORT": os.getenv("DB_PORT", "5432"),
        }
    }
else:
    data_dir = Path("/app/data") if Path("/app/data").is_dir() else BASE_DIR / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    db_file = data_dir / "school_whatsapp.sqlite3"

    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": db_file,
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Media files (Uploaded images & documents)
MEDIA_URL = "/uploads/"
MEDIA_ROOT = Path("/app/data/uploads") if Path("/app/data").is_dir() else BASE_DIR / "data" / "uploads"
try:
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS Configuration
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"]
CORS_ALLOW_HEADERS = ["*"]

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
    "UNAUTHENTICATED_USER": None,
}

# WhatsApp Meta Cloud API Configuration
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_BUSINESS_ACCOUNT_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v26.0")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "school")
WHATSAPP_MAX_CONCURRENCY = int(os.getenv("WHATSAPP_MAX_CONCURRENCY", "5"))

META_APP_ID = os.getenv("META_APP_ID", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")
META_CONFIG_ID = os.getenv("META_CONFIG_ID", "")

# Hardcoded Authentication Credentials (from .env)
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", os.getenv("LOGIN_EMAIL", "admin@school.com")).strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", os.getenv("LOGIN_PASSWORD", "admin123")).strip()

