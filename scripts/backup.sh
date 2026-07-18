#!/bin/bash
# Respaldo manual de FIIX CMMS (Ubuntu/Linux con bash): dump de PostgreSQL + carpeta backend/uploads.
# El backend ya programa este mismo respaldo automáticamente todos los días a las 2:15 AM
# (backend/src/utils/backupService.ts, multiplataforma: no usa /bin/bash) y también lo puede
# disparar el botón "Crear respaldo ahora" en Opciones de Desarrollador.
# En Windows local no uses este script; usa el botón de la app (requiere pg_dump + tar).
# Este script es útil para correrlo a mano o desde un cron externo en el servidor Ubuntu.
#
# Uso:
#   ./scripts/backup.sh
#   BACKUP_DIR=/otra/ruta ./scripts/backup.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/fiix-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M)"

mkdir -p "${BACKUP_DIR}"

echo "=== Respaldo FIIX CMMS (${TIMESTAMP}) ==="
echo "Directorio de respaldos: ${BACKUP_DIR}"

# --- Cargar DATABASE_URL desde backend/.env si no viene ya en el entorno ---
if [ -z "${DATABASE_URL:-}" ] && [ -f "${APP_DIR}/backend/.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "${APP_DIR}/backend/.env" | tail -n 1 | cut -d '=' -f2- | sed -e 's/^"//' -e 's/"$//')"
fi
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fiix_cmms?schema=public}"

# --- Dump de la base de datos ---
DUMP_FILE="${BACKUP_DIR}/fiix_${TIMESTAMP}.sql.gz"
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "${DATABASE_URL}" | gzip > "${DUMP_FILE}"
  echo "  [OK] Base de datos: ${DUMP_FILE}"
else
  echo "  [AVISO] pg_dump no está instalado; se omite el respaldo de base de datos."
fi

# --- Carpeta de uploads (evidencias, fotos, firmas) ---
UPLOADS_DIR="${APP_DIR}/backend/uploads"
if [ -d "${UPLOADS_DIR}" ]; then
  UPLOADS_FILE="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
  tar -czf "${UPLOADS_FILE}" -C "${APP_DIR}/backend" uploads
  echo "  [OK] Uploads: ${UPLOADS_FILE}"
else
  echo "  [AVISO] No existe ${UPLOADS_DIR}; se omite el respaldo de uploads."
fi

# --- Retención: conserva solo los respaldos de los últimos KEEP_DAYS días ---
find "${BACKUP_DIR}" -maxdepth 1 -type f \( -name 'fiix_*.sql.gz' -o -name 'uploads_*.tar.gz' \) -mtime "+${KEEP_DAYS}" -delete

echo "=== Respaldo completado ==="
