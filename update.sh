#!/bin/bash
# Actualización de GTZ CMMS en un servidor YA instalado (no sustituye install.sh).
# Conserva backend/.env y backend/uploads/ (no van en Git).
# Producción: compila backend (dist/) + frontend (dist/) y arranca con node (sin nodemon).
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_MAJOR="${NODE_MAJOR:-22}"

ok()   { echo "  [OK] $*"; }
info() { echo "  --> $*"; }
die()  { echo "  [ERROR] $*" >&2; exit 1; }

echo "=== Actualización GTZ CMMS ==="
echo "Directorio: ${APP_DIR}"
echo

# --- Node: cargar nvm si existe; si no, usar node/npm del PATH ---
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

if [ "$NVM_LOADED" -eq 1 ] && command -v nvm >/dev/null 2>&1; then
  # Preferir Node 22+; instalar si falta (no abortar si la red falla).
  nvm install "${NODE_MAJOR}" >/dev/null 2>&1 || true
  nvm use "${NODE_MAJOR}" >/dev/null 2>&1 \
    || nvm use default >/dev/null 2>&1 \
    || nvm use --lts >/dev/null 2>&1 \
    || nvm use node >/dev/null 2>&1 \
    || true
  nvm alias default "${NODE_MAJOR}" >/dev/null 2>&1 || true
else
  info "nvm no encontrado; se usará node/npm del PATH si existen."
fi

# Si el PATH sigue en Node < 22 (p. ej. /usr/bin/node del sistema), forzar binario 22.
node_major_now() { node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0; }
if [ "$(node_major_now)" -lt "${NODE_MAJOR}" ]; then
  NVM22_BIN="$(ls -d "${HOME}/.nvm/versions/node"/v"${NODE_MAJOR}".*/bin 2>/dev/null | sort -V | tail -n1 || true)"
  if [ -n "${NVM22_BIN}" ] && [ -x "${NVM22_BIN}/node" ]; then
    export PATH="${NVM22_BIN}:${PATH}"
    hash -r 2>/dev/null || true
    info "PATH → Node nvm ${NODE_MAJOR}: $(node -v)"
  fi
fi
if [ "$(node_major_now)" -lt "${NODE_MAJOR}" ]; then
  NODE_DIST_VERSION="${NODE_DIST_VERSION:-v22.22.0}"
  NODE_LOCAL="${HOME}/.local/node-${NODE_DIST_VERSION}"
  if [ ! -x "${NODE_LOCAL}/bin/node" ]; then
    info "Descargando Node ${NODE_DIST_VERSION} (tarball)..."
    mkdir -p "${HOME}/.local"
    TMP_NODE="/tmp/fiix-node-${NODE_DIST_VERSION}.tar.xz"
    curl -fsSL "https://nodejs.org/dist/${NODE_DIST_VERSION}/node-${NODE_DIST_VERSION}-linux-x64.tar.xz" -o "${TMP_NODE}"
    rm -rf "${NODE_LOCAL}" "${HOME}/.local/node-${NODE_DIST_VERSION}-linux-x64"
    tar -xJf "${TMP_NODE}" -C "${HOME}/.local"
    mv "${HOME}/.local/node-${NODE_DIST_VERSION}-linux-x64" "${NODE_LOCAL}"
    rm -f "${TMP_NODE}"
  fi
  export PATH="${NODE_LOCAL}/bin:${PATH}"
  hash -r 2>/dev/null || true
  info "PATH → Node tarball: $(node -v)"
fi
if [ "$(node_major_now)" -lt "${NODE_MAJOR}" ]; then
  die "Se requiere Node >= ${NODE_MAJOR} (actual: $(node -v 2>/dev/null || echo ausente))"
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
  echo "  Ejecuta install.sh como el mismo usuario del runner, o instala Node ${NODE_MAJOR}+ y pm2." >&2
  exit 1
fi

ok "Node $(node -v) · npm $(npm -v) · pm2 $(pm2 -v 2>/dev/null || echo '?')"

