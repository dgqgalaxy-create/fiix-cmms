#!/bin/bash
# ============================================================
# GTZ CMMS — Respaldo manual (compatible con Docker)
# ============================================================
# Dump de PostgreSQL + compresión de uploads.
# Nota: La aplicación también realiza este respaldo automáticamente
# todos los días a las 2:15 AM y mediante el botón en Opciones de Desarrollador.
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/fiix-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M)"

mkdir -p "${BACKUP_DIR}"

echo "=== Respaldo GTZ CMMS (${TIMESTAMP}) ==="
echo "Directorio de respaldos: ${BACKUP_DIR}"

DUMP_FILE="${BACKUP_DIR}/fiix_${TIMESTAMP}.sql.gz"
UPLOADS_FILE="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"

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

# --- 1. Respaldo de Base de Datos ---
if [ "$IS_DOCKER_RUNNING" -eq 1 ]; then
  echo "  --> Generando dump de PostgreSQL desde el contenedor Docker 'db'..."
  (cd "$APP_DIR" && $COMPOSE_CMD exec -T db pg_dump -U postgres -d fiix_cmms --no-owner --no-acl) | gzip > "${DUMP_FILE}"
else
  # Cargar variables locales
  if [ -z "${DATABASE_URL:-}" ]; then
    if [ -f "${APP_DIR}/.env" ]; then
      DB_PASS="$(grep -E '^DB_PASSWORD=' "${APP_DIR}/.env" | tail -n1 | cut -d'=' -f2- | tr -d ' "' || echo 'postgres')"
      DATABASE_URL="postgresql://postgres:${DB_PASS}@localhost:5432/fiix_cmms?schema=public"
    elif [ -f "${APP_DIR}/backend/.env" ]; then
      DATABASE_URL="$(grep -E '^DATABASE_URL=' "${APP_DIR}/backend/.env" | tail -n1 | cut -d'=' -f2- | tr -d '"')"
    fi
  fi
  DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fiix_cmms?schema=public}"
  DATABASE_URL="$(printf '%s' "${DATABASE_URL}" | sed -E 's/([?&])schema=[^&]*//g; s/\?&/?/g; s/[?&]$//')"

  if command -v pg_dump >/dev/null 2>&1; then
    echo "  --> Generando dump usando pg_dump del host..."
    pg_dump --no-owner --no-acl "${DATABASE_URL}" | gzip > "${DUMP_FILE}"
  else
    echo "  [AVISO] Ni el contenedor Docker ni pg_dump en host están disponibles; se omite respaldo de BD."
  fi
fi

if [ -s "${DUMP_FILE}" ] && [ "$(wc -c < "${DUMP_FILE}")" -ge 64 ]; then
  echo "  [OK] Base de datos guardada en: ${DUMP_FILE}"
else
  rm -f "${DUMP_FILE}"
  echo "  [ERROR] El archivo de dump no se generó correctamente." >&2
fi

# --- 2. Respaldo de Archivos Subidos (Uploads) ---
if [ "$IS_DOCKER_RUNNING" -eq 1 ]; then
  echo "  --> Empaquetando uploads desde el contenedor 'app'..."
  (cd "$APP_DIR" && $COMPOSE_CMD exec -T app tar -czf - -C /app/backend uploads 2>/dev/null) > "${UPLOADS_FILE}" || true
elif [ -d "${APP_DIR}/backend/uploads" ]; then
  echo "  --> Empaquetando uploads desde el directorio local..."
  tar -czf "${UPLOADS_FILE}" -C "${APP_DIR}/backend" uploads
fi

if [ -s "${UPLOADS_FILE}" ]; then
  echo "  [OK] Uploads guardados en: ${UPLOADS_FILE}"
fi

# --- 3. Retención ---
find "${BACKUP_DIR}" -maxdepth 1 -type f \( -name 'fiix_*.sql.gz' -o -name 'uploads_*.tar.gz' \) -mtime "+${KEEP_DAYS}" -delete

echo "=== Respaldo completado con éxito ==="
