#!/bin/bash
# Asegura VAPID_* en backend/.env para Web Push (PWA).
# Uso: ensure-vapid-env.sh [ruta-al-.env]
# Si ya hay claves no vacías, no las regenera.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${1:-${APP_DIR}/backend/.env}"
BACKEND_DIR="$(cd "$(dirname "${ENV_FILE}")" && pwd)"

if [ ! -f "$ENV_FILE" ]; then
  echo "  [AVISO] No existe ${ENV_FILE}; no se pueden escribir claves VAPID." >&2
  exit 0
fi

read_env_val() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d '=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" | tr -d '\r' || true
}

upsert_env() {
  local key="$1"
  local value="$2"
  touch "$ENV_FILE"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # Escapar / y & para sed
    local escaped
    escaped="$(printf '%s' "$value" | sed -e 's/[\/&]/\\&/g')"
    sed -i "s|^${key}=.*|${key}=\"${escaped}\"|" "$ENV_FILE"
  else
    printf '\n%s="%s"\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

PUB="$(read_env_val VAPID_PUBLIC_KEY)"
PRIV="$(read_env_val VAPID_PRIVATE_KEY)"
SUBJ="$(read_env_val VAPID_SUBJECT)"

if [ -n "$PUB" ] && [ -n "$PRIV" ]; then
  if [ -z "$SUBJ" ]; then
    upsert_env VAPID_SUBJECT "mailto:mantenimiento@localhost"
    echo "  [OK] VAPID ya existía; se añadió VAPID_SUBJECT por defecto."
  else
    echo "  [OK] VAPID ya configurado en .env (no se regenera)."
  fi
  exit 0
fi

echo "  --> Generando claves VAPID (Web Push)..."
cd "$BACKEND_DIR"
# Preferir dependencia local; si no, npx descarga web-push.
KEYS_OUT=""
if [ -x "${BACKEND_DIR}/node_modules/.bin/web-push" ]; then
  KEYS_OUT="$("${BACKEND_DIR}/node_modules/.bin/web-push" generate-vapid-keys 2>/dev/null || true)"
fi
if [ -z "$KEYS_OUT" ]; then
  KEYS_OUT="$(npx --yes web-push generate-vapid-keys 2>/dev/null || true)"
fi

NEW_PUB="$(printf '%s\n' "$KEYS_OUT" | awk '/Public Key:/{getline; gsub(/\r/,""); print; exit}' | xargs)"
NEW_PRIV="$(printf '%s\n' "$KEYS_OUT" | awk '/Private Key:/{getline; gsub(/\r/,""); print; exit}' | xargs)"

if [ -z "$NEW_PUB" ] || [ -z "$NEW_PRIV" ]; then
  echo "  [AVISO] No se pudieron generar claves VAPID. Más tarde: cd backend && npx web-push generate-vapid-keys" >&2
  exit 0
fi

upsert_env VAPID_PUBLIC_KEY "$NEW_PUB"
upsert_env VAPID_PRIVATE_KEY "$NEW_PRIV"
if [ -z "$SUBJ" ]; then
  upsert_env VAPID_SUBJECT "mailto:mantenimiento@localhost"
fi

chmod 600 "$ENV_FILE" 2>/dev/null || true
echo "  [OK] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY escritas en ${ENV_FILE}"
