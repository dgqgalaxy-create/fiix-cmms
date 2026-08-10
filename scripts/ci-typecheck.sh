#!/bin/bash
# Typecheck pre-deploy (CI / Actions).
# - Backend: tsc --noEmit (bloqueante).
# - Frontend: tsc -b informativo (hay deuda histórica); el gate real sigue siendo vite build en update.sh.
# Uso: bash ./scripts/ci-typecheck.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_MAJOR="${NODE_MAJOR:-22}"

load_nvm() {
  local candidates=()
  if [ -n "${NVM_DIR:-}" ]; then
    candidates+=("${NVM_DIR}/nvm.sh")
  fi
  candidates+=("${HOME}/.nvm/nvm.sh" "/home/usuario/.nvm/nvm.sh")
  local cand
  for cand in "${candidates[@]}"; do
    if [ -s "$cand" ]; then
      export NVM_DIR="$(cd "$(dirname "$cand")" && pwd)"
      # shellcheck disable=SC1090
      . "$cand"
      return 0
    fi
  done
  return 1
}

ensure_node() {
  if load_nvm; then
    local want="$NODE_MAJOR"
    if [ -f "${APP_DIR}/.nvmrc" ]; then
      want="$(tr -d '[:space:]' < "${APP_DIR}/.nvmrc")"
      want="${want:-$NODE_MAJOR}"
    fi
    nvm install "$want" >/dev/null 2>&1 || true
    nvm use "$want" >/dev/null 2>&1 \
      || nvm use "$NODE_MAJOR" >/dev/null 2>&1 \
      || nvm use default >/dev/null 2>&1 \
      || true
    nvm alias default "$want" >/dev/null 2>&1 || true
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "  [ERROR] node no está en PATH. Instala Node ${NODE_MAJOR}+ (nvm) en el usuario del runner." >&2
    exit 1
  fi

  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  echo "  Node $(node -v) · npm $(npm -v)"
  if [ "$major" -lt "$NODE_MAJOR" ]; then
    echo "  [ERROR] Se requiere Node >= ${NODE_MAJOR} (actual: $(node -v))." >&2
    echo "  El runner self-hosted debe usar nvm con Node ${NODE_MAJOR} (mismo usuario que Actions)." >&2
    exit 1
  fi
}

ensure_node

echo ">>> Typecheck backend (bloqueante)..."
cd "${APP_DIR}/backend"
# Self-hosted: node_modules suele existir de deploys previos; hay que
# sincronizar con el lockfile o fallan deps nuevas (p. ej. helmet).
unset NODE_ENV || true
npm ci --include=dev
# npm ci borra node_modules: hay que regenerar el cliente Prisma antes de tsc
npx prisma generate
npx tsc --noEmit
echo "  [OK] backend tsc"

echo ">>> Typecheck frontend (informativo)..."
cd "${APP_DIR}/frontend"
unset NODE_ENV || true
npm ci
if npx tsc -b --pretty false; then
  echo "  [OK] frontend tsc"
else
  echo "  [AVISO] frontend tsc reportó errores (deuda conocida)."
  echo "          El deploy continúa; vite build en update.sh es el gate de UI."
  if [ "${FRONTEND_TSC_STRICT:-0}" = "1" ]; then
    echo "  [ERROR] FRONTEND_TSC_STRICT=1 → abortando."
    exit 1
  fi
fi

echo ">>> Typecheck gate OK (backend limpio)"
