# GTZ CMMS

Sistema de Gestión de Mantenimiento (CMMS) self-hosted: órdenes de trabajo, activos, inventario, preventivos, checklist, KPIs, compras, RCA, roster y notificaciones (Telegram + Web Push PWA).

**Stack:** PostgreSQL · Prisma · Node.js 22+ / Express · React/Vite · Tailwind v4 · Socket.IO · PM2 (servidor)

---

## Instalación rápida

### Docker (recomendado)

```bash
# Requisitos: Docker + Docker Compose
git clone git@github.com:dgqgalaxy-create/fiix-cmms.git ~/fiix-cmms
cd ~/fiix-cmms

# Instancia con seed de usuarios y Google Drive opcional para fotos
DB_PASSWORD=tu_clave_fuerte \
JWT_SECRET=tu_secreto_jwt \
GOOGLE_DRIVE_API_KEY="tu_api_key_opcional" \
GOOGLE_DRIVE_ITEMS_FOLDER="https://drive.google.com/drive/folders/ID_inventario" \
GOOGLE_DRIVE_VENDORS_FOLDER="https://drive.google.com/drive/folders/ID_proveedores" \
GOOGLE_DRIVE_WO_FOLDER="https://drive.google.com/drive/folders/ID_ordenes" \
docker compose up -d --build

# Acceder: http://IP:3000
# Usuarios de demo: admin@fiix.com / gestionador@fiix.com / tecnico@fiix.com (contraseña: password123)
```

### Ubuntu nativo (sin Docker)

```bash
# Requisitos previos: Git, Node.js 22+, PostgreSQL

git clone git@github.com:dgqgalaxy-create/fiix-cmms.git ~/fiix-cmms
cd ~/fiix-cmms

# Dar permisos y ejecutar instalación
chmod +x install.sh update.sh
./install.sh

# Sigue los pasos interactivos (PostgreSQL, JWT, opcionales: PM2, nginx, Telegram, etc.)
```

---

## Uso y configuración

### Login inicial

| Email | Contraseña | Rol |
|---|---|---|
| `admin@fiix.com` | `password123` | Administrador (cámbialo al entrar) |
| `gestionador@fiix.com` | `password123` | Gestionador |
| `tecnico@fiix.com` | `password123` | Técnico (órdenes de trabajo) |

### Variables de entorno esenciales

| Variable | Docker | Ubuntu | Notas |
|---|---|---|---|
| `DATABASE_URL` | docker-compose | `.env` | PostgreSQL (se configura en install.sh) |
| `JWT_SECRET` | docker-compose | `.env` | Secreto de sesiones (genera uno fuerte) |
| `DB_PASSWORD` | docker-compose | `.env` | Contraseña PostgreSQL |
| `GOOGLE_DRIVE_*` | docker-compose | `.env` | Opcional: importar fotos desde Google Drive (ver abajo) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | `.env` | `.env` | Opcional: alertas por Telegram |
| `VAPID_*` | `.env` | `.env` | Opcional: notificaciones Web Push (auto-genera install.sh) |

### Google Drive (fotos en importación)

Usa carpetas públicas de Google Drive para importar fotos automáticamente en CSV/Sheets (en lugar de ZIPs).

**Pasos:**
1. Obtén [Google API key](https://console.cloud.google.com/) con Drive API habilitada.
2. Crea 3 carpetas públicas en Drive ("Cualquiera con el enlace") con tus fotos:
   - Inventario: repuestos/items
   - Proveedores: logos
   - Órdenes: fotos antes/después
3. Pasa las URLs/IDs al arrancar Docker o en `backend/.env`.

Ver documentación completa: [`docs/google-drive-setup.md`](docs/google-drive-setup.md)

### Importar datos (CSV + fotos)

1. Ve a **Opciones de Desarrollador** → **Importar CSV**.
2. Sube los 7 CSVs de ejemplo (en `data/`) o tus propios.
3. Elige fuente de fotos: ZIP local, Google Drive, o carpeta `data/`.
4. Después: importa **Calendario de Horarios** (módulo Horarios) al final.

---

## Actualización y mantenimiento

### Docker

```bash
# Pull + rebuild
cd ~/fiix-cmms
docker compose pull
docker compose up -d --build
```

### Ubuntu nativo

```bash
cd ~/fiix-cmms
./update.sh  # actualiza código, PM2, base de datos
```

### Respaldos

Automáticos diarios a `~/fiix-backups` (o `BACKUP_DIR`). Restaurar:

```bash
chmod +x scripts/restore.sh
./scripts/restore.sh fiix_YYYYMMDD_HHMM.sql.gz
```

Ver guía completa: [`docs/backup-strategy.md`](docs/backup-strategy.md)

---

## Desarrollo local

```bash
# Backend
cd backend && npm install
cp .env.example .env  # Edita con tu DATABASE_URL local
npx prisma generate && npx prisma db push
npm run dev  # http://localhost:3000

# Frontend (en otra terminal)
cd frontend && npm install
npm run dev  # http://localhost:5173 (hot reload)
```

Extensiones recomendadas (VS Code): Prettier, Tailwind CSS IntelliSense, Prisma.

---

## Características principales

- **Órdenes de trabajo:** flujo completo (crear, aceptar, pausar, finalizar) con soporte web + móvil (PWA).
- **Inventario:** gestión de repuestos con códigos QR, escáner en celular.
- **Mantenimiento preventivo:** calendario de tareas recurrentes.
- **Compras:** requisiciones, órdenes de compra, historial.
- **Reportes & KPIs:** dashboards de disponibilidad, eficiencia, costos; informe MTTR/MTBF por línea (L1–L5) con periodo seleccionable y desglose por equipo.
- **RCA:** análisis de causa raíz con evidencias (fotos/PDFs).
- **Notificaciones:** Telegram + Web Push PWA.
- **Tiempo real:** Socket.IO para actualizaciones en vivo.

---

## Documentación completa

- **Guía Docker avanzada** (volúmenes, HTTPS, restaurar backups): [`docs/guia-docker.md`](docs/guia-docker.md)
- **Setup SSH y deploy:** [`docs/git-setup.md`](docs/git-setup.md)
- **Troubleshooting:** [`docs/troubleshooting.md`](docs/troubleshooting.md)
- **Google Drive:** [`docs/google-drive-setup.md`](docs/google-drive-setup.md)
- **Manual de usuario:** [`docs/manual_usuario.md`](docs/manual_usuario.md)
- **Respaldos y recuperación:** [`docs/backup-strategy.md`](docs/backup-strategy.md)
- **Histórico y roadmap:** [`docs/roadmap.md`](docs/roadmap.md)

---

## Licencia & Soporte

Repositorio privado. Para soporte o preguntas: contacta al equipo de desarrollo.
