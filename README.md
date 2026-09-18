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
#    Hay una plantilla comentada en .env.example → cp .env.example .env
cat > .env <<'EOF'
DB_PASSWORD=tu_clave_fuerte
JWT_SECRET=tu_secreto_jwt
PORT=3000
# Si publicas la app en Internet con un dominio propio (Cloudflare Tunnel, nginx,
# Tailscale Funnel), añade aquí el hostname público; si no, CORS lo rechazará.
# CORS_ORIGINS="https://cmms.ejemplo.com"
# Opcionales — Web Push PWA (genera un par con: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY="BC..."
VAPID_PRIVATE_KEY="xyz..."
VAPID_SUBJECT="mailto:mantenimiento@tuempresa.com"
EOF
# Nota: Google Drive y Telegram se configuran desde la app (Opciones de
# Desarrollador → Integraciones); el .env solo es respaldo si el campo está vacío.

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
| `CORS_ORIGINS` | `.env` raíz | `.env` | Orígenes extra para CORS y Socket.IO, separados por comas. **Necesario si entras por un dominio público** (Cloudflare Tunnel, nginx, Tailscale Funnel). Ej.: `CORS_ORIGINS="https://cmms.ejemplo.com"` |
| `ALLOWED_ORIGINS` | `.env` raíz | `.env` | Alias de `CORS_ORIGINS` (si defines las dos, gana `CORS_ORIGINS`) |
| `ALLOW_DB_PUSH_DATA_LOSS` | `.env` raíz | — | Déjalo sin definir. `1` permite que `prisma db push` borre datos para cuadrar el esquema; con el valor por defecto (`0`) el arranque falla y los datos se conservan |
| `GOOGLE_DRIVE_*` | **desde la app** | **desde la app** | Configurar en Opciones de Desarrollador → Integraciones → Google Drive (enmascaradas, guardadas en BD); el `.env` solo es respaldo opcional |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | **desde la app** | **desde la app** | Configurar en Opciones de Desarrollador → Integraciones → Telegram; el `.env` solo es respaldo (p. ej. para el healthcheck externo en Ubuntu) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `.env` raíz | `.env` | Opcional: notificaciones Web Push (ver abajo cómo generarlas; la instalación nativa las auto-genera) |

### Web Push (VAPID)

Son las credenciales de las **notificaciones del dispositivo** (PWA): avisos de nuevas OT o SLA aunque la app esté cerrada. Sin ellas, el botón de activar notificaciones (campana / Configuración → Apariencia) no funciona, pero el resto de la app sí.

**Cómo generarlas:**

```bash
npx web-push generate-vapid-keys
```

El comando imprime una llave pública y una privada. Configúralas en el `.env` (raíz en Docker, `backend/.env` en nativo):

```
VAPID_PUBLIC_KEY=<la llave pública generada>
VAPID_PRIVATE_KEY=<la llave privada generada — manténla en secreto>
VAPID_SUBJECT=mailto:mantenimiento@tuempresa.com
```

- La instalación nativa (`install.sh`) las genera sola si faltan.
- **Migración importante:** si tus técnicos ya tenían notificaciones activadas en otro servidor, **copia las mismas claves** de ese `.env` (no generes unas nuevas), o cada usuario tendrá que volver a activar las notificaciones en su celular.

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

## Publicar en Internet con un dominio propio (Cloudflare Tunnel)

La app sirve API + frontend en **un solo puerto** (`3000`), así que cualquier proxy
inverso vale como fachada. Si el servidor está en una red sin IP fija o detrás de CGNAT,
la opción recomendada es **Cloudflare Tunnel**: `cloudflared` abre una conexión
**saliente** por HTTPS hacia Cloudflare, así que **no hay que abrir puertos en el router
ni exponer el 3000 a Internet**.

**Arquitectura de producción:**

```
Internet
  → HTTPS  (https://cmms.ejemplo.com)
  → Cloudflare  (DNS + TLS + WAF)
  → Cloudflare Tunnel  (cloudflared como servicio systemd en el servidor Ubuntu)
  → http://localhost:3000
  → GTZ CMMS  (contenedor «app», Docker)
  → PostgreSQL 17  (contenedor «db», volumen pgdata17)
```

> `cloudflared` corre **nativo en el host** y es independiente del `docker-compose.yml`
> de GTZ CMMS. El token/credenciales del túnel **no se guardan en este repositorio**.

### Pasos

1. Levanta la app como siempre y verifica que responde en local:

   ```bash
   sudo docker compose up -d --build
   curl http://localhost:3000/api/health   # → {"status":"ok",...}
   ```

