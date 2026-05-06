# Setup on Windows 10 + WSL2

You have two paths. **Option A (Docker Compose)** is simpler — recommended unless you specifically want a native dev loop.

---

## Option A — Docker Compose (recommended)

### Prerequisites
1. **Windows 10 build 1903+** with WSL2 enabled
2. **Docker Desktop** — install from https://www.docker.com/products/docker-desktop/
3. In Docker Desktop → Settings → General → enable "Use WSL 2 based engine"
4. Settings → Resources → WSL Integration → enable for your Ubuntu distro

### Steps
```bash
# In WSL2 Ubuntu shell:
cd /mnt/d/mywork                                          # or wherever
unzip hms_phase0.zip && cd hms

# First-time setup
docker compose up --build -d
docker compose exec backend python manage.py seed_initial

# Open in browser:
#   http://localhost:3000     → frontend (login)
#   http://localhost:8000/api/docs/  → API docs
#   http://localhost:8000/admin/     → Django admin

# Default login: admin / ChangeMe@123
```

### Daily workflow
```bash
docker compose up -d              # start
docker compose logs -f backend    # follow backend logs
docker compose exec backend bash  # shell inside backend container
docker compose down               # stop (keeps DB)
docker compose down -v            # stop + wipe DB
```

---

## Option B — Native WSL2 (Python venv + Node + Postgres on WSL)

For a faster dev inner-loop. Requires more setup.

### 1. Install dependencies inside WSL2 Ubuntu
```bash
sudo apt update && sudo apt install -y \
    python3.12 python3.12-venv python3-pip \
    postgresql-16 postgresql-contrib \
    redis-server \
    libpango-1.0-0 libcairo2 libffi-dev \
    libpq-dev default-libmysqlclient-dev pkg-config \
    build-essential

# Node 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20
```

### 2. Postgres setup
```bash
sudo service postgresql start
sudo -u postgres psql <<EOF
CREATE USER hms WITH PASSWORD 'hms';
CREATE DATABASE hms OWNER hms;
ALTER USER hms CREATEDB;
EOF
```

### 3. Redis
```bash
sudo service redis-server start
```

### 4. Backend
```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Copy and edit env
cp .env.example .env
# Set POSTGRES_HOST=localhost, REDIS_URL=redis://localhost:6379/0
sed -i 's|POSTGRES_HOST=db|POSTGRES_HOST=localhost|' .env
sed -i 's|REDIS_URL=redis://redis:6379/0|REDIS_URL=redis://localhost:6379/0|' .env

python manage.py migrate
python manage.py seed_initial

# In separate terminals (or use tmux):
daphne -b 0.0.0.0 -p 8000 config.asgi:application
celery -A config worker -l info
celery -A config beat -l info
```

### 5. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev          # → http://localhost:3000
```

---

## Common Issues on Windows

### `mysqlclient` build fails during `pip install`
You're missing system MySQL dev headers. Fix:
```bash
sudo apt install -y default-libmysqlclient-dev pkg-config build-essential
```
If it still fails, comment `mysqlclient` out of `requirements.txt` — the MySQL importer is optional and only needed for legacy data migration. Re-add it when you're ready to migrate.

### `Pillow` build fails on Windows
This used to be common with native Windows Python. With WSL2 + Ubuntu it should just work. If issues persist, install: `sudo apt install -y libjpeg-dev zlib1g-dev`.

### Docker Desktop slow / WSL2 high memory
Add to `%USERPROFILE%\.wslconfig`:
```ini
[wsl2]
memory=8GB
processors=4
swap=4GB
```
Then restart: `wsl --shutdown` and reopen Docker Desktop.

### Port 5432 already in use
You probably have a Windows Postgres service running. Either stop it (`services.msc` → Postgres → Stop) or change the host port in `docker-compose.yml`:
```yaml
db:
  ports:
    - "5433:5432"     # use 5433 on host
```

### Port 3000 / 8000 already in use
Check what's holding the port:
```powershell
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```
Or change the host port in `docker-compose.yml`.

### Frontend `npm install` very slow
This is usually the npm registry mirror. Try:
```bash
npm config set registry https://registry.npmjs.org/
```

### Hot-reload not working in Docker on WSL2
Make sure the project is on the WSL2 Linux filesystem (e.g., `~/projects/hms`), not under `/mnt/c/` or `/mnt/d/`. File-system events from Windows-mounted paths don't propagate reliably.

### Hardware hooks need access to physical USB devices
USB pass-through to WSL2 requires `usbipd-win`:
```powershell
# In Windows PowerShell as admin:
winget install --interactive --exact dorssel.usbipd-win
usbipd list
usbipd attach --wsl --busid <busid>
```
For thermal printers, network connections (LAN/Wi-Fi at port 9100) are far simpler than USB.

---

## VS Code Tips

- Install the **WSL** and **Dev Containers** extensions
- Open the project with **"Reopen in WSL"** (Ctrl+Shift+P)
- Recommended workspace extensions:
  - Python (Microsoft)
  - Pylance
  - Django (batisteo)
  - Tailwind CSS IntelliSense
  - Prettier
  - ESLint
  - Ruff
- Set Python interpreter to `backend/.venv/bin/python` (Option B) or use the container interpreter (Option A)
