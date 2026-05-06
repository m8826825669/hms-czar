"""Dev settings."""
from .base import *  # noqa

DEBUG = True
ALLOWED_HOSTS = ["*"]
CORS_ALLOW_ALL_ORIGINS = True

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Show SQL in console
LOGGING["loggers"]["django.db.backends"] = {
    "handlers": ["console"],
    "level": "INFO",  # change to DEBUG for SQL spam
}
