#!/bin/bash
# Smoke de endurecimiento v1.56.26+ (estabilidad / seguridad / rendimiento API).
# Uso:
#   BASE_URL=http://127.0.0.1:3000 EMAIL=admin@fiix.com PASS=password123 \
#     bash ./scripts/smoke-hardening.sh
#
# Usa la contraseña REAL del admin (no el placeholder). Tras seed: password123.
# Códigos: 0 = todo OK · 1 = falló al menos un check P0 · 2 = uso incorrecto
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
BASE_URL="${BASE_URL%/}"
EMAIL="${EMAIL:-}"
PASS="${PASS:-}"

PASS_N=0
FAIL_N=0
WARN_N=0

ok()   { echo "  [OK] $*"; PASS_N=$((PASS_N + 1)); }
fail() { echo "  [FAIL] $*" >&2; FAIL_N=$((FAIL_N + 1)); }
warn() { echo "  [AVISO] $*" >&2; WARN_N=$((WARN_N + 1)); }
info() { echo "  --> $*"; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Falta: $1" >&2; exit 2; }; }
need_cmd curl
need_cmd python3

echo "=== Smoke endurecimiento FIIX ==="
echo "BASE_URL=${BASE_URL}"
echo

# --- 1. Health ---
echo ">>> [1] /api/health"
HEALTH_JSON="$(curl -fsS --connect-timeout 5 "${BASE_URL}/api/health" || true)"
if [ -z "$HEALTH_JSON" ]; then
  fail "No responde /api/health"
else
  echo "$HEALTH_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d.get('status') in ('ok','degraded'), d
assert d.get('db') in ('ok','error'), d
print('status=',d.get('status'),'db=',d.get('db'),'version=',d.get('version'))
" && ok "health responde (version en cuerpo)" || fail "health JSON inválido"
fi

# --- 2. Helmet / headers seguridad ---
echo ">>> [2] Headers (Helmet)"
HDRS="$(curl -sI --connect-timeout 5 "${BASE_URL}/api/health" || true)"
if echo "$HDRS" | grep -qiE 'x-content-type-options:\s*nosniff'; then
  ok "X-Content-Type-Options: nosniff"
else
  fail "Falta X-Content-Type-Options (¿Helmet activo?)"
fi
if echo "$HDRS" | grep -qiE 'x-frame-options:|content-security-policy:|cross-origin-opener-policy:|x-dns-prefetch-control:'; then
  ok "Algún header de seguridad presente"
else
  warn "No se detectaron otros headers típicos de Helmet (puede variar por versión)"
fi

# --- 3. Uploads sin token ---
echo ">>> [3] /uploads sin autenticación"
# Probar un path inventado: debe ser 401 (protegido) o 404 tras auth.
# Sin token: expect 401 (o 403). Si PUBLIC_UPLOADS=1, avisar.
CODE_UP="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 \
  "${BASE_URL}/uploads/__smoke_nonexistent__.jpg" 2>/dev/null || true)"
CODE_UP="${CODE_UP:-000}"
case "$CODE_UP" in
  401|403) ok "/uploads sin token → HTTP ${CODE_UP} (protegido)" ;;
  404) warn "/uploads sin token → 404 (¿PUBLIC_UPLOADS=1 o fallthrough distinto?)" ;;
  200) fail "/uploads sin token → 200 (NO debe ser público)" ;;
  *) fail "/uploads sin token → HTTP ${CODE_UP} (esperado 401/403)" ;;
esac

# --- 4. Login + token ---
TOKEN=""
if [ -n "$EMAIL" ] && [ -n "$PASS" ]; then
  echo ">>> [4] Login + uploads con token + paginación"
  if [ "$PASS" = "tu_password" ] || [ "$PASS" = "YOUR_PASSWORD" ]; then
    fail "PASS parece un placeholder ('${PASS}'). Usa la contraseña real del admin (seed: password123)."
  else
    export EMAIL PASS
    LOGIN_BODY_FILE="$(mktemp)"
    LOGIN_CODE="$(curl -s -o "${LOGIN_BODY_FILE}" -w '%{http_code}' --connect-timeout 8 \
      -X POST "${BASE_URL}/api/auth/login" \
      -H 'Content-Type: application/json' \
      -d "$(python3 -c "import json,os; print(json.dumps({'email':os.environ['EMAIL'],'password':os.environ['PASS']}))")" \
      2>/dev/null || true)"
    LOGIN_CODE="${LOGIN_CODE:-000}"
    LOGIN_JSON="$(cat "${LOGIN_BODY_FILE}" 2>/dev/null || true)"
    rm -f "${LOGIN_BODY_FILE}"

    if [ "$LOGIN_CODE" != "200" ]; then
      ERR_MSG="$(echo "$LOGIN_JSON" | python3 -c "import json,sys
try:
 d=json.load(sys.stdin)
 print(d.get('error') or d.get('message') or sys.stdin.read()[:120])
