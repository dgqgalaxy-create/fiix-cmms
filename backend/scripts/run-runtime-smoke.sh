#!/usr/bin/env bash
# Smoke del servidor REAL contra una base temporal (fiix_cmms_test_*):
# compila dist, arranca node dist/index.js en un puerto local, crea un admin,
# inicia sesión y verifica los endpoints core con la app levantada.
# NUNCA toca la base operativa; la base temporal se elimina al terminar.
set -euo pipefail
cd "$(dirname "$0")/.." # backend/

set -a
# shellcheck disable=SC1091
source .env
set +a

TEST_DB="fiix_cmms_test_smoke"
PORT="${SMOKE_PORT:-3199}"
BASE="${DATABASE_URL%%\?*}"
case "$BASE" in
  */fiix_cmms | */fiix_cmms/*) ;;
  *)
    echo "DATABASE_URL inesperada (${BASE}); abortando sin tocar nada." >&2
    exit 1
    ;;
esac
ADMIN_URL="${BASE%/fiix_cmms}/postgres"
TEST_URL="${BASE%/fiix_cmms}/${TEST_DB}?schema=public"

# Rol local (Homebrew): si el rol del .env no existe, usar el superusuario del sistema.
if ! psql "$ADMIN_URL" -q -c 'SELECT 1' >/dev/null 2>&1; then
  LOCAL_USER="$(whoami)"
  HOSTPORT="${BASE#*@}"
  HOSTPORT="${HOSTPORT%%/*}"
  ADMIN_URL="postgresql://${LOCAL_USER}@${HOSTPORT}/postgres"
  TEST_URL="postgresql://${LOCAL_USER}@${HOSTPORT}/${TEST_DB}?schema=public"
fi

export DATABASE_URL="$TEST_URL"
export PORT="$PORT"
export JWT_SECRET="${JWT_SECRET:-smoke-secret-not-for-prod}"

SRV_PID=""
cleanup() {
  if [ -n "${SRV_PID}" ]; then kill "${SRV_PID}" 2>/dev/null || true; fi
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS ${TEST_DB}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo ">> Compilando backend (dist)..."
npx tsc -p tsconfig.json >/dev/null

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS ${TEST_DB}" \
  -c "CREATE DATABASE ${TEST_DB}"
echo ">> Base temporal creada: ${TEST_DB}"
npx prisma db push --url "$TEST_URL" >/dev/null 2>&1

HASH="$(node -e "require('bcrypt').hash('Smoke2026*',10).then(h=>process.stdout.write(h))")"
SMOKE_DB_URL="${ADMIN_URL%/postgres}/${TEST_DB}"
psql "$SMOKE_DB_URL" -q -c "INSERT INTO \"User\"(id,name,email,password_hash,role,updated_at) VALUES (gen_random_uuid(),'Admin Smoke','admin@smoke.test','${HASH}','ADMINISTRADOR',now());"

echo ">> Arrancando servidor en :${PORT} (dist)..."
node dist/index.js > /tmp/fiix_smoke_server.log 2>&1 &
SRV_PID=$!

ok=0
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
if [ "${ok}" != "1" ]; then
  echo "ERROR: el servidor no arrancó. Log:" >&2
  tail -20 /tmp/fiix_smoke_server.log >&2
  exit 1
fi

echo ">> health: $(curl -s "http://127.0.0.1:${PORT}/api/health")"
TOKEN="$(curl -s -X POST "http://127.0.0.1:${PORT}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@smoke.test","password":"Smoke2026*"}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).token||'')}catch{console.log('')}})"
)"
if [ -z "${TOKEN}" ]; then
  echo "ERROR: login falló. Log:" >&2
  tail -20 /tmp/fiix_smoke_server.log >&2
  exit 1
fi
echo ">> login OK"

for ep in "/api/kpis?period=THIS_MONTH" "/api/work-orders?limit=1" "/api/inventory/summary" "/api/kpis/charts?period=THIS_YEAR"; do
  CODE="$(curl -s -o /tmp/fiix_smoke_body.json -w '%{http_code}' \
    "http://127.0.0.1:${PORT}${ep}" -H "Authorization: Bearer ${TOKEN}")"
  echo ">> ${ep} -> ${CODE}"
  if [ "${CODE}" != "200" ]; then
    echo "ERROR en ${ep}:" >&2
    head -c 400 /tmp/fiix_smoke_body.json >&2
    echo >&2
    exit 1
  fi
done
echo ">> Smoke completo OK ✔"