# Respaldos/restore necesitan pg_dump/psql con versión >= la del servidor (en CasaOS suele ser PG 17).
ensure_pg_client() {
  local major="${1:-}"
  if need_cmd apt-get; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get update -y >/dev/null 2>&1 || true
    if [ -n "$major" ]; then
      # Repo oficial PGDG (Ubuntu LTS no trae client-17 por defecto).
      if ! apt-cache show "postgresql-client-${major}" >/dev/null 2>&1; then
        info "Añadiendo repo apt.postgresql.org para cliente ${major}..."
        sudo apt-get install -y curl ca-certificates >/dev/null 2>&1 || true
        sudo install -d /usr/share/postgresql-common/pgdg
        sudo curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
          https://www.postgresql.org/media/keys/ACCC4CF8.asc || true
        . /etc/os-release
        echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
          | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
        sudo apt-get update -y >/dev/null 2>&1 || true
      fi
      if sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "postgresql-client-${major}"; then
        ok "postgresql-client-${major} instalado"
        return 0
      fi
    fi
    if sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-client; then
      ok "postgresql-client instalado ($(pg_dump --version 2>/dev/null | head -n1 || echo OK))"
      return 0
    fi
  fi
  return 1
}

# Detectar major del servidor vía DATABASE_URL (si existe .env).
detect_pg_server_major() {
  local env_file="${APP_DIR}/backend/.env"
  [ -f "$env_file" ] || return 1
  local url
  url="$(grep -E '^DATABASE_URL=' "$env_file" | tail -n 1 | cut -d '=' -f2- | sed -e 's/^"//' -e 's/"$//' -e 's/?schema=public//' -e 's/[?&]schema=[^&]*//g')"
  [ -n "$url" ] || return 1
  if need_cmd psql; then
    psql "$url" -tAc "SHOW server_version_num" 2>/dev/null | head -n1 | awk '{ print int($1/10000) }'
  fi
}

if ! need_cmd pg_dump || ! need_cmd psql; then
  echo ">>> Cliente PostgreSQL (pg_dump/psql) ausente — instalando..."
  PG_MAJOR="$(detect_pg_server_major || true)"
  if ! ensure_pg_client "${PG_MAJOR}"; then
    echo "  [AVISO] Instala a mano un cliente >= tu servidor, p. ej. postgresql-client-17"
  fi
else
  ok "pg_dump en PATH: $(pg_dump --version | head -n1)"
  # Si el major del PATH es menor que el del servidor, instalar client coincidente.
  PG_MAJOR="$(detect_pg_server_major || true)"
  DUMP_MAJOR="$(pg_dump --version 2>/dev/null | grep -oE '[0-9]+' | head -n1 || true)"
  if [ -n "${PG_MAJOR:-}" ] && [ -n "${DUMP_MAJOR:-}" ] && [ "$DUMP_MAJOR" -lt "$PG_MAJOR" ] 2>/dev/null; then
    echo ">>> pg_dump ${DUMP_MAJOR} < servidor ${PG_MAJOR} — instalando postgresql-client-${PG_MAJOR}..."
    ensure_pg_client "$PG_MAJOR" || echo "  [AVISO] Instala: sudo apt install -y postgresql-client-${PG_MAJOR}"
  fi
  if [ -x "/usr/lib/postgresql/${PG_MAJOR:-17}/bin/pg_dump" ]; then
    ok "pg_dump ${PG_MAJOR:-17} en /usr/lib/postgresql/${PG_MAJOR:-17}/bin/pg_dump"
  fi
fi

[ -d "${APP_DIR}/.git" ] || die "No existe el repo en ${APP_DIR}. Corre primero ./install.sh"
[ -f "${APP_DIR}/backend/.env" ] || die "Falta ${APP_DIR}/backend/.env — no se puede actualizar sin credenciales."

cd "${APP_DIR}"

