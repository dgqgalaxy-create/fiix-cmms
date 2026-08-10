#!/bin/bash
# Typecheck pre-deploy (CI / Actions).
# - Backend: tsc --noEmit (bloqueante).
# - Frontend: tsc -b informativo (hay deuda histórica); el gate real sigue siendo vite build en update.sh.
# Uso: bash ./scripts/ci-typecheck.sh
#
# Nota: el servicio Actions self-hosted suele tener /usr/bin/node v20. No usamos
# `source nvm.sh` bajo `set -e` (nvm aborta el job con exit 3). Preferimos el
# tarball oficial de Node 22 en ~/.local.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_MAJOR="${NODE_MAJOR:-22}"
NODE_DIST_VERSION="${NODE_DIST_VERSION:-v22.22.0}"

node_major() {
  node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo "0"
}

prepend_path_bin() {
  local bin="$1"
  if [ -n "$bin" ] && [ -x "${bin}/node" ]; then
    export PATH="${bin}:${PATH}"
    hash -r 2>/dev/null || true
    return 0
  fi
  return 1
}

install_node_tarball() {
  local ver="$NODE_DIST_VERSION"
  local base="${HOME}/.local"
  local dir="${base}/node-${ver}"
  local url="https://nodejs.org/dist/${ver}/node-${ver}-linux-x64.tar.xz"
  local tmp="/tmp/fiix-node-${ver}.tar.xz"

  if [ -x "${dir}/bin/node" ]; then
    prepend_path_bin "${dir}/bin"
    return 0
  fi

  echo "  Descargando Node ${ver} (tarball oficial nodejs.org)..."
  mkdir -p "${base}"
  curl -fsSL "$url" -o "$tmp"
  rm -rf "${dir}" "${base}/node-${ver}-linux-x64"
  tar -xJf "$tmp" -C "${base}"
  mv "${base}/node-${ver}-linux-x64" "${dir}"
  rm -f "$tmp"
  prepend_path_bin "${dir}/bin"
}

ensure_node() {
  # 1) Si ya hay un Node 22+ en PATH, úsalo.
  if [ "$(node_major)" -ge "$NODE_MAJOR" ]; then
    echo "  Node $(node -v) · npm $(npm -v) · which=$(command -v node)"
    return 0
  fi

  echo "  Node actual: $(node -v 2>/dev/null || echo 'ausente') — se requiere >= ${NODE_MAJOR}"

  # 2) Binario nvm ya instalado (sin sourcer nvm.sh).
  local nvm_bin=""
  nvm_bin="$(ls -d "${HOME}/.nvm/versions/node"/v"${NODE_MAJOR}".*/bin 2>/dev/null | sort -V | tail -n 1 || true)"
  if prepend_path_bin "${nvm_bin:-}"; then
    if [ "$(node_major)" -ge "$NODE_MAJOR" ]; then
      echo "  Node $(node -v) · npm $(npm -v) · which=$(command -v node) (nvm bin)"
      return 0
    fi
  fi

  # 3) Tarball oficial (fiable en CI; no depende de nvm).
  install_node_tarball

  if [ "$(node_major)" -lt "$NODE_MAJOR" ]; then
    echo "  [ERROR] Se requiere Node >= ${NODE_MAJOR} (actual: $(node -v 2>/dev/null || echo ausente))." >&2
    echo "  HOME=${HOME} PATH=${PATH}" >&2
    exit 1
  fi
  echo "  Node $(node -v) · npm $(npm -v) · which=$(command -v node) (tarball)"
}

ensure_node

echo ">>> Typecheck backend (bloqueante)..."
cd "${APP_DIR}/backend"
unset NODE_ENV || true
npm ci --include=dev
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
