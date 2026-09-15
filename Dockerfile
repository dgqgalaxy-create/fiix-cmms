# ============================================================
# GTZ CMMS — imagen Docker
# Etapa 1: compila backend (tsc) y frontend (vite).
# Etapa 2: runtime ligero con cliente PostgreSQL (respaldos) y tar/gzip.
# ============================================================

# ---- Etapa 1: build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Backend
COPY backend/package.json backend/package-lock.json backend/
COPY backend/prisma.config.ts backend/
COPY backend/prisma backend/prisma
COPY backend/tsconfig.json backend/
COPY backend/src backend/src
RUN cd backend && npm ci && npx prisma generate && npm run build

# Frontend
COPY frontend/package.json frontend/package-lock.json frontend/
COPY frontend/ frontend/
RUN cd frontend && npm ci && npm run build:app

# ---- Etapa 2: runtime ----
FROM node:22-bookworm-slim

# pg_dump/psql (respaldos/restore), tar/gzip (uploads/backups), tini (PID 1).
# pg_dump/psql (respaldos/restore), tar/gzip (uploads/backups), tini (PID 1).
# El cliente PostgreSQL debe ser >= la versión del servidor (postgres:16-alpine):
# el paquete por defecto de Debian 12 es v15 y pg_dump 15 rechaza volcar PG 16.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg postgresql-common tar gzip ca-certificates tini \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list' \
    && apt-get update && apt-get install -y --no-install-recommends postgresql-client-16 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY --from=build /app/backend/node_modules /app/backend/node_modules
COPY --from=build /app/backend/dist /app/backend/dist
COPY --from=build /app/backend/prisma /app/backend/prisma
COPY --from=build /app/backend/prisma.config.ts /app/backend/prisma.config.ts
COPY --from=build /app/backend/package.json /app/backend/package.json
COPY --from=build /app/frontend/dist /app/frontend/dist

# Entrypoint: sincroniza el esquema (db push) y arranca el servidor.
COPY docker/entrypoint.sh /usr/local/bin/fiix-entrypoint.sh
RUN chmod +x /usr/local/bin/fiix-entrypoint.sh

WORKDIR /app/backend
EXPOSE 3000
ENTRYPOINT ["tini", "--", "/usr/local/bin/fiix-entrypoint.sh"]
