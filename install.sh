#!/bin/bash
# ============================================================
# GTZ CMMS — Instalación inicial con Docker Compose
# ============================================================
# Prepara el entorno Docker, configura credenciales en .env,
# construye y levanta los contenedores en Ubuntu / Debian.
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${APP_DIR}"

ok()   { echo "  [OK] $*"; }
info() { echo "  --> $*"; }
warn() { echo "  [AVISO] $*" >&2; }
die()  { echo "  [ERROR] $*" >&2; exit 1; }

ask() {
  local prompt="$1"
  local default="${2:-}"
  local reply
  if [ -n "$default" ]; then
    read -r -p "${prompt} [${default}]: " reply
    echo "${reply:-$default}"
  else
    read -r -p "${prompt}: " reply
    echo "$reply"
  fi
}

ask_secret() {
  local prompt="$1"
  local reply
  read -r -s -p "${prompt}: " reply
  echo
  echo "$reply"
}

echo "=== Instalación GTZ CMMS (Docker Compose) ==="
echo "Directorio del proyecto: ${APP_DIR}"
echo

# --- 1. Verificar archivos base ---
echo ">>> [1/5] Verificando archivos del repositorio..."
[ -f "${APP_DIR}/docker-compose.yml" ] || die "No se encontró docker-compose.yml en ${APP_DIR}."
[ -f "${APP_DIR}/Dockerfile" ] || die "No se encontró Dockerfile en ${APP_DIR}."
chmod +x "${APP_DIR}/update.sh" "${APP_DIR}/install.sh" "${APP_DIR}/scripts/"*.sh 2>/dev/null || true
ok "Estructura del proyecto verificada."

# --- 2. Instalar y verificar Docker ---
echo ">>> [2/5] Verificando Docker y Docker Compose..."
if ! command -v docker >/dev/null 2>&1; then
  info "Docker no está instalado. Instalando paquetes Docker..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 curl ca-certificates
    sudo systemctl enable --now docker
  else
    die "Instala Docker manualmente antes de continuar (https://docs.docker.com/engine/install/)."
  fi
fi

# Asegurar que el usuario pertenezca al grupo docker
if ! groups "$USER" 2>/dev/null | grep -qw docker; then
  info "Añadiendo el usuario '$USER' al grupo 'docker'..."
  sudo usermod -aG docker "$USER" || true
  warn "Para usar docker sin 'sudo' en nuevas sesiones, deberás cerrar y reabrir tu sesión SSH."
fi

# Detectar comando de Compose
COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif sudo docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="sudo docker compose"
elif sudo docker-compose version >/dev/null 2>&1; then
  COMPOSE_CMD="sudo docker-compose"
else
  die "No se encontró Docker Compose v2. Instálalo con: sudo apt install docker-compose-v2"
fi

ok "Docker Compose disponible (${COMPOSE_CMD})"

# --- 3. Retirar PM2 legado si estuviera presente ---
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe fiix-backend >/dev/null 2>&1 || pm2 describe fiix-frontend >/dev/null 2>&1; then
    info "Retirando servicios previos de PM2 para evitar colisión de puertos..."
    pm2 delete fiix-backend >/dev/null 2>&1 || true
    pm2 delete fiix-frontend >/dev/null 2>&1 || true
    pm2 save >/dev/null 2>&1 || true
    ok "PM2 desactivado."
  fi
fi

# --- 4. Configurar variables de entorno (.env) ---
echo ">>> [3/5] Configuración de credenciales (.env)..."
ENV_FILE="${APP_DIR}/.env"

if [ -f "$ENV_FILE" ]; then
  info "Ya existe el archivo .env en la raíz. Se conservará la configuración existente."
else
  DEFAULT_DB_PASS="$(openssl rand -hex 12 2>/dev/null || echo "cmms_pass_$(date +%s)")"
  DB_PASS="$(ask "Contraseña para PostgreSQL (interna del contenedor)" "$DEFAULT_DB_PASS")"

  DEFAULT_JWT="$(openssl rand -hex 24 2>/dev/null || echo "fiix_jwt_$(date +%s)_secret")"
  JWT_SECRET="$(ask "JWT_SECRET (firma de sesiones)" "$DEFAULT_JWT")"

  PORT_CHOICE="$(ask "Puerto HTTP a publicar" "3000")"
  CORS_ORIGIN="$(ask "Dominio público opcional para CORS (ej. https://cmms.tuempresa.com, vacío si solo LAN)" "")"

  cp "${APP_DIR}/.env.example" "$ENV_FILE"

  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=\"${DB_PASS}\"|" "$ENV_FILE"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\"${JWT_SECRET}\"|" "$ENV_FILE"
  sed -i "s|^PORT=.*|PORT=${PORT_CHOICE}|" "$ENV_FILE"
  if [ -n "$CORS_ORIGIN" ]; then
    sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=\"${CORS_ORIGIN}\"|" "$ENV_FILE"
  fi

  chmod 600 "$ENV_FILE"
  ok "Archivo .env creado exitosamente con permisos restringidos."
fi

# --- 5. Despliegue con Docker Compose ---
echo ">>> [4/5] Levantando servicios con Docker Compose..."
${COMPOSE_CMD} up -d --build

# --- 6. Verificación de salud ---
echo ">>> [5/5] Comprobando disponibilidad del servicio..."
PORT="$(grep -E '^PORT=' "${ENV_FILE}" 2>/dev/null | tail -n1 | cut -d'=' -f2- | tr -d ' "' || echo '3000')"
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

IP_LAN="$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")"

echo
echo "============================================================"
if [ "$SUCCESS" -eq 1 ]; then
  ok "¡GTZ CMMS instalado y funcionando correctamente!"
else
  warn "Los contenedores están iniciando pero /api/health aún no responde 200."
  echo "  Revisa el avance con: ${COMPOSE_CMD} logs -f app"
fi
echo "============================================================"
echo "Acceso web local:  http://${IP_LAN}:${PORT}"
echo "Usuarios iniciales de prueba:"
echo "  - Administrador: admin@fiix.com / password123"
echo "  - Gestionador:   gestionador@fiix.com / password123"
echo "  - Técnico:       tecnico@fiix.com / password123"
echo
echo "Comandos útiles de mantenimiento:"
echo "  - Ver logs en vivo:        ${COMPOSE_CMD} logs -f app"
echo "  - Reiniciar aplicación:    ${COMPOSE_CMD} restart app"
echo "  - Actualizar el sistema:   ./update.sh"
echo "============================================================"
