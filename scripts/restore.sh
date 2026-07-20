#!/bin/bash
# Restaura un respaldo de FIIX CMMS (Ubuntu/Linux con bash): dump PostgreSQL + opcional uploads.
# El backend también expone esto desde Opciones de Desarrollador (POST /api/dev/restore).
# En Windows local usa el botón «Restaurar respaldo» de la app (requiere psql + tar).
#
# Uso:
#   ./scripts/restore.sh fiix_20260720_0215.sql.gz
#   ./scripts/restore.sh fiix_20260720_0215.sql.gz --no-uploads
#   BACKUP_DIR=/otra/ruta ./scripts/restore.sh fiix_20260720_0215.sql.gz
#
# ADVERTENCIA: sobrescribe la base de datos actual. Confirma antes de continuar.
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
  # Permitir ruta absoluta si el usuario pasó una ruta completa
  if [ -f "$FILE" ]; then
    SQL_PATH="$FILE"
  else
    echo "No se encontró ${SQL_PATH}" >&2
    exit 1
  fi
fi

if [ -z "${DATABASE_URL:-}" ] && [ -f "${APP_DIR}/backend/.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "${APP_DIR}/backend/.env" | tail -n 1 | cut -d '=' -f2- | sed -e 's/^"//' -e 's/"$//')"
fi
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fiix_cmms?schema=public}"

echo "=== Restaurar FIIX CMMS ==="
echo "Archivo: ${SQL_PATH}"
echo "Base:    ${DATABASE_URL%%@*}@…"
echo ""
echo "ADVERTENCIA: Esto sobrescribe los datos actuales de la base de datos."
read -r -p "Escribe RESTAURAR para continuar: " CONFIRM
if [ "$CONFIRM" != "RESTAURAR" ]; then
  echo "Cancelado."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql no está instalado. Instala postgresql-client." >&2
  exit 1
fi

echo "Restaurando base de datos..."
gunzip -c "${SQL_PATH}" | psql "${DATABASE_URL}" -v ON_ERROR_STOP=1
echo "  [OK] Base de datos restaurada."

if [ "$RESTORE_UPLOADS" -eq 1 ]; then
  STAMP="${BASE#fiix_}"
  STAMP="${STAMP%.sql.gz}"
  UPLOADS_FILE="${BACKUP_DIR}/uploads_${STAMP}.tar.gz"
  if [ -f "$UPLOADS_FILE" ]; then
    echo "Restaurando uploads..."
    tar -xzf "${UPLOADS_FILE}" -C "${APP_DIR}/backend"
    echo "  [OK] Uploads: ${UPLOADS_FILE}"
  else
    echo "  [AVISO] No existe ${UPLOADS_FILE}; se omitió uploads."
  fi
fi

echo "=== Restauración completada. Recarga la aplicación. ==="
