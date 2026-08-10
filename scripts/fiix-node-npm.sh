#!/bin/bash
# Helpers compartidos: Node 22 + npm ci cacheado por hash del lockfile.
# Uso: source desde ci-typecheck.sh / update.sh (no ejecutar solo).
# shellcheck shell=bash

FIIX_NODE_MAJOR="${FIIX_NODE_MAJOR:-${NODE_MAJOR:-22}}"
FIIX_NODE_DIST_VERSION="${FIIX_NODE_DIST_VERSION:-${NODE_DIST_VERSION:-v22.22.0}}"

fiix_node_major() {
  node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo "0"
}

fiix_prepend_path_bin() {
  local bin="$1"
  if [ -n "$bin" ] && [ -x "${bin}/node" ]; then
    export PATH="${bin}:${PATH}"
    hash -r 2>/dev/null || true
    return 0
  fi
  return 1
}

fiix_install_node_tarball() {
  local ver="$FIIX_NODE_DIST_VERSION"
  local base="${HOME}/.local"
  local dir="${base}/node-${ver}"
  local url="https://nodejs.org/dist/${ver}/node-${ver}-linux-x64.tar.xz"
  local tmp="/tmp/fiix-node-${ver}.tar.xz"

  if [ -x "${dir}/bin/node" ]; then
    fiix_prepend_path_bin "${dir}/bin"
    return 0
  fi

  echo "  Descargando Node ${ver} (tarball oficial nodejs.org)..."
  mkdir -p "${base}"
  curl -fsSL "$url" -o "$tmp"
  rm -rf "${dir}" "${base}/node-${ver}-linux-x64"
  tar -xJf "$tmp" -C "${base}"
  mv "${base}/node-${ver}-linux-x64" "${dir}"
  rm -f "$tmp"
  fiix_prepend_path_bin "${dir}/bin"
}

# Activa Node >= 22 sin sourcer nvm.sh (nvm + set -e aborta Actions con exit 3).
fiix_ensure_node() {
  if [ "$(fiix_node_major)" -ge "$FIIX_NODE_MAJOR" ]; then
    echo "  Node $(node -v) · npm $(npm -v) · which=$(command -v node)"
    return 0
  fi

  echo "  Node actual: $(node -v 2>/dev/null || echo 'ausente') — se requiere >= ${FIIX_NODE_MAJOR}"

  local nvm_bin=""
  nvm_bin="$(ls -d "${HOME}/.nvm/versions/node"/v"${FIIX_NODE_MAJOR}".*/bin 2>/dev/null | sort -V | tail -n 1 || true)"
  if fiix_prepend_path_bin "${nvm_bin:-}"; then
    if [ "$(fiix_node_major)" -ge "$FIIX_NODE_MAJOR" ]; then
      echo "  Node $(node -v) · npm $(npm -v) · which=$(command -v node) (nvm bin)"
      return 0
    fi
  fi

  fiix_install_node_tarball

  if [ "$(fiix_node_major)" -lt "$FIIX_NODE_MAJOR" ]; then
    echo "  [ERROR] Se requiere Node >= ${FIIX_NODE_MAJOR} (actual: $(node -v 2>/dev/null || echo ausente))." >&2
    echo "  HOME=${HOME} PATH=${PATH}" >&2
    return 1
  fi
  echo "  Node $(node -v) · npm $(npm -v) · which=$(command -v node) (tarball)"
}

# npm ci solo si falta node_modules o cambió package-lock.json.
# Uso: fiix_npm_ci /ruta/backend "--include=dev"
# Forzar: FORCE_NPM_CI=1
fiix_npm_ci() {
  local dir="$1"
  local extra="${2:-}"
  local lock="${dir}/package-lock.json"
  local stamp="${dir}/node_modules/.fiix-lock-sha"
  local label
  label="$(basename "$dir")"

  if [ ! -f "$lock" ]; then
    echo "  [ERROR] No existe ${lock}" >&2
    return 1
  fi

  local sha
  sha="$(sha256sum "$lock" | awk '{print $1}')"

  if [ "${FORCE_NPM_CI:-0}" != "1" ] \
    && [ -d "${dir}/node_modules" ] \
    && [ -f "$stamp" ] \
    && [ "$(cat "$stamp")" = "$sha" ]; then
    echo "  [skip] npm ci (${label}) — lockfile sin cambios"
    return 0
  fi

  echo "  --> npm ci (${label})..."
  (
    cd "$dir"
    unset NODE_ENV || true
    # shellcheck disable=SC2086
    npm ci ${extra}
  )
  mkdir -p "${dir}/node_modules"
  echo "$sha" > "$stamp"
  echo "  [OK] npm ci (${label})"
}
