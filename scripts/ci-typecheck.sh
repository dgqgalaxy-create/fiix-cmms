#!/bin/bash
# Typecheck pre-deploy (CI / Actions).
# - Backend: tsc --noEmit (bloqueante) tras npm ci cacheado.
# - Frontend: no se reinstala aquí (el gate real es vite build en update.sh).
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

echo ">>> Typecheck frontend: omitido (gate real = vite build en update.sh)"
echo ">>> Typecheck gate OK (backend limpio)"
