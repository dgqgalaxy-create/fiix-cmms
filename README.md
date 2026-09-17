# GTZ CMMS

Sistema de Gestión de Mantenimiento (CMMS) self-hosted: órdenes de trabajo, activos, inventario, preventivos, checklist, KPIs, compras, RCA, roster y notificaciones (Telegram + Web Push PWA).

**Stack:** PostgreSQL · Prisma · Node.js 22+ / Express · React/Vite · Tailwind v4 · Socket.IO · PM2 o Docker (servidor)

---

## Instalación rápida

### Docker (recomendado)

```bash
# Requisitos: Docker + Docker Compose (en Ubuntu: sudo apt install docker.io docker-compose-v2)
# Repo privado: configura una llave SSH de solo lectura en GitHub antes del clone
# (o clona por HTTPS con un token: https://TOKEN@github.com/dgqgalaxy-create/fiix-cmms.git)
git clone git@github.com:dgqgalaxy-create/fiix-cmms.git ~/fiix-cmms
cd ~/fiix-cmms

# 1) Crea el archivo .env en la raíz del proyecto con tus claves (cambia los valores de ejemplo)
cat > .env <<'EOF'
DB_PASSWORD=tu_clave_fuerte
JWT_SECRET=tu_secreto_jwt
PORT=3000
# Opcionales — alertas Telegram (también editables desde la app)
TELEGRAM_BOT_TOKEN="123456:ABC..."
TELEGRAM_CHAT_ID="-100123456789"
# Opcionales — Web Push PWA (genera un par con: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY="BC..."
VAPID_PRIVATE_KEY="xyz..."
VAPID_SUBJECT="mailto:mantenimiento@tuempresa.com"
EOF
# Nota: Google Drive se configura desde la app (Opciones de Desarrollador →
# Integraciones → Google Drive); el .env solo es respaldo si el campo está vacío.

# 2) Levanta los contenedores (sudo si tu usuario no está en el grupo docker)
sudo docker compose up -d --build

# (Alternativa a sudo: agrega tu usuario al grupo docker y vuelve a entrar)
# sudo usermod -aG docker $USER

# Acceder: http://IP:3000
# Usuarios de demo: admin@fiix.com / gestionador@fiix.com / tecnico@fiix.com (contraseña: password123)
# Para arrancar con los datos de otro servidor: Opciones de Desarrollador → Restaurar desde archivo
```

> Si prefieres pasar las claves en línea sin crear `.env`, usa `sudo -E` para conservarlas:
> ```bash
> DB_PASSWORD=... JWT_SECRET=... sudo -E docker compose up -d --build
> ```

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

En Docker, todas se definen en el archivo **`.env` de la raíz del proyecto** (docker compose lo lee y las pasa al contenedor). En Ubuntu nativo, van en `backend/.env`.

| Variable | Docker | Ubuntu | Notas |
|---|---|---|---|
| `DB_PASSWORD` | `.env` raíz | — | Contraseña del PostgreSQL interno del compose |
| `DATABASE_URL` | automática (usa `db:5432`) | `.env` | En Docker no la cambies salvo que uses una BD externa |
| `JWT_SECRET` | `.env` raíz | `.env` | Secreto de sesiones (genera uno fuerte) |
| `PORT` | `.env` raíz | — | Puerto del host (por defecto 3000) |
| `SKIP_DB_PUSH` | `.env` raíz | — | `1` = no sincronizar esquema al arrancar (restaurar backups) |
| `GOOGLE_DRIVE_*` | **desde la app** | **desde la app** | Configurar en Opciones de Desarrollador → Integraciones → Google Drive (enmascaradas, guardadas en BD); el `.env` solo es respaldo opcional |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | `.env` raíz | `.env` | Opcional: alertas por Telegram |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `.env` raíz | `.env` | Opcional: notificaciones Web Push (instalación nativa las auto-genera) |

### Google Drive (fotos en importación)

Usa carpetas públicas de Google Drive para importar fotos automáticamente en CSV/Sheets (en lugar de ZIPs).

**Pasos:**
1. Obtén [Google API key](https://console.cloud.google.com/) con Drive API habilitada.
2. Crea 3 carpetas públicas en Drive ("Cualquiera con el enlace") con tus fotos:
   - Inventario: repuestos/items
   - Proveedores: logos
   - Órdenes: fotos antes/después
3. Configura las claves **desde la app**: Opciones de Desarrollador → Integraciones → **Google Drive**. Se guardan en la base de datos, se muestran enmascaradas (con botón Mostrar/Ocultar) y aplican al instante sin reiniciar. (Respaldo opcional: si el campo guardado queda vacío, se usa el valor del `.env` del servidor.)

> Nota: la documentación detallada de Google Drive está en el histórico del proyecto (la configuración actual usa las variables `GOOGLE_DRIVE_*` listadas arriba).

### Importar datos (CSV + fotos)

1. Ve a **Opciones de Desarrollador** → **Importar CSV**.
2. Sube los 7 CSVs de ejemplo (en `data/`) o tus propios.
3. Elige fuente de fotos: ZIP local, Google Drive, o carpeta `data/`.
4. Después: importa **Calendario de Horarios** (módulo Horarios) al final.

---

## Actualización y mantenimiento

### Docker

```bash
# Actualiza código y reconstruye la imagen
cd ~/fiix-cmms
git restore .          # descarta cambios locales en el servidor (evita conflictos con pull)
git pull
sudo docker compose up -d --build   # (sin sudo si tu usuario está en el grupo docker)
```

> La imagen se construye localmente con el `Dockerfile` del repo (no se descarga de un registro).

### Ubuntu nativo

```bash
cd ~/fiix-cmms
./update.sh  # actualiza código, PM2, base de datos
```

### Respaldos

Se generan automáticamente **todos los días a las 2:15 AM** (retención de 14 días).

- **Docker:** quedan en el volumen `fiix-cmms_backups` (carpeta `/backups` del contenedor). Restaura desde la app: **Opciones de Desarrollador → Restaurar respaldo**; o usa **Descargar respaldos / Restaurar desde archivo** para migrar entre servidores.
- **Ubuntu nativo:** quedan en `~/fiix-backups` (o `BACKUP_DIR`). Restaurar:

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
- **Manual de usuario:** [`docs/manual_usuario.md`](docs/manual_usuario.md)
- **Respaldos y recuperación:** [`docs/backup-strategy.md`](docs/backup-strategy.md)
- **Plan de pruebas:** [`docs/plan_pruebas.md`](docs/plan_pruebas.md)
- **Contexto del proyecto:** [`docs/project_context.md`](docs/project_context.md)
- **Scripts legados:** [`docs/legacy-scripts.md`](docs/legacy-scripts.md)
- **Histórico y roadmap:** [`docs/roadmap.md`](docs/roadmap.md)

---

## Licencia & Soporte

Repositorio privado. Para soporte o preguntas: contacta al equipo de desarrollo.
