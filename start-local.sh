#!/usr/bin/env bash
# Arranque local de desarrollo (fuera del sandbox de Cursor).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> PostgreSQL"
sudo service postgresql start || sudo systemctl start postgresql
pg_isready -h 127.0.0.1

if [[ ! -f backend/.env ]]; then
  read -r -s -p "Contraseña PostgreSQL (usuario postgres): " PG_PASS
  echo
  cat > backend/.env <<EOF
DATABASE_URL="postgresql://postgres:${PG_PASS}@localhost:5432/fiix_cmms?schema=public"
JWT_SECRET="mi_secreto_super_seguro_para_jwt_123"
EOF
  echo "Creado backend/.env"
fi

echo "==> Dependencias"
(cd backend && npm install)
(cd frontend && npm install)

echo "==> Prisma"
(cd backend && npx prisma migrate dev)
(cd backend && npx prisma db seed || true)

mkdir -p "$ROOT/.run"
echo "==> Backend :3000"
(cd backend && npm run dev) >"$ROOT/.run/backend.log" 2>&1 &
echo $! >"$ROOT/.run/backend.pid"
echo "==> Frontend :5173"
(cd frontend && npm run dev) >"$ROOT/.run/frontend.log" 2>&1 &
echo $! >"$ROOT/.run/frontend.pid"

sleep 3
echo
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3000"
echo "Login seed: admin@fiix.com / password123"
echo "Logs: $ROOT/.run/*.log"
echo "Parar: kill \$(cat $ROOT/.run/backend.pid) \$(cat $ROOT/.run/frontend.pid)"
