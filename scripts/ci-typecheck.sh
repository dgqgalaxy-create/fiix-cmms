#!/bin/bash
# Typecheck pre-deploy (CI / Actions).
# - Backend: tsc --noEmit (bloqueante) tras npm ci cacheado.
# - Frontend: tsc -b (bloqueante; se instala con npm ci como el backend).
# Uso: bash ./scripts/ci-typecheck.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "${APP_DIR}/scripts/fiix-node-npm.sh"

fiix_ensure_node

echo ">>> Typecheck backend (bloqueante)..."
cd "${APP_DIR}/backend"
fiix_npm_ci "${APP_DIR}/backend" "--include=dev"
npx prisma generate
npx tsc --noEmit
echo "  [OK] backend tsc"

echo ">>> Typecheck frontend (bloqueante)..."
cd "${APP_DIR}/frontend"
fiix_npm_ci "${APP_DIR}/frontend" "--include=dev"
npx tsc -b
echo "  [OK] frontend tsc -b"

echo ">>> Typecheck gate OK (backend + frontend limpios)"
