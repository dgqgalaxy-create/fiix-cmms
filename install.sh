#!/bin/bash
# Instalación inicial de FIIX CMMS en Ubuntu.
# Requiere el repo YA clonado (ver README §1.1 SSH). Este script NO hace git clone.
# No sustituye update.sh: este es SOLO la primera configuración del servidor.
set -euo pipefail

# Directorio del repo = carpeta donde está este script
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_MAJOR="${NODE_MAJOR:-20}"

echo "=== Instalación FIIX CMMS ==="
echo "Directorio del proyecto: ${APP_DIR}"
echo

# --- helpers ---
load_nvm() {
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck disable=SC1091
  [ -s "${NVM_DIR}/nvm.sh" ] && . "${NVM_DIR}/nvm.sh"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

die() {
  echo "  [ERROR] $*" >&2
  exit 1
}

ask() {
  local prompt="$1"
  local default="${2:-}"
  local reply
  if [ -n "$default" ]; then
    read -r -p "${prompt} [${default}]: " reply
    echo "${reply:-$default}"
  else
    read -r -p "${prompt}: " reply
    echo "$reply"
  fi
}

ask_secret() {
  local prompt="$1"
  local reply
  read -r -s -p "${prompt}: " reply
  echo
  echo "$reply"
}

# --- 0. Verificar que el código ya está aquí ---
echo ">>> [0/7] Verificar repositorio local..."
[ -f "${APP_DIR}/install.sh" ] || die "No se encontró install.sh. Ejecuta este script desde dentro del repo clonado."
[ -d "${APP_DIR}/backend" ] && [ -d "${APP_DIR}/frontend" ] || die "Faltan carpetas backend/ o frontend/. ¿Clonaste el repo completo?"
[ -f "${APP_DIR}/backend/package.json" ] || die "Falta backend/package.json."
chmod +x "${APP_DIR}/update.sh" "${APP_DIR}/install.sh" 2>/dev/null || true
echo "  [OK] Código local listo (clone/SSH se hace ANTES, ver README)."

# --- 1. Paquetes del sistema ---
echo ">>> [1/7] Paquetes base (git, curl, build-essential, postgresql)..."
if need_cmd apt-get; then
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    git curl ca-certificates build-essential \
    postgresql postgresql-contrib
  sudo systemctl enable --now postgresql
else
  die "Este script está pensado para Ubuntu/Debian (apt)."
fi

# --- 2. Node via NVM ---
echo ">>> [2/7] Node.js ${NODE_MAJOR} (nvm)..."
if [ ! -s "${HOME}/.nvm/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
load_nvm
nvm install "$NODE_MAJOR"
nvm use "$NODE_MAJOR"
npm install -g pm2

# --- 3. Credenciales ---
echo
echo ">>> [3/7] Credenciales (se guardan SOLO en backend/.env, no en Git)..."
DB_PASS="$(ask_secret "Contraseña para el usuario PostgreSQL 'postgres'")"
if [ -z "$DB_PASS" ]; then
  die "La contraseña de PostgreSQL no puede estar vacía."
fi
JWT_SECRET="$(ask "JWT_SECRET (sesiones)" "$(openssl rand -hex 24 2>/dev/null || echo 'cambia_este_secreto_jwt')")"
DEV_PASS="$(ask "Contraseña menú desarrollador" "cambiar-dev-pass")"
HOSTNAME_HINT="$(ask "Hostname local opcional (ej. lpet-cmms, Enter para omitir)" "")"

if [ -n "$HOSTNAME_HINT" ]; then
  echo "Puedes fijar el hostname del sistema con: sudo hostnamectl set-hostname ${HOSTNAME_HINT}"
fi

# --- 4. PostgreSQL ---
echo ">>> [4/7] Base de datos fiix_cmms..."
SQL_PASS="${DB_PASS//\'/\'\'}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD '${SQL_PASS}';"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='fiix_cmms'" | grep -q 1; then
  sudo -u postgres createdb fiix_cmms
fi

# --- 5. .env + npm + Prisma ---
echo ">>> [5/7] backend/.env, npm install y Prisma..."
mkdir -p "${APP_DIR}/backend/uploads"

ENV_FILE="${APP_DIR}/backend/.env"
if [ -f "$ENV_FILE" ]; then
  echo "Ya existe backend/.env — se conserva (no se sobrescribe)."
  echo "Si necesitas regenerarlo, bórralo y vuelve a ejecutar install.sh."
else
  cat > "$ENV_FILE" <<EOF
DATABASE_URL="postgresql://postgres:${DB_PASS}@localhost:5432/fiix_cmms?schema=public"
PORT=3000
JWT_SECRET="${JWT_SECRET}"
DEV_MENU_PASSWORD="${DEV_PASS}"
EOF
  chmod 600 "$ENV_FILE"
  echo "Creado ${ENV_FILE}"
fi

cd "${APP_DIR}/backend"
npm install
npx prisma generate
npx prisma db push

SEED_NOW="$(ask "¿Cargar datos iniciales (admin@fiix.com / password123)? [s/N]" "N")"
if [[ "${SEED_NOW}" =~ ^[sS]$ ]]; then
  npx prisma db seed || echo "Aviso: seed falló o ya había datos; continúa."
fi

cd "${APP_DIR}/frontend"
npm install

# --- 6. PM2 ---
echo ">>> [6/7] Servicios PM2..."
load_nvm
cd "${APP_DIR}/backend"
pm2 delete fiix-backend >/dev/null 2>&1 || true
pm2 start npm --name fiix-backend -- run dev

cd "${APP_DIR}/frontend"
pm2 delete fiix-frontend >/dev/null 2>&1 || true
pm2 start npm --name fiix-frontend -- run dev -- --host 0.0.0.0 --port 5173

pm2 save
echo
echo "Para arrancar PM2 al reiniciar el servidor, ejecuta el comando que imprima:"
pm2 startup | tail -n 5 || true

# --- 7. Resumen ---
IP_LAN="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "=== [7/7] Instalación completada ==="
echo "UI:    http://${IP_LAN:-IP}:5173"
echo "API:   http://${IP_LAN:-IP}:3000"
echo "Login seed (si lo corriste): admin@fiix.com / password123  → cámbialo"
echo
echo "Actualizaciones futuras (NO vuelve a pedir .env):"
echo "  cd ${APP_DIR} && ./update.sh"
echo
echo "Manual pendiente (no lo hace este script):"
echo "  - Firewall (ufw allow 5173,3000 / o solo Tailscale)"
echo "  - Tailscale + MagicDNS/HTTPS si lo usas"
echo "  - Telegram/SMTP en .env o en Opciones de desarrollador"
echo "=== Listo ==="