# --- 1. Código ---
echo ">>> [1/5] Código desde GitHub..."
# Descarta cambios locales en archivos trackeados (evita conflictos al pull).
# No toca .env ni uploads/ (están en .gitignore).
git restore .
chmod +x \
  "${APP_DIR}/update.sh" \
  "${APP_DIR}/install.sh" \
  "${APP_DIR}/scripts/backup.sh" \
  "${APP_DIR}/scripts/restore.sh" \
  "${APP_DIR}/scripts/healthcheck.sh" \
  "${APP_DIR}/scripts/ensure-vapid-env.sh" \
  "${APP_DIR}/scripts/gha-runner-watchdog.sh" \
  "${APP_DIR}/scripts/install-gha-runner-watchdog.sh" \
  "${APP_DIR}/scripts/ci-typecheck.sh" \
  2>/dev/null || true
git status --short || true

BEFORE_SHA="$(git rev-parse --short HEAD)"
info "Commit actual: ${BEFORE_SHA}"

if ! git pull --ff-only; then
  die "git pull falló (¿conflictos, divergencia o red?). Revisa el repo a mano."
fi

# Tras el pull, volver a marcar ejecutables (git puede perder el bit +x).
chmod +x \
  "${APP_DIR}/update.sh" \
  "${APP_DIR}/install.sh" \
  "${APP_DIR}/scripts/backup.sh" \
  "${APP_DIR}/scripts/restore.sh" \
  "${APP_DIR}/scripts/healthcheck.sh" \
  "${APP_DIR}/scripts/ensure-vapid-env.sh" \
  "${APP_DIR}/scripts/gha-runner-watchdog.sh" \
  "${APP_DIR}/scripts/install-gha-runner-watchdog.sh" \
  "${APP_DIR}/scripts/ci-typecheck.sh" \
  2>/dev/null || true

AFTER_SHA="$(git rev-parse --short HEAD)"
if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
  ok "Ya estabas en el último commit (${AFTER_SHA})."
else
  ok "Actualizado ${BEFORE_SHA} → ${AFTER_SHA}"
fi

# --- 2. Backend ---
echo ">>> [2/5] Backend (npm + Prisma + build)..."
cd "${APP_DIR}/backend"
mkdir -p uploads
# Si NODE_ENV=production está en el entorno, forzar include=dev para herramientas de build (tsc/prisma CLI).
unset NODE_ENV || true
npm ci --include=dev
# Web Push: si faltan VAPID_* en .env, generarlas (no sobrescribe las existentes).
chmod +x "${APP_DIR}/scripts/ensure-vapid-env.sh" 2>/dev/null || true
"${APP_DIR}/scripts/ensure-vapid-env.sh" "${APP_DIR}/backend/.env" || true
npx prisma generate
# --accept-data-loss: cambios de schema (p. ej. unique nuevo) no deben abortar el deploy.
npx prisma db push --accept-data-loss
# One-shot: congelar unit_cost de consumos OT históricos (null/0 → catálogo). Solo una vez por servidor.
FREEZE_COST_MARKER="${APP_DIR}/backend/data/.freeze_wo_parts_unit_cost_v151"
if [ ! -f "${FREEZE_COST_MARKER}" ]; then
  info "Backfill one-shot: congelar costos de refacciones OT (v1.51.0)..."
  mkdir -p "${APP_DIR}/backend/data"
  if npx prisma db execute --file "${APP_DIR}/backend/prisma/migrations/20260803160000_freeze_wo_parts_unit_cost/migration.sql"; then
    touch "${FREEZE_COST_MARKER}"
    ok "Backfill de costos OT aplicado"
  else
    warn "No se pudo aplicar backfill de costos OT (se reintentará en el próximo update.sh)"
  fi
fi
info "Compilando backend (dist/)..."
npx tsc --noEmit
npm run build
if [ ! -f "${APP_DIR}/backend/dist/index.js" ]; then
  die "No existe backend/dist/index.js tras tsc. Revisa tsconfig (rootDir=src)."
fi
ok "Backend listo"

