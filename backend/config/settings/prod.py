"""Production settings."""
from .base import *  # noqa

DEBUG = False

# Strict security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)  # noqa
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# S3 / MinIO file storage
DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default="")  # noqa
AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default="")  # noqa
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")  # noqa
AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="ap-south-1")  # noqa
AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL", default=None)  # noqa
AWS_DEFAULT_ACL = "private"
AWS_QUERYSTRING_AUTH = True
AWS_S3_FILE_OVERWRITE = False
