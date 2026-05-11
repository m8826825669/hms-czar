# Production Deployment Runbook — HMS Phase 0 → 4d

Target environment: Hostinger VPS / CyberPanel + AlmaLinux 8/9
Stack: Django 5.1 · DRF · Channels · Celery · Next.js 15 · PostgreSQL 16 · Redis

---

## 0. Pre-cutover checklist (T-7 days)

Run the in-app readiness check first:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.YOUR-DOMAIN.com/api/analytics/go-live-checklist/
```

Resolve every `FAIL`, review every `WARN`, document any accepted risk.

Other items not covered by the automated checklist:

- [ ] DNS records configured (A or CNAME) for `api.*` and `app.*` subdomains
- [ ] SSL certificates issued (Let's Encrypt via CyberPanel)
- [ ] Firewall: allow 22 (SSH, restricted), 80, 443; deny 8000, 8001 from public
- [ ] Backup target reachable (S3 / Backblaze / external rsync host)
- [ ] Monitoring agent installed (Netdata / Grafana Agent / Datadog)
- [ ] Razorpay webhook URL whitelisted in Razorpay dashboard
- [ ] MSG91 sender ID approved + DLT templates registered
- [ ] Hospital data privacy review signed off (DISHA / DPDP Act 2023)

---

## 1. Server provisioning (T-3 days)

### 1.1 Base packages

```bash
sudo dnf install -y python3.12 python3.12-pip python3.12-devel \
                    postgresql16-server postgresql16-contrib \
                    redis nginx git
```

### 1.2 PostgreSQL

```bash
sudo postgresql-16-setup --initdb
sudo systemctl enable --now postgresql-16
sudo -u postgres psql -c "CREATE USER hms_app WITH PASSWORD 'STRONG_RANDOM_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE hms_prod OWNER hms_app ENCODING 'UTF8';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hms_prod TO hms_app;"
```

Tune `/var/lib/pgsql/16/data/postgresql.conf` for a 4-vCPU / 8 GB box:
- `shared_buffers = 2GB`
- `effective_cache_size = 6GB`
- `work_mem = 16MB`
- `maintenance_work_mem = 512MB`
- `max_connections = 100`

### 1.3 Redis

```bash
sudo systemctl enable --now redis
# /etc/redis/redis.conf — set: requirepass STRONG_RANDOM_PASSWORD ; bind 127.0.0.1
```

### 1.4 Application user

```bash
sudo useradd -m -s /bin/bash hms
sudo -u hms mkdir -p /home/hms/{app,logs,media,backups}
```

---

## 2. Application deployment (T-1 day)

### 2.1 Pull code

```bash
cd /home/hms/app
git clone https://github.com/YOUR-ORG/hms.git .
git checkout v1.0.0   # tagged release
```

### 2.2 Backend

```bash
cd /home/hms/app/backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn uvicorn psycopg2-binary
```

Production env file `/home/hms/app/backend/.env`:

```
DEBUG=False
SECRET_KEY=<50-char random>
ALLOWED_HOSTS=api.YOUR-DOMAIN.com
DATABASE_URL=postgres://hms_app:PASSWORD@127.0.0.1:5432/hms_prod
REDIS_URL=redis://:PASSWORD@127.0.0.1:6379/0
CELERY_BROKER_URL=redis://:PASSWORD@127.0.0.1:6379/1
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=<from Razorpay dashboard>
MSG91_AUTH_KEY=<from MSG91>
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_HOST_USER=...
EMAIL_HOST_PASSWORD=...
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=no-reply@YOUR-DOMAIN.com
CORS_ALLOWED_ORIGINS=https://app.YOUR-DOMAIN.com
```

Run:

```bash
python manage.py collectstatic --noinput
python manage.py migrate
python manage.py createsuperuser     # one-time
```

### 2.3 Gunicorn systemd unit

`/etc/systemd/system/hms-api.service`:

```ini
[Unit]
Description=HMS Django API
After=network.target postgresql-16.service redis.service

[Service]
User=hms
Group=hms
WorkingDirectory=/home/hms/app/backend
EnvironmentFile=/home/hms/app/backend/.env
ExecStart=/home/hms/app/backend/.venv/bin/gunicorn config.wsgi:application \
  --workers 4 --threads 2 --bind 127.0.0.1:8000 \
  --access-logfile /home/hms/logs/api-access.log \
  --error-logfile /home/hms/logs/api-error.log
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Daphne (for WebSocket queue):

`/etc/systemd/system/hms-asgi.service`:

