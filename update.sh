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

# --- Node: cargar nvm si existe; si no, usar node/npm del PATH ---
# En GitHub Actions (shell no interactivo) nvm a menudo no está en el PATH
# aunque ~/.nvm exista. No fallar solo por eso.
try_source_nvm() {
  local candidate="$1"
  if [ -s "$candidate" ]; then
    # shellcheck disable=SC1090
    . "$candidate"
    return 0
  fi
  return 1
}

NVM_CANDIDATES=()
if [ -n "${NVM_DIR:-}" ]; then
  NVM_CANDIDATES+=("${NVM_DIR}/nvm.sh")
fi
NVM_CANDIDATES+=("${HOME}/.nvm/nvm.sh")
NVM_CANDIDATES+=("/home/usuario/.nvm/nvm.sh")

NVM_LOADED=0
NVM_TRIED=()
for cand in "${NVM_CANDIDATES[@]}"; do
  NVM_TRIED+=("$cand")
  if try_source_nvm "$cand"; then
    export NVM_DIR="$(cd "$(dirname "$cand")" && pwd)"
    NVM_LOADED=1
    info "nvm cargado desde ${cand}"
    break
  fi
done

if [ "$NVM_LOADED" -eq 1 ]; then
  # Activar una versión conocida; no abortar si el alias falta.
  if command -v nvm >/dev/null 2>&1; then
    nvm use default >/dev/null 2>&1 \
      || nvm use 22 >/dev/null 2>&1 \
      || nvm use --lts >/dev/null 2>&1 \
      || nvm use node >/dev/null 2>&1 \
      || true
  fi
else
  info "nvm no encontrado; se usará node/npm del PATH si existen."
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || return 1
}

MISSING_CMDS=()
for cmd in git node npm npx pm2; do
  if ! need_cmd "$cmd"; then
    MISSING_CMDS+=("$cmd")
  fi
done

if [ "${#MISSING_CMDS[@]}" -gt 0 ]; then
  echo "  [ERROR] Faltan comandos tras intentar cargar Node: ${MISSING_CMDS[*]}" >&2
  echo "  PATH=${PATH}" >&2
  echo "  HOME=${HOME:-"(unset)"}" >&2
  echo "  NVM_DIR=${NVM_DIR:-"(unset)"}" >&2
  echo "  Archivos nvm intentados:" >&2
  for cand in "${NVM_TRIED[@]}"; do
    if [ -e "$cand" ]; then
      echo "    - ${cand} (existe, no se pudo cargar o no fue el elegido)" >&2
    else
      echo "    - ${cand} (no existe)" >&2
    fi
  done
  echo "  Ejecuta install.sh como el mismo usuario del runner, o instala Node 22+ y pm2 en el PATH." >&2
  exit 1
fi

ok "Node $(node -v) · npm $(npm -v) · pm2 $(pm2 -v 2>/dev/null || echo '?')"

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
# npm ci no reescribe package-lock.json (evita ensuciar el working tree
# y bloquear el próximo git pull del auto-deploy).
# Si NODE_ENV=production está en el entorno, npm omite devDependencies
# (nodemon/ts-node) y rompe arranques antiguos con "npm run dev".
npm ci --include=dev
npx prisma generate
# --accept-data-loss: necesario p. ej. al agregar unique nullable (client_request_id).
# Sin el flag, update.sh aborta con set -e y el servidor puede quedar en 502.
npx prisma db push --accept-data-loss
info "Compilando backend (dist/)..."
npm run build
ok "Backend listo"

# --- 3. Frontend ---
echo ">>> [3/5] Frontend (npm + build)..."
cd "${APP_DIR}/frontend"
npm ci
info "Compilando frontend (frontend/dist)..."
npm run build:app
ok "Frontend listo (dist)"

# --- 4. PM2 (solo backend: sirve API + SPA en :3000) ---
echo ">>> [4/5] Servicio PM2 (fiix-backend)..."

cd "${APP_DIR}/backend"
# Recrear el proceso con cwd correcto y arranque de producción (sin nodemon).
pm2 delete fiix-backend >/dev/null 2>&1 || true
pm2 start npm --name fiix-backend --cwd "${APP_DIR}/backend" -- run start

