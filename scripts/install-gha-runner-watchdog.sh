#!/bin/bash
# Instala el watchdog del GitHub Actions self-hosted runner:
#   - Activa NTP
#   - Deja scripts ejecutables
#   - Cron root cada 15 min vía /etc/cron.d/
#
# Uso (en el servidor de planta, tras tener el runner registrado):
#   cd ~/fiix-cmms
#   sudo bash ./scripts/install-gha-runner-watchdog.sh
#
# Desinstalar:
#   sudo rm -f /etc/cron.d/fiix-gha-runner-watchdog
#   sudo rm -f /var/log/fiix-gha-runner-watchdog.log
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WATCHDOG="${APP_DIR}/scripts/gha-runner-watchdog.sh"
CRON_FILE="/etc/cron.d/fiix-gha-runner-watchdog"
LOG_FILE="/var/log/fiix-gha-runner-watchdog.log"

if [ "$(id -u)" -ne 0 ]; then
  echo "  [ERROR] Ejecuta con sudo: sudo bash ./scripts/install-gha-runner-watchdog.sh" >&2
  exit 1
fi

if [ ! -f "${WATCHDOG}" ]; then
  echo "  [ERROR] No está ${WATCHDOG}" >&2
  exit 1
fi

chmod +x "${WATCHDOG}" "${APP_DIR}/scripts/install-gha-runner-watchdog.sh"

# NTP
if command -v timedatectl >/dev/null 2>&1; then
  timedatectl set-ntp true 2>/dev/null || true
  echo "  [OK] NTP solicitado (timedatectl set-ntp true)"
  timedatectl 2>/dev/null | sed 's/^/    /' || true
fi

# Detectar unit (informativo)
UNIT="$(systemctl list-unit-files --type=service --no-legend 'actions.runner.*' 2>/dev/null \
  | awk '{print $1}' | grep -i 'fiix-cmms' | head -n1 || true)"
if [ -z "${UNIT}" ]; then
  UNIT="$(systemctl list-unit-files --type=service --no-legend 'actions.runner.*' 2>/dev/null \
    | awk '{print $1}' | head -n1 || true)"
fi

if [ -z "${UNIT}" ]; then
  echo "  [AVISO] Aún no hay unit actions.runner.* en este host."
  echo "          Instala el runner (GitHub → Settings → Actions → Runners) y vuelve a correr esto,"
  echo "          o déjalo instalado: el cron ya quedará listo para cuando exista el unit."
else
  echo "  [OK] Runner detectado: ${UNIT}"
  systemctl enable --now "${UNIT}" 2>/dev/null || systemctl start "${UNIT}" 2>/dev/null || true
fi

# Cron cada 15 minutos (root)
# PATH mínimo para systemctl/journalctl/timedatectl
cat > "${CRON_FILE}" <<EOF
# GTZ CMMS — watchdog GitHub Actions self-hosted runner
# Generado por scripts/install-gha-runner-watchdog.sh — no editar a mano salvo necesidad.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/15 * * * * root ${WATCHDOG} >> ${LOG_FILE} 2>&1
EOF
chmod 644 "${CRON_FILE}"

# Log rotativo ligero (si existe logrotate)
if [ -d /etc/logrotate.d ]; then
  cat > /etc/logrotate.d/fiix-gha-runner-watchdog <<EOF
${LOG_FILE} {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  create 0644 root root
}
EOF
fi

touch "${LOG_FILE}"
chmod 644 "${LOG_FILE}"

echo "  [OK] Cron: ${CRON_FILE}"
echo "  [OK] Log:  ${LOG_FILE}"
echo "  Prueba ahora:"
echo "    sudo ${WATCHDOG}"
echo "  Ver log:"
echo "    tail -n 50 ${LOG_FILE}"
