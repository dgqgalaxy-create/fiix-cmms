#!/bin/bash
# Vigilancia externa de FIIX: API (:3000) + PostgreSQL.
# Pensado para cron cada 5 min (no depende de que Node esté vivo).
#
# Uso:
#   ./scripts/healthcheck.sh
#   HEALTHCHECK_REMINDER_HOURS=6 ./scripts/healthcheck.sh
#
# Estado: /tmp/fiix-health-state (debounce: solo avisa al pasar a unhealthy
# y recordatorios cada N horas mientras siga caído).
# Telegram: respeta SystemSettings.telegram_enabled. Credenciales en BD o TELEGRAM_* del .env.
# Si el interruptor está en false → no envía, aunque exista .env.
set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_FILE="${HEALTHCHECK_STATE_FILE:-/tmp/fiix-health-state}"
HEALTH_URL="${HEALTHCHECK_URL:-http://127.0.0.1:3000/api/health}"
REMINDER_HOURS="${HEALTHCHECK_REMINDER_HOURS:-6}"
ENV_FILE="${APP_DIR}/backend/.env"

now_epoch() { date +%s; }

read_env_var() {
  local key="$1"
  if [ -f "$ENV_FILE" ]; then
    grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d '=' -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true
  fi
}

# 0 = habilitado (o BD inaccesible), 1 = desactivado en app, 2 = sin psql/db_url
telegram_enabled_in_db() {
  local db_url
  db_url="$(read_env_var DATABASE_URL)"
  if [ -z "$db_url" ] || ! command -v psql >/dev/null 2>&1; then
    return 2
  fi
  local flag
  flag="$(psql "$db_url" -At -c \
    "SELECT telegram_enabled::text FROM \"SystemSettings\" ORDER BY id ASC LIMIT 1;" \
    2>/dev/null || true)"
  if [ -z "$flag" ]; then
    return 2
  fi
  if [ "$flag" = "f" ] || [ "$flag" = "false" ] || [ "$flag" = "FALSE" ]; then
    return 1
  fi
  return 0
}

load_telegram_creds() {
  TG_TOKEN=""
  TG_CHAT=""

  local enabled_rc=0
  telegram_enabled_in_db
  enabled_rc=$?

  # Interruptor de la app en false → silencio total (aunque haya TELEGRAM_* en .env).
  if [ "$enabled_rc" -eq 1 ]; then
    echo "  [AVISO] Telegram desactivado en Configuración (telegram_enabled=false); no se envía alerta."
    return 1
  fi

  local db_url
  db_url="$(read_env_var DATABASE_URL)"

  # Preferir credenciales de BD cuando el toggle está activo.
  if [ "$enabled_rc" -eq 0 ] && [ -n "$db_url" ] && command -v psql >/dev/null 2>&1; then
    local row
    row="$(psql "$db_url" -At -c \
      "SELECT COALESCE(telegram_bot_token,''), COALESCE(telegram_chat_id,'') FROM \"SystemSettings\" WHERE telegram_enabled = true LIMIT 1;" \
      2>/dev/null || true)"
    if [ -n "$row" ]; then
      TG_TOKEN="$(echo "$row" | cut -d '|' -f1)"
      TG_CHAT="$(echo "$row" | cut -d '|' -f2)"
    fi
  fi

  # Completar con .env si faltan (toggle activo o BD inaccesible).
  if [ -z "${TG_TOKEN:-}" ]; then
    TG_TOKEN="$(read_env_var TELEGRAM_BOT_TOKEN)"
  fi
  if [ -z "${TG_CHAT:-}" ]; then
    TG_CHAT="$(read_env_var TELEGRAM_CHAT_ID)"
  fi

  [ -n "${TG_TOKEN:-}" ] && [ -n "${TG_CHAT:-}" ]
}

send_telegram() {
  local text="$1"
  if ! load_telegram_creds; then
    echo "  [AVISO] Sin credenciales Telegram; no se envía alerta: ${text}"
    return 0
  fi
  curl -sS -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" \
    --data-urlencode "text=${text}" \
    --data-urlencode "parse_mode=HTML" \
    -o /dev/null || echo "  [AVISO] Falló el envío a Telegram"
}

load_state() {
  API_STATE="healthy"
  DB_STATE="healthy"
  API_LAST_NOTIFY=0
  DB_LAST_NOTIFY=0
  if [ -f "$STATE_FILE" ]; then
    # shellcheck disable=SC1090
    . "$STATE_FILE" || true
  fi
}

save_state() {
  cat > "$STATE_FILE" <<EOF
API_STATE=${API_STATE}
DB_STATE=${DB_STATE}
API_LAST_NOTIFY=${API_LAST_NOTIFY}
DB_LAST_NOTIFY=${DB_LAST_NOTIFY}
EOF
}