# Limpieza: instalaciones antiguas corrían Vite en :5173
if pm2 describe fiix-frontend >/dev/null 2>&1; then
  info "Eliminando proceso legado fiix-frontend (:5173)..."
  pm2 delete fiix-frontend >/dev/null 2>&1 || true
fi

pm2 save
ok "PM2 actualizado (solo fiix-backend; UI+API en :3000)"
pm2 status || true

# --- 5. Comprobación rápida ---
echo ">>> [5/5] Comprobación..."
sleep 3

if ! command -v curl >/dev/null 2>&1; then
  info "curl no está instalado; se omite el smoke test HTTP (opcional: sudo apt install curl)."
else
  http_code() {
    # Solo el código HTTP; si curl falla del todo, devolver 000 (sin concatenar).
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$1" 2>/dev/null || true)"
    if [ -z "$code" ] || [ "$code" = "000" ]; then
      echo "000"
    else
      echo "$code"
    fi
  }

  API_CODE="$(http_code 'http://127.0.0.1:3000/api/health')"
  UI_CODE="$(http_code 'http://127.0.0.1:3000/')"

  if [ "$API_CODE" = "000" ] || [ "$API_CODE" = "000000" ]; then
    die "El backend no responde en :3000. Revisa: pm2 logs fiix-backend --lines 50"
  fi
  if [ "$UI_CODE" = "000" ] || [ "$UI_CODE" = "000000" ]; then
    die "La interfaz (SPA) no responde en :3000/. Revisa: pm2 logs fiix-backend --lines 50"
  fi

  ok "API /api/health → HTTP ${API_CODE}"
  ok "SPA / → HTTP ${UI_CODE}"
fi

echo
# nginx: pregunta interactiva (evita olvidar client_max_body_size → 413 en zips).
# En CI / sin TTY no pregunta; se puede forzar con UPDATE_NGINX=1.
NGINX_SRC="${APP_DIR}/deploy/nginx-fiix.conf"
DO_NGINX="${UPDATE_NGINX:-}"
if [ -z "$DO_NGINX" ]; then
  if [ -t 0 ] && [ -z "${CI:-}" ] && [ -z "${GITHUB_ACTIONS:-}" ] && [ -f "$NGINX_SRC" ]; then
    echo
    read -r -p "¿Actualizar conf nginx (body 500M para zips de importación)? [s/N] " DO_NGINX_ANS || DO_NGINX_ANS="N"
    DO_NGINX="$DO_NGINX_ANS"
  else
    DO_NGINX="N"
  fi
fi
if [[ "${DO_NGINX}" =~ ^[sSyY1]$ ]]; then
  if command -v nginx >/dev/null 2>&1 && [ -f "$NGINX_SRC" ]; then
    info "Actualizando nginx desde deploy/nginx-fiix.conf..."
    sudo cp "$NGINX_SRC" /etc/nginx/sites-available/fiix
    sudo ln -sf /etc/nginx/sites-available/fiix /etc/nginx/sites-enabled/fiix
    if [ -L /etc/nginx/sites-enabled/default ] || [ -f /etc/nginx/sites-enabled/default ]; then
      sudo rm -f /etc/nginx/sites-enabled/default
    fi
    if sudo nginx -t; then
      sudo systemctl reload nginx
      ok "nginx recargado (client_max_body_size 500M)"
    else
      echo "  [AVISO] nginx -t falló; revisa /etc/nginx/sites-available/fiix"
    fi
  else
    echo "  [AVISO] nginx no está instalado o falta ${NGINX_SRC}; omite."
  fi
else
  info "nginx no modificado. Si el zip de importación falla con 413:"
  echo "    sudo cp ${APP_DIR}/deploy/nginx-fiix.conf /etc/nginx/sites-available/fiix"
  echo "    sudo nginx -t && sudo systemctl reload nginx"
  echo "  (o vuelve a correr update.sh y responde «s», o UPDATE_NGINX=1 ./update.sh)"
fi

echo
echo "=== Actualización completada con éxito (${AFTER_SHA}) ==="
echo "  .env y uploads/ se conservaron."
echo "  Express sigue en :3000 (nginx, si existe, hace de proxy en :80)."
echo "  Si algo falla en uso real: pm2 logs"
