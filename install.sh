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
  # Intentar varias ubicaciones (HOME del runner, NVM_DIR, usuario típico del servidor).
  local candidates=()
  if [ -n "${NVM_DIR:-}" ]; then
    candidates+=("${NVM_DIR}/nvm.sh")
  fi
  candidates+=("${HOME}/.nvm/nvm.sh" "/home/usuario/.nvm/nvm.sh")
  local cand
  for cand in "${candidates[@]}"; do
    if [ -s "$cand" ]; then
      export NVM_DIR="$(cd "$(dirname "$cand")" && pwd)"
      # shellcheck disable=SC1090
      . "$cand"
      return 0
    fi
  done
  return 1
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
echo ">>> [0/8] Verificar repositorio local..."
[ -f "${APP_DIR}/install.sh" ] || die "No se encontró install.sh. Ejecuta este script desde dentro del repo clonado."
[ -d "${APP_DIR}/backend" ] && [ -d "${APP_DIR}/frontend" ] || die "Faltan carpetas backend/ o frontend/. ¿Clonaste el repo completo?"
[ -f "${APP_DIR}/backend/package.json" ] || die "Falta backend/package.json."
chmod +x "${APP_DIR}/update.sh" "${APP_DIR}/install.sh" "${APP_DIR}/scripts/backup.sh" "${APP_DIR}/scripts/healthcheck.sh" 2>/dev/null || true
echo "  [OK] Código local listo (clone/SSH se hace ANTES, ver README)."