except Exception:
 print('')" 2>/dev/null || true)"
      fail "Login HTTP ${LOGIN_CODE}${ERR_MSG:+ — ${ERR_MSG}} (revisa EMAIL/PASS; seed: admin@fiix.com / password123)"
    else
      TOKEN="$(echo "$LOGIN_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('token') or '')" 2>/dev/null || true)"
      if [ -n "$TOKEN" ]; then
        ok "Login OK (JWT recibido)"
      else
        fail "Login 200 pero sin token en respuesta"
      fi
    fi
  fi

  if [ -n "$TOKEN" ]; then
    # Uploads con query token (mismo mecanismo que <img>)
    CODE_AUTH="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 \
      "${BASE_URL}/uploads/__smoke_nonexistent__.jpg?access_token=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${TOKEN}'''))")" \
      2>/dev/null || true)"
    CODE_AUTH="${CODE_AUTH:-000}"
    case "$CODE_AUTH" in
      404) ok "/uploads con access_token → 404 (auth OK, archivo inexistente)" ;;
      401|403) fail "/uploads con access_token → ${CODE_AUTH} (token no aceptado)" ;;
      200) warn "/uploads con token → 200 inesperado para archivo inventado" ;;
      500) fail "/uploads con token → 500 (debería ser 404 si el archivo no existe)" ;;
      *) warn "/uploads con token → HTTP ${CODE_AUTH}" ;;
    esac

    # Paginación activos
    ASSETS="$(curl -fsS --connect-timeout 10 \
      -H "Authorization: Bearer ${TOKEN}" \
      "${BASE_URL}/api/assets?page=1&limit=5" || true)"
    if echo "$ASSETS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert isinstance(d.get('data'), list), d
assert 'total' in d and 'page' in d and 'totalPages' in d, d
assert d.get('limit') == 5 or d.get('limit') == 5, d
print('assets page=',d.get('page'),'total=',d.get('total'),'rows=',len(d.get('data') or []))
"; then
      ok "GET /api/assets?page&limit → forma paginada"
    else
      fail "GET /api/assets paginado no devolvió {data,total,page,limit,totalPages}"
    fi

    # Compat: sin page sigue array (o paginado — ambas OK si hay datos)
    ASSETS_ALL="$(curl -fsS --connect-timeout 15 \
      -H "Authorization: Bearer ${TOKEN}" \
      "${BASE_URL}/api/assets" || true)"
    if echo "$ASSETS_ALL" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ok = isinstance(d, list) or (isinstance(d, dict) and isinstance(d.get('data'), list))
assert ok, d
print('assets compat type=', type(d).__name__)
"; then
      ok "GET /api/assets sin page (compat)"
    else
      fail "GET /api/assets sin page respuesta inesperada"
    fi

    # Paginación items
    ITEMS="$(curl -fsS --connect-timeout 10 \
      -H "Authorization: Bearer ${TOKEN}" \
      "${BASE_URL}/api/inventory/items?page=1&limit=5" || true)"
    if echo "$ITEMS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert isinstance(d.get('data'), list), d
assert 'total' in d and 'page' in d, d
print('items page=',d.get('page'),'total=',d.get('total'),'rows=',len(d.get('data') or []))
"; then
      ok "GET /api/inventory/items?page&limit → forma paginada"
    else
      fail "GET /api/inventory/items paginado inválido"
    fi

    # KPI top failing (no debe 500)
    KPI_CODE="$(curl -s -o /tmp/fiix-kpi-smoke.json -w '%{http_code}' --connect-timeout 20 \
      -H "Authorization: Bearer ${TOKEN}" \
      "${BASE_URL}/api/kpis/top-failures" 2>/dev/null || true)"
    KPI_CODE="${KPI_CODE:-000}"
    if [[ "$KPI_CODE" =~ ^2 ]]; then
      ok "GET /api/kpis/top-failures → HTTP ${KPI_CODE}"
    else
      fail "GET /api/kpis/top-failures → HTTP ${KPI_CODE}"
    fi
    # Body JSON oversized (express limit ~2mb) — 413 o 400
    info "Probando cuerpo JSON grande (~3MB)..."
    BIG_CODE="$(python3 - <<'PY' | curl -s -o /dev/null -w '%{http_code}' --connect-timeout 15 \
      -X POST "${BASE_URL}/api/auth/login" \
      -H 'Content-Type: application/json' \
      --data-binary @- 2>/dev/null || true
import json
print(json.dumps({"email":"x@y.z","password":"p","pad":"A"*3_000_000}))
PY
)"
    BIG_CODE="${BIG_CODE:-000}"
    case "$BIG_CODE" in
      413|400|500) ok "JSON oversized → HTTP ${BIG_CODE} (rechazado/limitado)" ;;
      401) warn "JSON oversized → 401 (llegó al login; límite puede ser más alto)" ;;
      *) warn "JSON oversized → HTTP ${BIG_CODE}" ;;
    esac
  fi
else
  warn "Sin EMAIL/PASS — se omiten checks autenticados (login, paginación, KPI, uploads+token)"
  info "Ejemplo: EMAIL=admin@fiix.com PASS=password123 bash ./scripts/smoke-hardening.sh"
  info "Importante: PASS debe ser la contraseña real (no 'tu_password')."
fi

# --- 5. CORS preflight sanity (informativo) ---
echo ">>> [5] CORS preflight (informativo)"
CORS_CODE="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 \
  -X OPTIONS "${BASE_URL}/api/health" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" 2>/dev/null || true)"
CORS_CODE="${CORS_CODE:-000}"
if [[ "$CORS_CODE" =~ ^2 ]]; then
  ok "OPTIONS localhost:5173 → HTTP ${CORS_CODE}"
else
  warn "OPTIONS → HTTP ${CORS_CODE} (revisa CORS_ORIGINS si usas otro origen)"
fi

echo
echo "=== Resumen: OK=${PASS_N}  FAIL=${FAIL_N}  AVISO=${WARN_N} ==="
if [ "$FAIL_N" -gt 0 ]; then
  echo "Resultado: FALLÓ (hay P0)." >&2
  exit 1
fi
echo "Resultado: PASS (avisos no bloquean)."
exit 0
