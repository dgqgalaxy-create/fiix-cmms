#!/bin/sh
set -e

cd /app/backend

# Sincroniza el esquema de la base de datos (idempotente; equivale a install.sh).
# Si vas a restaurar un backup en lugar de una BD vacía, define SKIP_DB_PUSH=1.
if [ "${SKIP_DB_PUSH}" != "1" ]; then
  if [ "${ALLOW_DB_PUSH_DATA_LOSS}" = "1" ]; then
    echo "[fiix-docker] Aplicando esquema (prisma db push --accept-data-loss por ALLOW_DB_PUSH_DATA_LOSS=1)..."
    npx prisma db push --accept-data-loss
  else
    echo "[fiix-docker] Aplicando esquema (prisma db push, SIN pérdida de datos)..."
    # Sin --accept-data-loss: si el esquema requiere cambios destructivos, db push
    # falla y detenemos el arranque controladamente (no se pierden datos en silencio).
    if ! npx prisma db push; then
      echo "[fiix-docker] ERROR: el esquema pendiente requiere cambios destructivos." >&2
      echo "  Opciones: restaura un respaldo (SKIP_DB_PUSH=1), o si entiendes el riesgo," >&2
      echo "  reinicia con ALLOW_DB_PUSH_DATA_LOSS=1 para aplicar los cambios igualmente." >&2
      exit 1
    fi
  fi

  # Aplica el seed de usuarios por defecto (admin@fiix.com / password123).
  # Si el seed ya fue aplicado, los upsert no crean duplicados.
  echo "[fiix-docker] Aplicando seed de usuarios por defecto..."
  npx prisma db seed || true
fi

echo "[fiix-docker] Arrancando servidor en :${PORT:-3000}"
exec node dist/index.js
