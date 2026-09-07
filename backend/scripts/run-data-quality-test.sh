#!/usr/bin/env bash
# Prueba de integración AISLADA: calidad de datos.
# Crea una base temporal fiix_cmms_test_*, sincroniza esquema (db push), corre las
# pruebas con ts-node y elimina la base al terminar. NUNCA toca la base operativa.
set -euo pipefail
cd "$(dirname "$0")/.." # backend/

set -a
# shellcheck disable=SC1091
source .env
set +a

TEST_DB="fiix_cmms_test_quality"
BASE="${DATABASE_URL%%\?*}" # sin ?schema=...
case "$BASE" in
  */fiix_cmms | */fiix_cmms/*) ;;
  *)
    echo "DATABASE_URL inesperada (${BASE}); abortando sin tocar nada." >&2
    exit 1
    ;;
esac
ADMIN_URL="${BASE%/fiix_cmms}/postgres"
TEST_URL="${BASE%/fiix_cmms}/${TEST_DB}?schema=public"

# Si el rol del .env (p. ej. "postgres") no existe en este PostgreSQL local,
# se usa el superusuario del sistema (Homebrew: el usuario de macOS).
if ! psql "$ADMIN_URL" -q -c 'SELECT 1' >/dev/null 2>&1; then
  LOCAL_USER="$(whoami)"
  HOSTPORT="${BASE#*@}"              # localhost:5432/fiix_cmms
  HOSTPORT="${HOSTPORT%%/*}"         # localhost:5432
  echo ">> Rol del .env no disponible; usando superusuario local '${LOCAL_USER}'"
  ADMIN_URL="postgresql://${LOCAL_USER}@${HOSTPORT}/postgres"
  TEST_URL="postgresql://${LOCAL_USER}@${HOSTPORT}/${TEST_DB}?schema=public"
fi

cleanup() {
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS ${TEST_DB}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS ${TEST_DB}" \
  -c "CREATE DATABASE ${TEST_DB}"
echo ">> Base temporal creada: ${TEST_DB}"

echo ">> Sincronizando esquema a la base temporal (db push)…"
npx prisma db push --url "$TEST_URL"

echo ">> Ejecutando pruebas del calidad de datos…"
DATABASE_URL="$TEST_URL" npx ts-node --transpile-only -P tests/tsconfig.json tests/dataQuality.integration.ts
