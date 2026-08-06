#!/bin/bash
# Vigilancia del GitHub Actions self-hosted runner (CasaOS / Ubuntu de planta).
#
# Problema: systemd puede marcar el servicio "active" mientras el listener
# perdió la sesión con GitHub → los deploys quedan en
# "Waiting for a runner to pick up this job…".
#
# Este script:
#   1) Asegura NTP (hora correcta; evita SSL NotTimeValid).
#   2) Arranca el unit si está parado.
#   3) Si en la ventana reciente NO aparece "Listening for Jobs" y tampoco
#      hay un job en curso → reinicia el runner.
#
# Uso manual:
#   sudo ./scripts/gha-runner-watchdog.sh
#   sudo LOOKBACK_MIN=30 ./scripts/gha-runner-watchdog.sh
#
# Instalar cron (recomendado):
#   sudo ./scripts/install-gha-runner-watchdog.sh
#
# Variables opcionales:
#   ACTIONS_RUNNER_UNIT  unit systemd exacto (si no, se autodetecta)
#   LOOKBACK_MIN         minutos de journal a revisar (default 45)
#   FORCE_RESTART=1      reinicia siempre (prueba)
#   SKIP_NTP=1           no toca timedatectl
set -uo pipefail

LOOKBACK_MIN="${LOOKBACK_MIN:-45}"
LOG_TAG="[fiix-gha-watchdog]"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') ${LOG_TAG} $*"; }

if [ "$(id -u)" -ne 0 ]; then
  log "ERROR: ejecuta como root (sudo). systemctl del runner requiere privilegios."
  exit 1
fi

# --- NTP ---
if [ "${SKIP_NTP:-0}" != "1" ] && command -v timedatectl >/dev/null 2>&1; then
  if timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -qi '^no$'; then
    log "NTP no sincronizado → activando timedatectl set-ntp true"
    timedatectl set-ntp true 2>/dev/null || true
  fi
fi

# --- Resolver unit ---
resolve_unit() {
  if [ -n "${ACTIONS_RUNNER_UNIT:-}" ]; then
    echo "${ACTIONS_RUNNER_UNIT}"
    return 0
  fi
  # Preferir el de este repo (fiix-cmms); si no, el primer actions.runner.*
  local u
  u="$(systemctl list-units --type=service --all --no-legend 'actions.runner.*' 2>/dev/null \
    | awk '{print $1}' | grep -i 'fiix-cmms' | head -n1 || true)"
  if [ -z "$u" ]; then
    u="$(systemctl list-units --type=service --all --no-legend 'actions.runner.*' 2>/dev/null \
      | awk '{print $1}' | head -n1 || true)"
  fi
  if [ -z "$u" ]; then
    # Units disabled/inactive a veces solo salen en list-unit-files
    u="$(systemctl list-unit-files --type=service --no-legend 'actions.runner.*' 2>/dev/null \
      | awk '{print $1}' | grep -i 'fiix-cmms' | head -n1 || true)"
  fi
  if [ -z "$u" ]; then
    u="$(systemctl list-unit-files --type=service --no-legend 'actions.runner.*' 2>/dev/null \
      | awk '{print $1}' | head -n1 || true)"
  fi
  echo "${u}"
}

UNIT="$(resolve_unit)"
if [ -z "$UNIT" ]; then
  log "AVISO: no hay unit actions.runner.* — ¿instalaste el self-hosted runner?"
  log "        Guía: GitHub → Settings → Actions → Runners → New self-hosted runner"
  exit 0
fi

log "Unit: ${UNIT} (lookback ${LOOKBACK_MIN} min)"

if [ "${FORCE_RESTART:-0}" = "1" ]; then
  log "FORCE_RESTART=1 → reiniciando"
  systemctl restart "${UNIT}"
  sleep 3
  systemctl is-active --quiet "${UNIT}" && log "OK: activo tras force restart" || log "ERROR: no quedó activo"
  exit 0
fi

# --- Servicio caído → start ---
if ! systemctl is-active --quiet "${UNIT}"; then
  log "Servicio inactivo → systemctl start"
  systemctl start "${UNIT}" || {
    log "ERROR: no se pudo arrancar ${UNIT}"
    exit 1
  }
  sleep 5
fi

# --- ¿Escucha jobs? ---
RECENT="$(journalctl -u "${UNIT}" --since "${LOOKBACK_MIN} min ago" --no-pager -o cat 2>/dev/null || true)"

if echo "${RECENT}" | grep -q "Running job:"; then
  log "OK: hay job en curso → no reiniciar"
  exit 0
fi

if echo "${RECENT}" | grep -q "Listening for Jobs"; then
  log "OK: Listening for Jobs en los últimos ${LOOKBACK_MIN} min"
  exit 0
fi

# También aceptar "Connected to GitHub" muy reciente como señal de vida
if echo "${RECENT}" | grep -q "Connected to GitHub"; then
  log "OK: Connected to GitHub reciente (posible arranque) → no reiniciar aún"
  exit 0
fi

log "Sesión sospechosa (sin Listening/Running en ${LOOKBACK_MIN} min) → restart"
systemctl restart "${UNIT}" || {
  log "ERROR: restart falló"
  exit 1
}
sleep 5
if systemctl is-active --quiet "${UNIT}"; then
  log "OK: reiniciado y activo"
  # Pequeña espera y muestra últimas líneas útiles
  sleep 2
  journalctl -u "${UNIT}" -n 8 --no-pager -o cat 2>/dev/null | while IFS= read -r line; do
    log "  | ${line}"
  done
  exit 0
fi
log "ERROR: tras restart sigue inactivo — revisa: journalctl -u ${UNIT} -n 50"
exit 1
