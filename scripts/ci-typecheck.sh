#!/bin/bash
# Typecheck pre-deploy (CI / Actions).
# - Backend: tsc --noEmit (bloqueante).
# - Frontend: tsc -b informativo (hay deuda histórica); el gate real sigue siendo vite build en update.sh.
# Uso: bash ./scripts/ci-typecheck.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_MAJOR="${NODE_MAJOR:-22}"
# Binario oficial (linux x64) si nvm no está disponible en el servicio Actions.
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

prepend_nvm_node_bin() {
  local want="$1"
  local bin=""
  bin="$(ls -d "${HOME}/.nvm/versions/node"/v"${want}".*/bin 2>/dev/null | sort -V | tail -n 1 || true)"
  prepend_path_bin "${bin:-}"
}

load_nvm_sh() {
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

  echo "  Descargando Node ${ver} (tarball oficial)..."
  mkdir -p "${base}"
  curl -fsSL "$url" -o "$tmp"
  rm -rf "${dir}" "${base}/node-${ver}-linux-x64"
  tar -xJf "$tmp" -C "${base}"
  mv "${base}/node-${ver}-linux-x64" "${dir}"
  rm -f "$tmp"
  prepend_path_bin "${dir}/bin"
}

ensure_node() {
  local want="$NODE_MAJOR"
  if [ -f "${APP_DIR}/.nvmrc" ]; then
    want="$(tr -d '[:space:]' < "${APP_DIR}/.nvmrc")"
    want="${want:-$NODE_MAJOR}"
  fi

  # 1) Cargar nvm si existe (el servicio Actions no hereda el shell de login).
  load_nvm_sh || true

  # 2) Instalar/activar la versión pedida vía nvm.
  if type nvm >/dev/null 2>&1; then
    nvm install "$want" || true
    nvm use "$want" || nvm use "$NODE_MAJOR" || true
    nvm alias default "$want" >/dev/null 2>&1 || true
  fi

  # 3) Fallback: PATH directo a ~/.nvm/versions/node/v22.*/bin
  if [ "$(node_major)" -lt "$NODE_MAJOR" ]; then
    prepend_nvm_node_bin "$NODE_MAJOR" || prepend_nvm_node_bin "$want" || true
  fi

  # 4) Intentar instalar nvm (el install.sh a veces sale ≠0 aunque dejó nvm.sh).
  if [ "$(node_major)" -lt "$NODE_MAJOR" ]; then
    echo "  Node actual: $(node -v 2>/dev/null || echo 'ausente') — preparando nvm + Node ${NODE_MAJOR}..."
    set +e
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    local nvm_install_rc=$?
    set -e
    if [ "$nvm_install_rc" -ne 0 ]; then
      echo "  [AVISO] nvm install.sh salió con código ${nvm_install_rc} (se continúa si quedó nvm.sh)."
    fi
    export NVM_DIR="${HOME}/.nvm"
    if [ -s "${NVM_DIR}/nvm.sh" ]; then
      # shellcheck disable=SC1091
      . "${NVM_DIR}/nvm.sh"
      nvm install "$NODE_MAJOR" || true
      nvm use "$NODE_MAJOR" || true
      nvm alias default "$NODE_MAJOR" >/dev/null 2>&1 || true
      prepend_nvm_node_bin "$NODE_MAJOR" || true
    fi
  fi

  # 5) Último recurso fiable en CI: tarball oficial de Node 22.
  if [ "$(node_major)" -lt "$NODE_MAJOR" ]; then
    install_node_tarball
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "  [ERROR] node no está en PATH tras intentar activar Node ${NODE_MAJOR}." >&2
    exit 1
  fi

  echo "  Node $(node -v) · npm $(npm -v) · which=$(command -v node)"
  if [ "$(node_major)" -lt "$NODE_MAJOR" ]; then
    echo "  [ERROR] Se requiere Node >= ${NODE_MAJOR} (actual: $(node -v))." >&2
    echo "  HOME=${HOME} NVM_DIR=${NVM_DIR:-unset}" >&2
    echo "  ls nvm versions: $(ls "${HOME}/.nvm/versions/node" 2>/dev/null || echo 'ninguna')" >&2
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
