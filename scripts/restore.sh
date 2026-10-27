#!/bin/bash
# ============================================================
# GTZ CMMS — Restaurar un respaldo (compatible con Docker)
# ============================================================
# Restaura un dump de PostgreSQL y opcionalmente los archivos subidos (uploads).
# ADVERTENCIA: Sobrescribe la base de datos actual.
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/fiix-backups}"
RESTORE_UPLOADS=1
FILE=""

for arg in "$@"; do
  case "$arg" in
    --no-uploads) RESTORE_UPLOADS=0 ;;
    -h|--help)
      echo "Uso: $0 <fiix_YYYYMMDD_HHMM.sql.gz> [--no-uploads]"
      exit 0
      ;;
    *)
      if [ -z "$FILE" ]; then FILE="$arg"; else
        echo "Argumento desconocido: $arg" >&2
        exit 1
      fi
      ;;
  esac
done

if [ -z "$FILE" ]; then
  echo "Uso: $0 <fiix_YYYYMMDD_HHMM.sql.gz> [--no-uploads]"
  echo "Respaldos en ${BACKUP_DIR}:"
  ls -1t "${BACKUP_DIR}"/fiix_*.sql.gz 2>/dev/null || echo "  (ninguno)"
  exit 1
fi

BASE="$(basename "$FILE")"
if [[ ! "$BASE" =~ ^fiix_[0-9]{8}_[0-9]{4}\.sql\.gz$ ]]; then
  echo "Nombre inválido: $BASE (esperado fiix_YYYYMMDD_HHMM.sql.gz)" >&2
  exit 1
fi

SQL_PATH="${BACKUP_DIR}/${BASE}"
if [ ! -f "$SQL_PATH" ]; then
  if [ -f "$FILE" ]; then
    SQL_PATH="$FILE"
  else
    echo "No se encontró ${SQL_PATH}" >&2
    exit 1
  fi
fi

# Detectar Docker Compose
COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif sudo docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="sudo docker compose"
fi

IS_DOCKER_RUNNING=0
if [ -n "$COMPOSE_CMD" ]; then
  if (cd "$APP_DIR" && $COMPOSE_CMD ps --services 2>/dev/null | grep -qw "db"); then
    IS_DOCKER_RUNNING=1
  fi
fi

echo "=== Restaurar GTZ CMMS ==="
echo "Archivo: ${SQL_PATH}"
echo "Modo:    $([ "$IS_DOCKER_RUNNING" -eq 1 ] && echo "Contenedor Docker (servicio db)" || echo "Local / Host")"
echo ""
echo "ADVERTENCIA: Esto sobrescribirá completamente los datos actuales de la base de datos."
read -r -p "Escribe RESTAURAR para continuar: " CONFIRM
if [ "$CONFIRM" != "RESTAURAR" ]; then
  echo "Operación cancelada."
  exit 1
fi

echo "Restaurando base de datos..."
GZ_SIZE="$(wc -c < "${SQL_PATH}")"
if [ "${GZ_SIZE}" -lt 64 ]; then
  echo "El archivo está vacío (${GZ_SIZE} bytes); no se restauró nada." >&2
  exit 1
fi

SQL_PREPARE="DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public; GRANT ALL ON SCHEMA public TO CURRENT_USER;"

if [ "$IS_DOCKER_RUNNING" -eq 1 ]; then
  {
    echo "$SQL_PREPARE"
    gunzip -c "${SQL_PATH}" | sed '/^SET transaction_timeout = 0;$/d'
  } | (cd "$APP_DIR" && $COMPOSE_CMD exec -T db psql -U postgres -d fiix_cmms -q -v ON_ERROR_STOP=1)
else
  if ! command -v psql >/dev/null 2>&1; then
    echo "psql no está instalado en el host ni hay contenedor Docker activo." >&2
    exit 1
  fi
  if [ -z "${DATABASE_URL:-}" ]; then
    if [ -f "${APP_DIR}/backend/.env" ]; then
      DATABASE_URL="$(grep -E '^DATABASE_URL=' "${APP_DIR}/backend/.env" | tail -n 1 | cut -d '=' -f2- | tr -d '"')"
    fi
  fi
  DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fiix_cmms?schema=public}"
  DATABASE_URL="$(printf '%s' "${DATABASE_URL}" | sed -E 's/([?&])schema=[^&]*//g; s/\?&/?/g; s/[?&]$//')"

  {
    echo "$SQL_PREPARE"
    gunzip -c "${SQL_PATH}" | sed '/^SET transaction_timeout = 0;$/d'
  } | psql -q "${DATABASE_URL}" -v ON_ERROR_STOP=1
fi
echo "  [OK] Base de datos restaurada."

if [ "$RESTORE_UPLOADS" -eq 1 ]; then
  STAMP="${BASE#fiix_}"
  STAMP="${STAMP%.sql.gz}"
  UPLOADS_FILE="${BACKUP_DIR}/uploads_${STAMP}.tar.gz"
  if [ -f "$UPLOADS_FILE" ]; then
    echo "Restaurando uploads..."
    if [ "$IS_DOCKER_RUNNING" -eq 1 ]; then
      (cd "$APP_DIR" && $COMPOSE_CMD exec -T app tar -xzf - -C /app/backend) < "$UPLOADS_FILE"
    else
      tar -xzf "${UPLOADS_FILE}" -C "${APP_DIR}/backend"
    fi
    echo "  [OK] Uploads restaurados: ${UPLOADS_FILE}"
  else
    echo "  [AVISO] No existe ${UPLOADS_FILE}; se omitió uploads."
  fi
fi

echo "=== Restauración completada con éxito ==="
