"""
HMS Base Settings - shared across all environments.
"""
from pathlib import Path
from datetime import timedelta
import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent
env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

# ─── Security ───────────────────────────────────────────────
SECRET_KEY = env("DJANGO_SECRET_KEY", default="django-insecure-change-me-in-prod")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# ─── Application Definition ─────────────────────────────────
DJANGO_APPS = [
    "daphne",  # must be before django.contrib.staticfiles for ASGI
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "channels",
    "django_celery_beat",
    "django_celery_results",
    "simple_history",
    "storages",
    "django_extensions",
]

# All 30 HMS apps (26 modules + core + accounts + notifications)
LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.notifications",
    # Clinical
    "apps.reception",
    "apps.opd",
    "apps.ipd",
    "apps.ward",
    "apps.ot",
    "apps.emr",
    "apps.nursing",
    "apps.specialist",
    "apps.blood_bank",
    "apps.research",
    # Pharmacy & Inventory
    "apps.pharmacy",
    "apps.stock",
    "apps.bottles",
    # Support Services
    "apps.dietary",
    "apps.laundry",
    "apps.ambulance",
    "apps.gas_cylinder",
    "apps.internal_comms",
    # HR
    "apps.staff",
    "apps.payroll",
    "apps.attendance",
    # Security
    "apps.crisis",
    "apps.protection",
    "apps.admin_security",
    # Finance
    "apps.billing",
    "apps.accounting",
    "apps.public",
    # Cross-cutting
    "apps.scheduling",
    "apps.reports",
    "apps.department",
    "apps.lab",
      # Phase 4a
    "apps.inventory",
    "apps.assets",
    "apps.housekeeping",

    # Phase 4b
    "apps.hr",
    "apps.security_module",

    ## Phase 4c
    "apps.insurance",
    "apps.vaccination",
    "apps.complaints",

    # Phase 4d
    "apps.analytics",
   
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "simple_history.middleware.HistoryRequestMiddleware",
    "apps.core.middleware.HospitalContextMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
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

# ─── Database ───────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="hms"),
        "USER": env("POSTGRES_USER", default="postgres"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="12345678"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
        "OPTIONS": {
            "connect_timeout": 10,
        },
    }
}

# ─── Cache (Redis) ──────────────────────────────────────────
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        "KEY_PREFIX": "hms",
    }
}

# ─── Channels (WebSocket) ───────────────────────────────────
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# ─── Celery ─────────────────────────────────────────────────
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = "django-db"
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "Asia/Kolkata"

# ─── Auth ───────────────────────────────────────────────────
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── DRF & JWT ──────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "60/minute", "user": "1000/minute"},
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_USER_CLASS": "rest_framework_simplejwt.models.TokenUser",
    "TOKEN_OBTAIN_SERIALIZER": "apps.accounts.serializers.HMSTokenObtainPairSerializer",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "HMS API",
    "DESCRIPTION": (
        "Hospital Management System REST API.\n\n"
        "**Auth**: JWT Bearer. POST `/api/v1/auth/login/` to get an `access` "
        "token, then click the **Authorize** button above and paste it as "
        "`Bearer <token>`.\n\n"
        "**Multi-tenant**: every request is scoped to the user's hospital "
        "via the `X-Hospital-Id` header (set automatically by the frontend "
        "from the JWT)."
    ),
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    # Sort tags alphabetically and group operations by the first path segment
    # (so /api/v1/billing/* shows under "billing" etc.).
    "SORT_OPERATIONS": True,
    "TAGS": [],   # auto-derived from URL paths
    # Use JWT in the security scheme so the Authorize button works.
    "SECURITY": [{"jwtAuth": []}],
    # Stable server entries so the "Try it out" button doesn't fail behind a
    # reverse proxy. Override DJANGO_BACKEND_URL in prod env to expose the real host.
    "SERVERS": [
        {"url": "http://localhost:8000", "description": "Local dev"},
    ],
    # OPTIONAL: schema generation currently emits "Status009Enum" / "Priority1baEnum"
    # style names because the same field name (status, priority, blood_group, shift)
    # is used across many models with different choice sets. To get clean names like
    # AppointmentStatusEnum / AdmissionStatusEnum, populate this dict with the
    # canonical name → import path of each choices tuple. Example:
    #   "AppointmentStatusEnum": "apps.reception.models.APPOINTMENT_STATUS_CHOICES",
    # Skipping it now is harmless — the schema still works, just with auto-named enums.
    "ENUM_NAME_OVERRIDES": {},
    # SwaggerUI tweaks
    "SWAGGER_UI_SETTINGS": {
        "deepLinking": True,
        "persistAuthorization": True,
        "displayOperationId": False,
        "filter": True,
        "tagsSorter": "alpha",
        "operationsSorter": "alpha",
    },
    # Skip endpoints that aren't part of the public API.
    "SCHEMA_PATH_PREFIX": r"/api/v1/",
}

# ─── CORS ───────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000", "http://127.0.0.1:3000"],
)
CORS_ALLOW_CREDENTIALS = True

# ─── Internationalization ───────────────────────────────────
LANGUAGE_CODE = "en-in"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# ─── Static & Media ─────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── Razorpay ───────────────────────────────────────────────
RAZORPAY_KEY_ID = env("RAZORPAY_KEY_ID", default="")
RAZORPAY_KEY_SECRET = env("RAZORPAY_KEY_SECRET", default="")
RAZORPAY_WEBHOOK_SECRET = env("RAZORPAY_WEBHOOK_SECRET", default="")

# ─── MSG91 (SMS / WhatsApp / OTP) ───────────────────────────
MSG91_AUTH_KEY = env("MSG91_AUTH_KEY", default="")
MSG91_SENDER_ID = env("MSG91_SENDER_ID", default="HMSCRE")
MSG91_OTP_TEMPLATE_ID = env("MSG91_OTP_TEMPLATE_ID", default="")

# ─── Hospital Defaults ──────────────────────────────────────
HMS_DEFAULT_HOSPITAL_CODE = env("HMS_DEFAULT_HOSPITAL_CODE", default="HOSP001")
HMS_MRN_PREFIX = env("HMS_MRN_PREFIX", default="MRN")
HMS_MRN_PADDING = env.int("HMS_MRN_PADDING", default=8)

# ─── Logging ────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} [{levelname}] {name}: {message}",
            "style": "{",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        }
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "apps": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
    },
}
