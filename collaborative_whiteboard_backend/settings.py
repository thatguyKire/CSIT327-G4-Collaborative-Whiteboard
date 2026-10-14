"""
Django settings for collaborative_whiteboard_backend project.
"""

import os
from pathlib import Path
import dj_database_url
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# -------------------------------------------------------------
# PATHS
# -------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# -------------------------------------------------------------
# SECURITY SETTINGS
# -------------------------------------------------------------
# Always set SECRET_KEY in production; the fallback is for local development only.
SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-4-b^8=^287@np#7mr$+l9*5!+2tvn_6ecx#4n+six8ep3!ln-#")

# Render sets RENDER=true, so production defaults to DEBUG off unless overridden.
DEBUG = os.getenv("DEBUG", "False" if os.getenv("RENDER") else "True") == "True"

ALLOWED_HOSTS = [
    'collaboard-z4sx.onrender.com',
    'localhost',
    '127.0.0.1',
]
ALLOWED_HOSTS += [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip()]
if os.getenv("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])

CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS if h not in ("localhost", "127.0.0.1")]

# Render terminates TLS at its proxy; trust its header so request.is_secure()
# and build_absolute_uri() produce https:// URLs.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# -------------------------------------------------------------
# APPLICATIONS
# -------------------------------------------------------------
INSTALLED_APPS = [
    # ASGI server: must come first so `runserver` serves WebSockets too
    'daphne',

    # Django default apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'channels',

    # Your modular apps
    'modules.authentication',
    'modules.profiles',         # ✅ renamed “profile” → “profiles” to avoid conflicts
    'modules.dashboard',
    'modules.settings_app',
    'modules.notifications',
    'modules.help_app',
    'modules.session',
    'modules.core',             # ✅ where base templates/icons live
    'modules.chat',
]

# -------------------------------------------------------------
# MIDDLEWARE
# -------------------------------------------------------------
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'modules.core.middleware.no_cache.NoCacheForAuthMiddleware',  # renamed to match actual class
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# -------------------------------------------------------------
# URL & WSGI
# -------------------------------------------------------------
ROOT_URLCONF = 'collaborative_whiteboard_backend.urls'
WSGI_APPLICATION = 'collaborative_whiteboard_backend.wsgi.application'
ASGI_APPLICATION = 'collaborative_whiteboard_backend.asgi.application'

# Realtime whiteboard (WebSockets). The in-memory layer needs a single server
# process, which is how the app runs (one Daphne process).
CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}

# -------------------------------------------------------------
# TEMPLATES
# -------------------------------------------------------------
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        # ✅ Include a global "modules/core/templates" directory for shared templates
        'DIRS': [BASE_DIR / 'modules' / 'core' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'modules.notifications.notifcounts.notif_counts',  # was wrong module path
            ],
        },
    },
]

# -------------------------------------------------------------
# DATABASE
# -------------------------------------------------------------
# SQLite by default. SQLITE_PATH lets production keep the file on a persistent
# disk; DATABASE_URL (PostgreSQL) still works if you ever move to a server DB.
SQLITE_PATH = os.getenv("SQLITE_PATH", str(BASE_DIR / "db.sqlite3"))

if os.getenv("DATABASE_URL"):
    DATABASES = {
        "default": dj_database_url.config(conn_max_age=600, ssl_require=not DEBUG)
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": SQLITE_PATH,
            "OPTIONS": {
                # WAL + immediate transactions avoid "database is locked" when the
                # web and WebSocket handlers write at the same time.
                "init_command": "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;",
                "transaction_mode": "IMMEDIATE",
                "timeout": 20,
            },
        }
    }

# -------------------------------------------------------------
# AUTHENTICATION
# -------------------------------------------------------------
AUTH_USER_MODEL = "authentication.CustomUser"
AUTHENTICATION_BACKENDS = [
    "modules.authentication.backends.EmailOrUsernameModelBackend",
]

LOGIN_REDIRECT_URL = "/dashboard/redirect/"
LOGOUT_REDIRECT_URL = "/auth/login/"
LOGIN_URL = "/auth/login/"

# -------------------------------------------------------------
# PASSWORD VALIDATION
# -------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
    # Project-specific complexity validator: requires uppercase, digit, special char
    {'NAME': 'modules.authentication.validators.ComplexPasswordValidator'},
]

# -------------------------------------------------------------
# INTERNATIONALIZATION
# -------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Manila'  # ✅ optional — better for PH timezone
USE_I18N = True
USE_TZ = True

# -------------------------------------------------------------
# STATIC & MEDIA FILES
# -------------------------------------------------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / "staticfiles"

# App static folders (modules/<app>/static/) are found automatically.

# Snapshots and uploads are stored on local disk (MEDIA_ROOT) and served by
# the app at /media/. Point MEDIA_ROOT at a persistent disk in production.
MEDIA_URL = '/media/'
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", str(BASE_DIR / 'media')))

# ✅ WhiteNoise for Render (static caching)
STORAGES = {
    # Handles Django static files
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },

    # ✅ Handles user uploads (images, PDFs, etc.)
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {
            "location": MEDIA_ROOT,
            "base_url": MEDIA_URL,
        },
    },
}

# -------------------------------------------------------------
# DEFAULT PRIMARY KEY
# -------------------------------------------------------------
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# -------------------------------------------------------------
# UPLOADS & LOGGING
# -------------------------------------------------------------
# Whiteboard snapshots are posted as PNG form data; allow up to 15 MB in memory.
DATA_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO")},
}