```ini
[Unit]
Description=HMS Daphne ASGI
After=network.target

[Service]
User=hms
Group=hms
WorkingDirectory=/home/hms/app/backend
EnvironmentFile=/home/hms/app/backend/.env
ExecStart=/home/hms/app/backend/.venv/bin/daphne -b 127.0.0.1 -p 8001 config.asgi:application
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Celery worker + beat:

```ini
# /etc/systemd/system/hms-celery.service
[Service]
User=hms
WorkingDirectory=/home/hms/app/backend
EnvironmentFile=/home/hms/app/backend/.env
ExecStart=/home/hms/app/backend/.venv/bin/celery -A config worker -l info
Restart=on-failure
```

```ini
# /etc/systemd/system/hms-celerybeat.service
[Service]
User=hms
WorkingDirectory=/home/hms/app/backend
EnvironmentFile=/home/hms/app/backend/.env
ExecStart=/home/hms/app/backend/.venv/bin/celery -A config beat -l info
Restart=on-failure
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hms-api hms-asgi hms-celery hms-celerybeat
```

### 2.4 Frontend

```bash
cd /home/hms/app/frontend
npm ci
npm run build
```

Create `frontend/.env.production`:

```
NEXT_PUBLIC_API_BASE_URL=https://api.YOUR-DOMAIN.com
NEXT_PUBLIC_WS_BASE_URL=wss://api.YOUR-DOMAIN.com
```

Systemd unit for Next.js:

```ini
# /etc/systemd/system/hms-frontend.service
[Service]
User=hms
WorkingDirectory=/home/hms/app/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start -- -p 3000
Restart=on-failure
```

```bash
sudo systemctl enable --now hms-frontend
```

### 2.5 Nginx reverse proxy

`/etc/nginx/conf.d/hms.conf`:

```nginx
upstream hms_api  { server 127.0.0.1:8000; }
upstream hms_asgi { server 127.0.0.1:8001; }
upstream hms_app  { server 127.0.0.1:3000; }

server {
  listen 443 ssl http2;
  server_name api.YOUR-DOMAIN.com;
  ssl_certificate     /etc/letsencrypt/live/api.YOUR-DOMAIN.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.YOUR-DOMAIN.com/privkey.pem;

  client_max_body_size 25M;

  location /ws/ {
    proxy_pass http://hms_asgi;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  location / {
    proxy_pass http://hms_api;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /static/ { alias /home/hms/app/backend/staticfiles/; }
  location /media/  { alias /home/hms/media/; }
}

server {
  listen 443 ssl http2;
  server_name app.YOUR-DOMAIN.com;
  ssl_certificate     /etc/letsencrypt/live/app.YOUR-DOMAIN.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.YOUR-DOMAIN.com/privkey.pem;

  location / {
    proxy_pass http://hms_app;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

`sudo nginx -t && sudo systemctl reload nginx`.

---

## 3. Cutover (T-day, off-peak)

### 3.1 Freeze legacy system

Block writes on legacy system at T-2 hours. Communicate freeze to all OPD/IPD/Pharmacy/Lab counters.

### 3.2 Data migration

See `MIGRATION_PLAYBOOK.md`. At minimum:
- Patient master
- Doctor master
- Service catalogue + prices
- Inventory items
- Employee master
- Outstanding invoices and admissions

Validation queries after migration:

```sql
-- Counts should match legacy +/- documented variance
SELECT count(*) FROM reception_patient;
SELECT count(*) FROM specialist_doctor;
SELECT count(*) FROM hr_employee WHERE status='ACTIVE';
SELECT count(*) FROM ipd_admission WHERE discharge_date IS NULL;
SELECT sum(grand_total) FROM billing_invoice WHERE created_at::date = current_date - 1;
```

### 3.3 Smoke test

Run `SMOKE_TEST_PLAN.md` end-to-end. Critical paths:
1. Reception → register a new walk-in patient
2. OPD → token issue → vitals → consultation → prescription
3. Billing → generate invoice → Razorpay test payment
4. IPD → admit → ward assignment → discharge summary
5. Pharmacy → dispense from batch → stock decrement
6. Lab → order → sample collection → result entry → report
7. OT → schedule case → consent → completion
8. HR → punch in → daily attendance → leave request
9. Analytics → dashboard renders with new data

### 3.4 Cutover communication

- T+0: confirm legacy frozen, new system live
- T+30 min: post-cutover status to all department heads
- T+2 hr: hourly status updates for 24 hours
- T+24 hr: cutover sign-off meeting

---

## 4. Post-cutover (T+1 to T+30 days)

### 4.1 Daily checks

- Run `/api/analytics/go-live-checklist/` daily for first week
- Review Celery beat task logs
- Review Gunicorn error logs (`/home/hms/logs/api-error.log`)
- Verify nightly PostgreSQL backup completed
- Review `/dashboard/analytics` for anomalous trends

### 4.2 Backup script

`/home/hms/backups/run_backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
pg_dump -h 127.0.0.1 -U hms_app hms_prod | gzip > /home/hms/backups/db-$TS.sql.gz
tar czf /home/hms/backups/media-$TS.tar.gz -C /home/hms media
# Push off-site
rclone copy /home/hms/backups remote:hms-backups/
# Retain 30 days
find /home/hms/backups -name 'db-*.sql.gz' -mtime +30 -delete
find /home/hms/backups -name 'media-*.tar.gz' -mtime +30 -delete
```

Cron: `0 2 * * * /home/hms/backups/run_backup.sh`

### 4.3 Rollback procedure

If a critical bug surfaces in the first 72 hours:

1. Stop services: `sudo systemctl stop hms-api hms-asgi hms-celery hms-frontend`
2. Restore previous database snapshot
3. Redirect DNS back to legacy system
4. File postmortem and fix forward

---

## 5. Support contacts

- Razorpay support: support@razorpay.com / dashboard live chat
- MSG91 support: support@msg91.com
- Hostinger / CyberPanel: panel-based ticketing
- Application owner: rtc@cultusedu.com