maybe_notify() {
  local component="$1"
  local new_state="$2"
  local message="$3"
  local old_state last_notify now reminder_secs
  now="$(now_epoch)"
  reminder_secs=$((REMINDER_HOURS * 3600))

  if [ "$component" = "API" ]; then
    old_state="$API_STATE"
    last_notify="$API_LAST_NOTIFY"
  else
    old_state="$DB_STATE"
    last_notify="$DB_LAST_NOTIFY"
  fi

  if [ "$new_state" = "healthy" ]; then
    if [ "$component" = "API" ]; then API_STATE="healthy"; else DB_STATE="healthy"; fi
    return 0
  fi

  local should_send=0
  if [ "$old_state" != "unhealthy" ]; then
    should_send=1
  elif [ $((now - last_notify)) -ge "$reminder_secs" ]; then
    should_send=1
    message="${message} (sigue caído)"
  fi

  if [ "$component" = "API" ]; then
    API_STATE="unhealthy"
  else
    DB_STATE="unhealthy"
  fi

  if [ "$should_send" -eq 1 ]; then
    send_telegram "$message"
    if [ "$component" = "API" ]; then
      API_LAST_NOTIFY="$now"
    else
      DB_LAST_NOTIFY="$now"
    fi
  fi
}

http_get() {
  # stdout: body; exit via echoed code on fd3 pattern — returns "CODE|BODY"
  local url="$1"
  local tmp code
  tmp="$(mktemp)"
  code="$(curl -sS -o "$tmp" -w '%{http_code}' --connect-timeout 5 "$url" 2>/dev/null || echo '000')"
  # Si curl falló tras escribir código parcial, normalizar
  if ! echo "$code" | grep -Eq '^[0-9]{3}$'; then
    code="000"
  fi
  printf '%s|' "$code"
  cat "$tmp" 2>/dev/null || true
  rm -f "$tmp"
}

check_api() {
  local raw code body
  raw="$(http_get "$HEALTH_URL")"
  code="${raw%%|*}"
  body="${raw#*|}"

  if [ "$code" = "000" ]; then
    echo "unhealthy"
    return 0
  fi
  # Conexión OK: la API (proceso Node) está viva aunque DB falle (503)
  if [ "$code" = "200" ] || [ "$code" = "503" ]; then
    echo "healthy"
    return 0
  fi
  if [ "$code" -ge 500 ] 2>/dev/null; then
    echo "unhealthy"
    return 0
  fi
  # Cualquier otra respuesta con cuerpo de health conocido
  if echo "$body" | grep -qi '"status"'; then
    echo "healthy"
    return 0
  fi
  echo "unhealthy"
}

check_db() {
  local raw code body
  raw="$(http_get "$HEALTH_URL")"
  code="${raw%%|*}"
  body="${raw#*|}"

  if [ "$code" != "000" ] && echo "$body" | grep -qi '"db"[[:space:]]*:[[:space:]]*"error"'; then
    echo "unhealthy"
    return 0
  fi
  if [ "$code" != "000" ] && echo "$body" | grep -qi '"db"[[:space:]]*:[[:space:]]*"ok"'; then
    echo "healthy"
    return 0
  fi

  local db_url host
  db_url="$(read_env_var DATABASE_URL)"
  if command -v pg_isready >/dev/null 2>&1; then
    host="$(echo "$db_url" | sed -n 's|.*@\([^:/]*\).*|\1|p')"
    host="${host:-localhost}"
    if pg_isready -h "$host" -q 2>/dev/null; then
      echo "healthy"
      return 0
    fi
    echo "unhealthy"
    return 0
  fi
  if [ -n "$db_url" ] && command -v psql >/dev/null 2>&1; then
    if psql "$db_url" -c 'SELECT 1' >/dev/null 2>&1; then
      echo "healthy"
      return 0
    fi
    echo "unhealthy"
    return 0
  fi
  echo "healthy"
}

echo "=== FIIX healthcheck $(date -Iseconds 2>/dev/null || date) ==="
load_state

API_NOW="$(check_api)"
DB_NOW="$(check_db)"

echo "  API: ${API_NOW}  |  DB: ${DB_NOW}"

if [ "$API_NOW" = "unhealthy" ]; then
  maybe_notify API unhealthy "GTZ: servidor caído / API no responde (${HEALTH_URL})"
else
  maybe_notify API healthy ""
fi

if [ "$DB_NOW" = "unhealthy" ]; then
  maybe_notify DB unhealthy "GTZ: Postgres no responde"
else
  maybe_notify DB healthy ""
fi

save_state
echo "  Estado guardado en ${STATE_FILE}"
