"""
Django settings for unipact_backend project.

Everything environment-specific is read from environment variables (or a local .env file).
See .env.example for the full list. Local development works with no .env at all;
set DJANGO_ENV=production on the server to switch on the production safeguards.
"""

import os
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in ('1', 'true', 'yes', 'on')


def env_list(name, default=''):
    return [item.strip() for item in os.getenv(name, default).split(',') if item.strip()]


ENVIRONMENT = os.getenv('DJANGO_ENV', 'development').lower()
IS_PRODUCTION = ENVIRONMENT == 'production'
TESTING = 'test' in sys.argv


# ------------------------------------------------------------------
# Core security
# ------------------------------------------------------------------

DEBUG = env_bool('DJANGO_DEBUG', default=not IS_PRODUCTION)
if IS_PRODUCTION and DEBUG:
    raise ImproperlyConfigured('DJANGO_DEBUG must be false when DJANGO_ENV=production.')

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY') or os.getenv('SECRET_KEY')
if not SECRET_KEY:
    if IS_PRODUCTION:
        raise ImproperlyConfigured('Set DJANGO_SECRET_KEY in production (at least 50 random characters).')
    # Development-only key: never used when DJANGO_ENV=production
    SECRET_KEY = 'django-insecure-dev-only-key-do-not-use-in-production'

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', '' if IS_PRODUCTION else 'localhost,127.0.0.1,testserver')
if IS_PRODUCTION and not ALLOWED_HOSTS:
    raise ImproperlyConfigured('Set DJANGO_ALLOWED_HOSTS, e.g. "api.unipact.my".')


# ------------------------------------------------------------------
# Applications
# ------------------------------------------------------------------

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third Party
    'rest_framework',
    'corsheaders',
    'storages',

    # Local Apps
    'users',
    'campaigns',
    'payments',

    'rest_framework_simplejwt',
    'django_filters',
    'reviews',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # serves admin/static files in production
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'unipact_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'unipact_backend.wsgi.application'


# ------------------------------------------------------------------
# Database: SQLite locally, PostgreSQL via DATABASE_URL in production
# ------------------------------------------------------------------

DATABASE_URL = os.getenv('DATABASE_URL')
if IS_PRODUCTION and not DATABASE_URL:
    raise ImproperlyConfigured('Set DATABASE_URL to your PostgreSQL connection string in production.')

DATABASES = {
    'default': dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=env_bool('DATABASE_SSL_REQUIRE', default=IS_PRODUCTION),
    ) if DATABASE_URL else {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# ------------------------------------------------------------------
# Passwords
# ------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# ------------------------------------------------------------------
# Internationalization
# ------------------------------------------------------------------

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# ------------------------------------------------------------------
# Static & uploaded files
# ------------------------------------------------------------------

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Uploaded files go to S3-compatible object storage (Cloudflare R2, AWS S3, DigitalOcean Spaces)
# when USE_S3=true. Required in production: server disks are wiped on redeploy on most hosts.
USE_S3 = env_bool('USE_S3', default=False)
if IS_PRODUCTION and not USE_S3 and not env_bool('ALLOW_LOCAL_MEDIA', default=False):
    raise ImproperlyConfigured('Set USE_S3=true and the AWS_* storage settings in production (or ALLOW_LOCAL_MEDIA=true for a VPS with a persistent disk).')

if USE_S3:
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL')  # e.g. https://<account>.r2.cloudflarestorage.com
    AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'auto')
    AWS_S3_SIGNATURE_VERSION = 's3v4'
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    # Student IDs, SSM documents and client footage are private: links are signed and expire
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = int(os.getenv('AWS_QUERYSTRING_EXPIRE', '3600'))
    missing = [name for name in ('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_STORAGE_BUCKET_NAME') if not os.getenv(name)]
    if missing:
        raise ImproperlyConfigured(f'USE_S3 is on but these settings are missing: {", ".join(missing)}')
    DEFAULT_FILE_STORAGE_BACKEND = 'storages.backends.s3.S3Storage'
else:
    DEFAULT_FILE_STORAGE_BACKEND = 'django.core.files.storage.FileSystemStorage'

