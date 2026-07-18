#!/bin/bash
# Actualización de FIIX CMMS en un servidor YA instalado (no sustituye install.sh).
# Conserva backend/.env y backend/uploads/ (no van en Git).
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ok()   { echo "  [OK] $*"; }
info() { echo "  --> $*"; }
die()  { echo "  [ERROR] $*" >&2; exit 1; }

echo "=== Actualización FIIX CMMS ==="
echo "Directorio: ${APP_DIR}"
echo

# --- Node (nvm) ---
export NVM_DIR="${HOME}/.nvm"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR}/nvm.sh"
else
  die "No se encontró nvm en ${NVM_DIR}. Ejecuta install.sh o instala Node/nvm."
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Falta el comando '$1' en el PATH."
}

need_cmd git
need_cmd npm
need_cmd npx
need_cmd pm2
need_cmd node

[ -d "${APP_DIR}/.git" ] || die "No existe el repo en ${APP_DIR}. Corre primero ./install.sh"
[ -f "${APP_DIR}/backend/.env" ] || die "Falta ${APP_DIR}/backend/.env — no se puede actualizar sin credenciales."

cd "${APP_DIR}"

# --- 1. Código ---
echo ">>> [1/5] Código desde GitHub..."
# Descarta cambios locales en archivos trackeados (evita conflictos al pull).
# No toca .env ni uploads/ (están en .gitignore).
git restore .
git status --short || true

BEFORE_SHA="$(git rev-parse --short HEAD)"
info "Commit actual: ${BEFORE_SHA}"

if ! git pull --ff-only; then
  die "git pull falló (¿conflictos, divergencia o red?). Revisa el repo a mano."
fi

AFTER_SHA="$(git rev-parse --short HEAD)"
if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
  ok "Ya estabas en el último commit (${AFTER_SHA})."
else
  ok "Actualizado ${BEFORE_SHA} → ${AFTER_SHA}"
fi

# --- 2. Backend ---
echo ">>> [2/5] Backend (npm + Prisma)..."
cd "${APP_DIR}/backend"
mkdir -p uploads
npm install
npx prisma generate
npx prisma db push
ok "Backend listo"

# --- 3. Frontend ---
echo ">>> [3/5] Frontend (npm)..."
cd "${APP_DIR}/frontend"
npm install
ok "Frontend listo"

# --- 4. PM2 ---
echo ">>> [4/5] Servicios PM2..."

cd "${APP_DIR}/backend"
if pm2 describe fiix-backend >/dev/null 2>&1; then
  info "Reiniciando fiix-backend..."
  pm2 restart fiix-backend --update-env
else
  info "No existía fiix-backend; iniciando..."
  pm2 start npm --name fiix-backend -- run dev
fi

cd "${APP_DIR}/frontend"
# Recrear frontend para garantizar --host 0.0.0.0 (acceso desde otros dispositivos)
info "Recreando fiix-frontend con --host 0.0.0.0..."
pm2 delete fiix-frontend >/dev/null 2>&1 || true
pm2 start npm --name fiix-frontend -- run dev -- --host 0.0.0.0 --port 5173

pm2 save
ok "PM2 actualizado"
pm2 status || true

# --- 5. Comprobación rápida ---
echo ">>> [5/5] Comprobación..."
sleep 3

if ! command -v curl >/dev/null 2>&1; then
  info "curl no está instalado; se omite el smoke test HTTP (opcional: sudo apt install curl)."
else
  http_code() {
    curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$1" 2>/dev/null || echo '000'
  }

  API_CODE="$(http_code 'http://127.0.0.1:3000/api/health')"
  UI_CODE="$(http_code 'http://127.0.0.1:5173/')"

  if [ "$API_CODE" = "000" ]; then
    die "El backend no responde en :3000. Revisa: pm2 logs fiix-backend --lines 50"
  fi
  if [ "$UI_CODE" = "000" ]; then
    die "El frontend no responde en :5173. Revisa: pm2 logs fiix-frontend --lines 50"
  fi

  ok "Backend /api/health → HTTP ${API_CODE}"
  ok "Frontend / → HTTP ${UI_CODE}"
fi

echo
echo "=== Actualización completada con éxito (${AFTER_SHA}) ==="
echo "  .env y uploads/ se conservaron."
echo "  Si algo falla en uso real: pm2 logs"
