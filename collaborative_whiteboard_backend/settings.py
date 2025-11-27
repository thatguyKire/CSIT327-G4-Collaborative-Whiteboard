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
SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-4-b^8=^287@np#7mr$+l9*5!+2tvn_6ecx#4n+six8ep3!ln-#")
DEBUG = os.getenv("DEBUG", "True") == "True"

ALLOWED_HOSTS = [
    'collaboard-z4sx.onrender.com',
    'localhost',
    '127.0.0.1'
]

# -------------------------------------------------------------
# APPLICATIONS
# -------------------------------------------------------------
INSTALLED_APPS = [
    # Django default apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',

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
DATABASES = {
    "default": dj_database_url.config(
        default="sqlite:///db.sqlite3",
        conn_max_age=600,
        ssl_require=False if DEBUG else True  # Only force SSL in production
    )
}

# -------------------------------------------------------------
# AUTHENTICATION
# -------------------------------------------------------------
AUTH_USER_MODEL = "authentication.CustomUser"

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
# SUPABASE (for whiteboard snapshots)
# -------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "whiteboard_snapshots")
# Backward-compat alias (old code may still read SUPABASE_KEY)
SUPABASE_KEY = SUPABASE_ANON_KEY

# -------------------------------------------------------------
# STATIC & MEDIA FILES
# -------------------------------------------------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / "staticfiles"

# ✅ Let Django collect from all apps
STATICFILES_DIRS = [
    BASE_DIR / 'modules' / 'core' / 'static',
]

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

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