2. Instala y autentica `cloudflared` en el host (no dentro del compose):

   ```bash
   curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
     | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
   echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
     | sudo tee /etc/apt/sources.list.d/cloudflared.list
   sudo apt update && sudo apt install -y cloudflared
   cloudflared tunnel login
   cloudflared tunnel create cmms
   ```

3. Enruta el hostname público al puerto local donde publica el compose:

   ```bash
   cloudflared tunnel route dns cmms cmms.ejemplo.com
   ```

   En `~/.cloudflared/config.yml`:

   ```yaml
   tunnel: <UUID-del-tunel>
   credentials-file: /home/<usuario>/.cloudflared/<UUID>.json
   ingress:
     - hostname: cmms.ejemplo.com
       service: http://localhost:3000
     - service: http_status:404
   ```

   ```bash
   sudo cloudflared service install   # instala el servicio systemd
   sudo systemctl enable --now cloudflared
   ```

4. **Añade el hostname público a `CORS_ORIGINS`** en el `.env` de la raíz. Sin este paso
   verás `CORS: origen no permitido` y la app puede quedarse en pantalla blanca:

   ```bash
   # .env (raíz del proyecto) — ejemplo; usa TU dominio
   CORS_ORIGINS="https://cmms.ejemplo.com"
   ```

   Varios orígenes se separan por comas (por ejemplo el dominio público y una IP de la LAN):

   ```bash
   CORS_ORIGINS="https://cmms.ejemplo.com,http://192.168.1.50:3000"
   ```

5. Recrea el contenedor para que reciba la variable y abre el dominio:

   ```bash
   sudo docker compose up -d
   ```

### Notas

- **Cloudflare Tunnel y Tailscale conviven** sin problema: Tailscale sigue sirviendo para
  administración y acceso privado (`https://<host>.<tailnet>.ts.net`), y sus orígenes
  (`*.ts.net`, `100.x`) están permitidos por defecto aunque no los pongas en `CORS_ORIGINS`.
- Si entras por LAN (`http://192.168.x.x:3000`) o por Tailscale, **tampoco necesitas**
  `CORS_ORIGINS`: esos orígenes ya están permitidos por defecto.
- El mismo procedimiento aplica a otros proxys inversos (nginx, Caddy, Tailscale Funnel):
  publica el puerto 3000 y añade el hostname público a `CORS_ORIGINS`.
- Guía Docker completa, con volúmenes y respaldos: [`docs/guia-docker.md`](docs/guia-docker.md).

---

## Actualización y mantenimiento

### Docker

```bash
# Actualiza código y reconstruye la imagen
cd ~/fiix-cmms
git restore .          # descarta cambios locales en ARCHIVOS VERSIONADOS (evita conflictos con pull)
git pull
sudo docker compose up -d --build   # (sin sudo si tu usuario está en el grupo docker)
```

> La imagen se construye localmente con el `Dockerfile` del repo (no se descarga de un registro).

**Qué sobrevive a este procedimiento y qué no:**

| Elemento | ¿Se conserva? | Por qué |
|---|---|---|
| `.env` de la raíz (claves, `CORS_ORIGINS`, `PORT`…) | ✅ Sí | Está en `.gitignore`, así que **no es un archivo versionado**: `git restore .` no lo toca y `git pull` no lo sobrescribe. |
| Volúmenes `pgdata17`, `uploads`, `data`, `backups` | ✅ Sí | `docker compose up -d --build` solo recrea los contenedores; los volúmenes nombrados se reutilizan. |
| Cambios manuales en `docker-compose.yml`, `Dockerfile`, `backend/.env.example`… | ❌ No | Son archivos versionados: `git restore .` los revierte. **Por eso la configuración específica del servidor va siempre en `.env`**, nunca editando el compose a mano. |

> **Ya no hace falta editar `docker-compose.yml` para Cloudflare.** El compose pasa
> `CORS_ORIGINS` al contenedor desde el `.env` (ver la sección
> [Publicar en Internet con un dominio propio](#publicar-en-internet-con-un-dominio-propio-cloudflare-tunnel)),
> así que `git restore . && git pull && sudo docker compose up -d --build` es seguro:
> el dominio público sigue funcionando sin volver a tocar archivos versionados.

> ⚠️ **Nunca uses `docker compose down -v`** en producción: `-v` borra los volúmenes
> (`pgdata17`, `uploads`, `data`, `backups`) y con ellos la base de datos entera.

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