STORAGES = {
    'default': {'BACKEND': DEFAULT_FILE_STORAGE_BACKEND},
    'staticfiles': {
        'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage' if (DEBUG or TESTING)
        else 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

# Upload limits (MB), enforced in unipact_backend/validators.py
MAX_DOCUMENT_UPLOAD_MB = int(os.getenv('MAX_DOCUMENT_UPLOAD_MB', '10'))
MAX_PROJECT_FILE_UPLOAD_MB = int(os.getenv('MAX_PROJECT_FILE_UPLOAD_MB', '500'))
# Keep large uploads on disk while processing instead of in memory
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024


DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'users.User'

# The Django admin lives at an unguessable path in production, e.g. DJANGO_ADMIN_URL=ops-7f3k2/
ADMIN_URL = os.getenv('DJANGO_ADMIN_URL', 'admin/')


# ------------------------------------------------------------------
# REST Framework & rate limiting
# ------------------------------------------------------------------

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'unipact_backend.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': os.getenv('THROTTLE_ANON', '120/min'),
        'user': os.getenv('THROTTLE_USER', '600/min'),
        # Brute-force protection for credentials, applied per IP address
        'login': os.getenv('THROTTLE_LOGIN', '10/min'),
        'register': os.getenv('THROTTLE_REGISTER', '20/hour'),
        'token_refresh': os.getenv('THROTTLE_TOKEN_REFRESH', '60/min'),
    },
    # Don't leak the browsable API in production
    'DEFAULT_RENDERER_CLASSES': (
        ('rest_framework.renderers.JSONRenderer',) if IS_PRODUCTION
        else ('rest_framework.renderers.JSONRenderer', 'rest_framework.renderers.BrowsableAPIRenderer')
    ),
}

if TESTING:
    # Tests fire many requests from one "IP"; keep limits out of the way (throttle tests override these)
    REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = ()
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].update({'login': '10000/min', 'register': '10000/min', 'token_refresh': '10000/min'})

# Throttle counters: set REDIS_URL when running more than one server process so limits are shared
REDIS_URL = os.getenv('REDIS_URL')
CACHES = {
    'default': {'BACKEND': 'django.core.cache.backends.redis.RedisCache', 'LOCATION': REDIS_URL}
    if REDIS_URL else {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}
}

# Number of reverse proxies in front of Django (Render/Railway/Nginx = 1), so throttling sees the real client IP
NUM_PROXIES = int(os.getenv('NUM_PROXIES', '1' if IS_PRODUCTION else '0'))
REST_FRAMEWORK['NUM_PROXIES'] = NUM_PROXIES or None


# ------------------------------------------------------------------
# CORS / CSRF: which frontend origins may call the API with cookies
# ------------------------------------------------------------------

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env_list(
    'CORS_ALLOWED_ORIGINS',
    '' if IS_PRODUCTION else 'http://localhost:5173,http://127.0.0.1:5173',
)
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS', ','.join(CORS_ALLOWED_ORIGINS))
if IS_PRODUCTION and not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured('Set CORS_ALLOWED_ORIGINS to your frontend URL, e.g. "https://unipact.my".')


# ------------------------------------------------------------------
# Auth cookies (JWT)
# ------------------------------------------------------------------

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,  # token_blacklist app is not installed
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Host the frontend and API on the same site (e.g. unipact.my + api.unipact.my) so "Lax" works.
# Only use "None" if they are on unrelated domains; that also requires HTTPS.
AUTH_COOKIE_SECURE = env_bool('AUTH_COOKIE_SECURE', default=IS_PRODUCTION)
AUTH_COOKIE_SAMESITE = os.getenv('AUTH_COOKIE_SAMESITE', 'Lax')
AUTH_COOKIE_DOMAIN = os.getenv('AUTH_COOKIE_DOMAIN') or None  # e.g. ".unipact.my"
if AUTH_COOKIE_SAMESITE == 'None' and not AUTH_COOKIE_SECURE:
    raise ImproperlyConfigured('AUTH_COOKIE_SAMESITE=None requires AUTH_COOKIE_SECURE=true.')


# ------------------------------------------------------------------
# HTTPS & browser security headers (production)
# ------------------------------------------------------------------

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
X_FRAME_OPTIONS = 'DENY'

if IS_PRODUCTION:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = env_bool('SECURE_SSL_REDIRECT', default=True)
    SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=True)
    SECURE_HSTS_PRELOAD = env_bool('SECURE_HSTS_PRELOAD', default=False)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    if not SECURE_HSTS_PRELOAD:
        # Preloading hard-codes HTTPS-only into browsers and is very hard to undo: opt in deliberately
        SILENCED_SYSTEM_CHECKS = ['security.W021']
    # Health checks from the hosting platform come in over plain HTTP internally
    SECURE_REDIRECT_EXEMPT = [r'^api/health/$']


# ------------------------------------------------------------------
# Logging: errors to stdout so the hosting platform captures them
# ------------------------------------------------------------------

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': os.getenv('LOG_LEVEL', 'INFO' if IS_PRODUCTION else 'WARNING')},
}