# --- 3. Frontend ---
echo ">>> [3/5] Frontend (npm + build)..."
cd "${APP_DIR}/frontend"
unset NODE_ENV || true
npm ci
info "Compilando frontend (frontend/dist)..."
npm run build:app
if [ ! -f "${APP_DIR}/frontend/dist/index.html" ]; then
  die "No existe frontend/dist/index.html tras el build."
fi
ok "Frontend listo (dist)"

# --- 4. PM2 (solo backend: sirve API + SPA en :3000) ---
echo ">>> [4/5] Servicio PM2 (fiix-backend)..."

cd "${APP_DIR}/backend"
# Arranque directo con node (sin npm/nodemon): estable en producción y en Actions.
pm2 delete fiix-backend >/dev/null 2>&1 || true
pm2 start "${APP_DIR}/backend/dist/index.js" \
  --name fiix-backend \
  --cwd "${APP_DIR}/backend"

# Limpieza: instalaciones antiguas corrían Vite en :5173
if pm2 describe fiix-frontend >/dev/null 2>&1; then
  info "Eliminando proceso legado fiix-frontend (:5173)..."
  pm2 delete fiix-frontend >/dev/null 2>&1 || true
fi

pm2 save
ok "PM2 actualizado (fiix-backend → node dist/index.js; UI+API en :3000)"
pm2 status || true

# --- 5. Comprobación rápida (reintentos: Node tarda unos segundos en escuchar) ---
echo ">>> [5/5] Comprobación..."

http_code() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 "$1" 2>/dev/null || true)"
  if [ -z "$code" ] || [[ "$code" == 000* ]]; then
    echo "000"
  else
    echo "$code"
  fi
}

wait_http_ok() {
  local url="$1"
  local label="$2"
  local i code
  for i in $(seq 1 15); do
    code="$(http_code "$url")"
    if [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
      ok "${label} → HTTP ${code}"
      return 0
    fi
    sleep 2
  done
  echo "  Último código: ${code:-000}" >&2
  die "${label} no responde en :3000. Revisa: pm2 logs fiix-backend --lines 80"
}

if ! command -v curl >/dev/null 2>&1; then
  info "curl no está instalado; se omite el smoke test HTTP (opcional: sudo apt install curl)."
else
  wait_http_ok 'http://127.0.0.1:3000/api/health' 'API /api/health'
  wait_http_ok 'http://127.0.0.1:3000/' 'SPA /'
fi

echo
# nginx: pregunta interactiva (evita olvidar client_max_body_size → 413 en zips).
# En CI / sin TTY no pregunta; se puede forzar con UPDATE_NGINX=1.
NGINX_SRC="${APP_DIR}/deploy/nginx-fiix.conf"
DO_NGINX="${UPDATE_NGINX:-}"
if [ -z "$DO_NGINX" ]; then
  if [ -t 0 ] && [ -z "${CI:-}" ] && [ -z "${GITHUB_ACTIONS:-}" ] && [ -f "$NGINX_SRC" ]; then
    echo
    read -r -p "¿Actualizar conf nginx (body 1100M + timeouts 120m para zips)? [s/N] " DO_NGINX_ANS || DO_NGINX_ANS="N"
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
      ok "nginx recargado (client_max_body_size 1100M, timeouts 120m/120m)"
    else
      echo "  [AVISO] nginx -t falló; revisa /etc/nginx/sites-available/fiix"
    fi
  else
    echo "  [AVISO] nginx no está instalado o falta ${NGINX_SRC}; omite."
  fi
else
  info "nginx no modificado. Si el zip de importación falla con 413 / 408 / Network Error:"
  echo "    sudo cp ${APP_DIR}/deploy/nginx-fiix.conf /etc/nginx/sites-available/fiix"
  echo "    sudo nginx -t && sudo systemctl reload nginx"
  echo "  (o UPDATE_NGINX=1 ./update.sh)"
fi

echo
echo "=== Actualización completada con éxito (${AFTER_SHA}) ==="
echo "  .env y uploads/ se conservaron (la BD no se vacía)."
echo "  Express en :3000 (nginx, si existe, proxy en :80)."
echo "  Si algo falla: pm2 logs fiix-backend --lines 80"
