#!/bin/bash
# Typecheck pre-deploy (CI / Actions).
# - Backend: tsc --noEmit (bloqueante).
# - Frontend: tsc -b informativo (hay deuda histórica); el gate real sigue siendo vite build en update.sh.
# Uso: bash ./scripts/ci-typecheck.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

load_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  if [ -f "${APP_DIR}/.nvmrc" ]; then
    nvm use "$(cat "${APP_DIR}/.nvmrc")" >/dev/null 2>&1 || nvm use 22 >/dev/null 2>&1 || true
  fi
}

load_nvm

echo ">>> Typecheck backend (bloqueante)..."
cd "${APP_DIR}/backend"
if [ ! -d node_modules ]; then
  unset NODE_ENV || true
  npm ci --include=dev
fi
npx tsc --noEmit
echo "  [OK] backend tsc"

echo ">>> Typecheck frontend (informativo)..."
cd "${APP_DIR}/frontend"
if [ ! -d node_modules ]; then
  unset NODE_ENV || true
  npm ci
fi
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
