FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps:
#   build-essential, libpq-dev    -> psycopg, mysqlclient builds
#   default-libmysqlclient-dev    -> mysqlclient
#   libpango / libcairo / libffi  -> WeasyPrint
#   libusb-1.0-0                  -> escpos USB
#   tzdata                        -> Asia/Kolkata
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    default-libmysqlclient-dev pkg-config \
    libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libcairo2 libffi-dev \
    libusb-1.0-0 \
    curl tzdata \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Kolkata

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
