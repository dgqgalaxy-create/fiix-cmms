#!/bin/sh
set -e

cd /app/backend

# Sincroniza el esquema de la base de datos (idempotente; equivale a install.sh).
# Si vas a restaurar un backup en lugar de una BD vacía, define SKIP_DB_PUSH=1.
if [ "${SKIP_DB_PUSH}" != "1" ]; then
  echo "[fiix-docker] Aplicando esquema de base de datos (prisma db push)..."
  npx prisma db push --accept-data-loss
fi

echo "[fiix-docker] Arrancando servidor en :${PORT:-3000}"
exec node dist/index.js
