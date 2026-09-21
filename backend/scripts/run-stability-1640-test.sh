#!/usr/bin/env bash
# TEST_DATABASE_ADMIN_URL debe apuntar explícitamente a una instancia de pruebas.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${TEST_DATABASE_ADMIN_URL:?Indica una instancia PostgreSQL de pruebas terminada en /postgres}"
case "$TEST_DATABASE_ADMIN_URL" in */postgres) ;; *) echo 'La URL de prueba debe terminar en /postgres'; exit 2;; esac
test_db="fiix_cmms_test_stability_$$"
cleanup() { psql "$TEST_DATABASE_ADMIN_URL" -q -c "DROP DATABASE IF EXISTS \"$test_db\" WITH (FORCE)" >/dev/null 2>&1 || true; }
trap cleanup EXIT
psql "$TEST_DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE \"$test_db\""
export DATABASE_URL="${TEST_DATABASE_ADMIN_URL%/postgres}/$test_db"
export NODE_ENV=test
export JWT_SECRET=isolated-stability-test-only
node node_modules/prisma/build/index.js db push --url "$DATABASE_URL"
node node_modules/ts-node/dist/bin.js --transpile-only -P tests/tsconfig.json tests/stability1640.integration.ts
