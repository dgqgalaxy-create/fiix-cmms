#!/bin/bash
# ============================================================
# GTZ CMMS — Actualización y Despliegue con Docker Compose
# ============================================================
# Actualiza el código desde Git, retira procesos PM2 legados si existían,
# reconstruye los contenedores en Docker y valida la salud de la API.
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${APP_DIR}"

ok()   { echo "  [OK] $*"; }
info() { echo "  --> $*"; }
warn() { echo "  [AVISO] $*" >&2; }
die()  { echo "  [ERROR] $*" >&2; exit 1; }

echo "=== Actualización GTZ CMMS (Docker Compose) ==="
echo "Directorio: ${APP_DIR}"
echo

# --- 1. Detectar Docker y Docker Compose ---
DOCKER_CMD="docker"
COMPOSE_CMD=""

if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  fi
fi

# Probar si se requiere sudo para acceder al socket de Docker
if [ -z "${COMPOSE_CMD}" ]; then
  if sudo docker compose version >/dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
    COMPOSE_CMD="sudo docker compose"
  elif sudo docker-compose version >/dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
    COMPOSE_CMD="sudo docker-compose"
  else
    die "Docker o Docker Compose no están instalados. Instala Docker con './install.sh' o 'sudo apt install docker.io docker-compose-v2'."
  fi
elif ! docker info >/dev/null 2>&1; then
  if sudo docker info >/dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
    COMPOSE_CMD="sudo ${COMPOSE_CMD}"
  else
    die "No se puede comunicar con el servicio Docker. Verifica que el demonio esté activo (sudo systemctl start docker)."
  fi
fi

ok "Docker y Docker Compose listos (${COMPOSE_CMD})"

# --- 2. Transición: Retirar procesos PM2 heredados para evitar colisión en puerto 3000 ---
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe fiix-backend >/dev/null 2>&1 || pm2 describe fiix-frontend >/dev/null 2>&1; then
    info "Detectado proceso PM2 heredado. Deteniendo y eliminando para liberar el puerto 3000..."
    pm2 delete fiix-backend >/dev/null 2>&1 || true
    pm2 delete fiix-frontend >/dev/null 2>&1 || true
    pm2 save >/dev/null 2>&1 || true
    ok "Procesos PM2 eliminados con éxito. El servicio ahora corre 100% en Docker."
  fi
fi

# --- 3. Actualizar repositorio Git ---
echo ">>> [1/4] Descargando cambios desde GitHub..."
git restore . 2>/dev/null || true
BEFORE_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "inicial")"

if ! git pull --ff-only origin main; then
  die "git pull falló. Verifica el estado local con 'git status' o resuelve posibles conflictos."
fi

AFTER_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo "actual")"
if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
  ok "El repositorio ya estaba en el último commit (${AFTER_SHA})."
else
  ok "Código actualizado: ${BEFORE_SHA} → ${AFTER_SHA}"
fi

# Restaurar permisos ejecutables a los scripts
chmod +x "${APP_DIR}/update.sh" "${APP_DIR}/install.sh" "${APP_DIR}/scripts/"*.sh 2>/dev/null || true

# --- 4. Asegurar archivo .env en la raíz ---
echo ">>> [2/4] Verificando archivo de configuración (.env)..."
if [ ! -f "${APP_DIR}/.env" ]; then
  if [ -f "${APP_DIR}/backend/.env" ]; then
    info "Migrando backend/.env a .env en la raíz para Docker Compose..."
    cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"

    # Extraer contraseña de base de datos si venía en DATABASE_URL
    OLD_DB_URL="$(grep -E '^DATABASE_URL=' "${APP_DIR}/backend/.env" | tail -n1 | cut -d'=' -f2- | tr -d '"' || true)"
    if [ -n "$OLD_DB_URL" ]; then
      OLD_PASS="$(echo "$OLD_DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p' || true)"
      if [ -n "$OLD_PASS" ]; then
        sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${OLD_PASS}|" "${APP_DIR}/.env"
      fi
    fi

    # Extraer JWT_SECRET
    OLD_JWT="$(grep -E '^JWT_SECRET=' "${APP_DIR}/backend/.env" | tail -n1 | cut -d'=' -f2- | tr -d '"' || true)"
    if [ -n "$OLD_JWT" ]; then
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${OLD_JWT}|" "${APP_DIR}/.env"
    fi

    # Extraer VAPID
    for var in VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT; do
      val="$(grep -E "^${var}=" "${APP_DIR}/backend/.env" | tail -n1 | cut -d'=' -f2- | tr -d '"' || true)"
      if [ -n "$val" ]; then
        sed -i "s|^# *${var}=.*|${var}=\"${val}\"|" "${APP_DIR}/.env"
        sed -i "s|^${var}=.*|${var}=\"${val}\"|" "${APP_DIR}/.env"
      fi
    done
    ok ".env generado automáticamente a partir de backend/.env"
  else
    warn "No existe .env en la raíz. Creando desde .env.example..."
    cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
    warn "Por favor edita ${APP_DIR}/.env y define DB_PASSWORD y JWT_SECRET antes de continuar."
  fi
fi

# --- 5. Construcción y despliegue de contenedores ---
echo ">>> [3/4] Construyendo y desplegando contenedores..."
${COMPOSE_CMD} up -d --build --remove-orphans

# --- 6. Verificación de salud (Healthcheck) ---
echo ">>> [4/4] Verificando disponibilidad del sistema..."
PORT="$(grep -E '^PORT=' "${APP_DIR}/.env" 2>/dev/null | tail -n1 | cut -d'=' -f2- | tr -d ' "' || echo '3000')"
PORT="${PORT:-3000}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"

ATTEMPTS=30
SUCCESS=0
for i in $(seq 1 $ATTEMPTS); do
  STATUS="$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" 2>/dev/null || echo "000")"
  if [ "$STATUS" = "200" ]; then
    SUCCESS=1
    break
  fi
  sleep 2
done

if [ "$SUCCESS" -eq 1 ]; then
  ok "Servicio activo y respondiendo correctamente en ${HEALTH_URL}"
else
  warn "La API no respondió 200 tras 60 segundos (último código HTTP: ${STATUS})."
  echo "  Inspecciona los logs con: ${COMPOSE_CMD} logs app --tail 80"
  exit 1
fi

# Limpieza de imágenes intermedias sin etiqueta
${DOCKER_CMD} image prune -f >/dev/null 2>&1 || true

echo
ok "Actualización completada exitosamente."
echo "  Monitorear logs: ${COMPOSE_CMD} logs -f app"