# --- 1. Paquetes del sistema ---
echo ">>> [1/8] Paquetes base (git, curl, build-essential, postgresql)..."
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
echo ">>> [2/8] Node.js ${NODE_MAJOR} (nvm)..."
if [ ! -s "${HOME}/.nvm/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
load_nvm
nvm install "$NODE_MAJOR"
nvm use "$NODE_MAJOR"
npm install -g pm2

# --- 3. Credenciales ---
echo
echo ">>> [3/8] Credenciales (se guardan SOLO en backend/.env, no en Git)..."
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
echo ">>> [4/8] Base de datos fiix_cmms..."
SQL_PASS="${DB_PASS//\'/\'\'}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD '${SQL_PASS}';"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='fiix_cmms'" | grep -q 1; then
  sudo -u postgres createdb fiix_cmms
fi

# --- 5. .env + npm + Prisma ---
echo ">>> [5/8] backend/.env, npm install y Prisma..."
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
echo "Compilando frontend (frontend/dist)..."
npm run build:app

# --- 6. PM2 (un solo proceso: el backend sirve la API y el frontend ya compilado) ---
echo ">>> [6/8] Servicio PM2 (fiix-backend)..."
load_nvm
cd "${APP_DIR}/backend"
pm2 delete fiix-backend >/dev/null 2>&1 || true
pm2 delete fiix-frontend >/dev/null 2>&1 || true
pm2 start npm --name fiix-backend -- run dev

pm2 save
echo "  [OK] En producción, backend (puerto ${PORT:-3000}) sirve la API y la interfaz (frontend/dist)."
echo "  Para desarrollar con recarga en caliente: cd frontend && npm run dev -- --host 0.0.0.0 --port 5173"

# --- 7. Opcionales (preguntas) ---
echo
echo ">>> [7/8] Configuración opcional (puedes responder N y hacerlo después)..."

# 7a. PM2 al reiniciar
DO_PM2_STARTUP="$(ask "¿Registrar PM2 para que FIIX arranque al reiniciar el PC? (requiere sudo) [s/N]" "N")"
if [[ "${DO_PM2_STARTUP}" =~ ^[sS]$ ]]; then
  load_nvm
  STARTUP_LINE="$(pm2 startup systemd -u "${USER}" --hp "${HOME}" 2>/dev/null | grep -E '^sudo ' | tail -n 1 || true)"
  if [ -z "${STARTUP_LINE}" ]; then
    # Algunas versiones de PM2 imprimen el comando en otra línea
    STARTUP_LINE="$(pm2 startup systemd -u "${USER}" --hp "${HOME}" 2>&1 | grep -E 'sudo env' | tail -n 1 || true)"
  fi
  if [ -n "${STARTUP_LINE}" ]; then
    echo "  Ejecutando (sudo puede pedir tu contraseña):"
    echo "  ${STARTUP_LINE}"
    # shellcheck disable=SC2086
    eval "${STARTUP_LINE}" && echo "  [OK] PM2 startup registrado." || echo "  [AVISO] No se pudo registrar PM2 startup; ejecútalo a mano más tarde."
    pm2 save || true
  else
    echo "  [AVISO] No se detectó el comando de startup. Ejecuta: pm2 startup"
  fi
else
  echo "  Omitido. Más tarde: pm2 startup  (y el comando sudo que imprima)."
fi

# 7b. Firewall ufw
echo
echo "  Firewall (ufw): abre SSH + puerto 3000 (UI + API en un solo proceso)."
echo "  El puerto 5173 solo hace falta si vas a desarrollar con 'npm run dev' en el frontend."
echo "  Si usas solo Tailscale y no quieres exponer la LAN, responde N."
DO_UFW="$(ask "¿Configurar y activar ufw ahora? [s/N]" "N")"
if [[ "${DO_UFW}" =~ ^[sS]$ ]]; then
  CONFIRM_UFW="$(ask "CONFIRMA: ¿activar ufw? (si SSH no queda permitido, puedes perder acceso remoto) [s/N]" "N")"
  if [[ "${CONFIRM_UFW}" =~ ^[sS]$ ]]; then
    if need_cmd ufw || sudo apt-get install -y ufw; then
      sudo ufw allow OpenSSH
      sudo ufw allow 22/tcp
      sudo ufw allow 3000/tcp comment 'FIIX UI + API'
      sudo ufw allow 80/tcp comment 'FIIX nginx (opcional)'
      sudo ufw --force enable
      sudo ufw status || true
      echo "  [OK] ufw activo (22, 80, 3000)."
    else
      echo "  [AVISO] No se pudo instalar/usar ufw."
    fi
  else
    echo "  Omitido (no confirmaste)."
  fi
else
  echo "  Omitido."
fi

# 7c. Telegram
echo
DO_TG="$(ask "¿Guardar Telegram (Bot Token + Chat ID) en backend/.env ahora? [s/N]" "N")"
if [[ "${DO_TG}" =~ ^[sS]$ ]]; then
  TG_TOKEN="$(ask "TELEGRAM_BOT_TOKEN (Enter para saltar)" "")"
  TG_CHAT="$(ask "TELEGRAM_CHAT_ID (Enter para saltar)" "")"
  ENV_FILE="${APP_DIR}/backend/.env"
  touch "${ENV_FILE}"
  if [ -n "${TG_TOKEN}" ]; then
    if grep -q '^TELEGRAM_BOT_TOKEN=' "${ENV_FILE}" 2>/dev/null; then
      sed -i "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=\"${TG_TOKEN}\"|" "${ENV_FILE}"
    else
      echo "TELEGRAM_BOT_TOKEN=\"${TG_TOKEN}\"" >> "${ENV_FILE}"
    fi
  fi
  if [ -n "${TG_CHAT}" ]; then
    if grep -q '^TELEGRAM_CHAT_ID=' "${ENV_FILE}" 2>/dev/null; then
      sed -i "s|^TELEGRAM_CHAT_ID=.*|TELEGRAM_CHAT_ID=\"${TG_CHAT}\"|" "${ENV_FILE}"
    else
      echo "TELEGRAM_CHAT_ID=\"${TG_CHAT}\"" >> "${ENV_FILE}"
    fi
  fi
  echo "  [OK] Telegram en .env (también puedes editarlo luego en Opciones de desarrollador)."
  echo "  Reiniciando backend para cargar variables..."
  load_nvm
  pm2 restart fiix-backend --update-env || true
else
  echo "  Omitido. Puedes configurarlo después en la app o en backend/.env."
fi

# 7d. nginx (puerto 80) + healthcheck cron
echo
echo "  Acceso sin :3000 (nginx → Express) y vigilancia Telegram si PM2/Postgres caen."
echo "  Requiere Telegram configurado (pregunta anterior o Opciones de Desarrollador) para las alertas."
DO_NGINX_HEALTH="$(ask "¿Instalar healthcheck cron + nginx? [s/N]" "N")"
if [[ "${DO_NGINX_HEALTH}" =~ ^[sS]$ ]]; then
  # --- nginx ---
  echo "  --> nginx..."
  if ! need_cmd nginx; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx || echo "  [AVISO] No se pudo instalar nginx."
  fi
  if need_cmd nginx; then
    NGINX_SRC="${APP_DIR}/deploy/nginx-fiix.conf"
    if [ -f "$NGINX_SRC" ]; then
      sudo cp "$NGINX_SRC" /etc/nginx/sites-available/fiix
      sudo ln -sf /etc/nginx/sites-available/fiix /etc/nginx/sites-enabled/fiix
      # Evitar conflicto con el default que también escucha :80
      if [ -L /etc/nginx/sites-enabled/default ] || [ -f /etc/nginx/sites-enabled/default ]; then
        sudo rm -f /etc/nginx/sites-enabled/default
      fi
      if sudo nginx -t; then
        sudo systemctl enable --now nginx
        sudo systemctl reload nginx
        echo "  [OK] nginx activo: http://lpet-cmms (o IP) → :3000"
      else
        echo "  [AVISO] nginx -t falló; revisa /etc/nginx/sites-available/fiix"
      fi
    else
      echo "  [AVISO] No está ${NGINX_SRC}; omite nginx."
    fi
    # Abrir 80 si ufw ya está activo (p. ej. abrieron 3000/5173 antes)
    if need_cmd ufw && sudo ufw status 2>/dev/null | grep -qi 'Status: active'; then
      sudo ufw allow 80/tcp comment 'FIIX nginx' || true
      echo "  [OK] ufw: permitido 80/tcp"
    fi
  fi

  # --- healthcheck cron ---
  echo "  --> healthcheck cron (cada 5 min)..."
  chmod +x "${APP_DIR}/scripts/healthcheck.sh" 2>/dev/null || true
  CRON_LINE="*/5 * * * * ${APP_DIR}/scripts/healthcheck.sh >> /tmp/fiix-healthcheck.log 2>&1"
  EXISTING_CRON="$(crontab -l 2>/dev/null || true)"
  FILTERED="$(echo "${EXISTING_CRON}" | grep -v 'scripts/healthcheck.sh' || true)"
  {
    echo "${FILTERED}"
    echo "${CRON_LINE}"
  } | grep -v '^$' | crontab - || echo "  [AVISO] No se pudo escribir crontab."
  echo "  [OK] Cron: ${CRON_LINE}"
  echo "  Prueba manual: ${APP_DIR}/scripts/healthcheck.sh"
else
  echo "  Omitido. Manual: README § nginx / healthcheck."
fi

# 7e. Tailscale
echo
echo "  Tailscale: VPN + MagicDNS/HTTPS (cámara QR en vivo en celular)."
DO_TS="$(ask "¿Instalar Tailscale en este servidor ahora? [s/N]" "N")"
if [[ "${DO_TS}" =~ ^[sS]$ ]]; then
  curl -fsSL https://tailscale.com/install.sh | sh
  TS_KEY="$(ask "Auth key de Tailscale (consola → Settings → Keys). Enter = solo 'tailscale up' interactivo" "")"
  if [ -n "${TS_KEY}" ]; then
    sudo tailscale up --auth-key="${TS_KEY}" || echo "  [AVISO] tailscale up con auth key falló."
  else
    echo "  Ejecuta cuando puedas:  sudo tailscale up"
    echo "  Luego en https://login.tailscale.com activa MagicDNS / HTTPS certificados."
  fi
  echo "  [OK] Cliente Tailscale instalado (revisa estado: tailscale status)."
else
  echo "  Omitido. Guía: https://tailscale.com/download/linux"
fi

# --- 8. Resumen ---
IP_LAN="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "=== [8/8] Instalación completada ==="
echo "UI + API (Express/PM2): http://${IP_LAN:-IP}:3000"
echo "Con nginx (si lo activaste): http://${IP_LAN:-IP}/  o  http://lpet-cmms/"
echo "Login seed (si lo corriste): admin@fiix.com / password123  → cámbialo"
echo
echo "Actualizaciones futuras (NO vuelve a pedir .env; no toca nginx):"
echo "  cd ${APP_DIR} && ./update.sh"
echo "=== Listo ==="
