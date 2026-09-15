#!/bin/sh
set -e

cd /app/backend

# Sincroniza el esquema de la base de datos (idempotente; equivale a install.sh).
# Si vas a restaurar un backup en lugar de una BD vacía, define SKIP_DB_PUSH=1.
if [ "${SKIP_DB_PUSH}" != "1" ]; then
  # psql no acepta ?schema= de la URI de Prisma (PG 15+).
  PGURL=$(printf '%s' "${DATABASE_URL}" | sed -E 's/([?&])schema=[^&]*//g; s/\?&/?/g; s/[?&]$//')
  TABLE_COUNT=$(psql -q "$PGURL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "")

  apply_additive() {
    echo "[fiix-docker] Aplicando cambios de esquema aditivos (idempotentes)..."
    for _mig in \
      /app/backend/prisma/migrations/20260907000000_inventory_tx_external_id/migration.sql \
      /app/backend/prisma/migrations/20260907010000_accumulated_time_ms_bigint/migration.sql; do
      if [ -f "${_mig}" ]; then
        npx prisma db execute --file "${_mig}"
      fi
    done
  }

  do_push() {
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
  }

  if [ "$TABLE_COUNT" = "0" ]; then
    # BD nueva/vacía: primero crear el esquema completo y luego los cambios aditivos
    # (que asumen tablas existentes; sobre esquema recién creado son no-op).
    echo "[fiix-docker] BD vacía: creando esquema base primero…"
    do_push
    apply_additive
  else
    # BD existente: primero los cambios aditivos para que db push no los marque
    # como posible pérdida de datos.
    apply_additive
    do_push
  fi

  # Aplica el seed de usuarios por defecto (admin@fiix.com / password123).
  # Si el seed ya fue aplicado, los upsert no crean duplicados.
  echo "[fiix-docker] Aplicando seed de usuarios por defecto..."
  npx prisma db seed || true
fi

echo "[fiix-docker] Arrancando servidor en :${PORT:-3000}"
exec node dist/index.js
