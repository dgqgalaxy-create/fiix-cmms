# Guía Docker — GTZ CMMS

Despliegue alternativo en contenedores para quien prefiera no instalar Node.js + PostgreSQL de forma nativa (ver `install.sh`). La app es **un solo proceso** (Express) que sirve la API y el frontend compilado (`frontend/dist`) en el puerto `3000`.

---

## 1. Requisitos

- **Docker** + **Docker Compose** en la máquina servidor (o de prueba).
- Puerto `3000` accesible en la red (abre el firewall si es necesario).

Instalación rápida en Ubuntu:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # re-inicia sesión después
```

---

## 2. Estructura de archivos

| Archivo | Propósito |
|---|---|
| `Dockerfile` | Compila backend + frontend y deja una imagen ligera con `pg_dump`/`psql`/`tar` (respaldos). |
| `docker-compose.yml` | Levanta `db` (PostgreSQL 17) + `app` (GTZ CMMS). |
| `.dockerignore` | Evita subir `node_modules`, `dist`, secretos y datos al contexto de build. |
| `docker/entrypoint.sh` | Aplica el esquema (`prisma db push`), siembra usuarios demo y arranca el servidor (en BD vacía crea el esquema primero). |

---

## 3. Levantar

```bash
cd fiix-cmms

# 1) Crea el .env raíz con tus claves (docker compose lo lee solo). Plantilla completa en el README.
cat > .env <<'EOF'
DB_PASSWORD=una_clave_fuerte
JWT_SECRET=otro_secreto_largo
PORT=3000
# Opcionales: GOOGLE_DRIVE_*, TELEGRAM_*, VAPID_* (ver README)
EOF

# 2) Construye y arranca (sudo si tu usuario no está en el grupo docker)
sudo docker compose up -d --build
```

Variables útiles (todas opcionales, con defaults de prueba):

| Variable | Default | Descripción |
|---|---|---|
| `DB_PASSWORD` | `fiix_dev_pass` | Contraseña de PostgreSQL. |
| `JWT_SECRET` | `cambia_este_secreto_jwt` | Secreto para firmar tokens. **Cámbialo.** |
| `PORT` | `3000` | Puerto publicado en el host. |
| `SKIP_DB_PUSH` | `0` | Pon `1` para no aplicar el esquema al arrancar (cuando restauras un backup). |
| `GOOGLE_DRIVE_API_KEY`, `GOOGLE_DRIVE_ITEMS_FOLDER`, `GOOGLE_DRIVE_VENDORS_FOLDER`, `GOOGLE_DRIVE_WO_FOLDER` | vacío | Fotos desde Google Drive. También editables desde la app: **Opciones de Desarrollador → Integraciones → Google Drive** (guardadas en BD, enmascaradas; el `.env` queda como respaldo). |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | vacío | Alertas de Telegram (también editables desde la app). |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | vacío | Notificaciones Web Push PWA. |

Verificar:

```bash
curl http://localhost:3000/api/health
```

Acceso desde la red: **`http://<IP-del-servidor>:3000`**.

---

## 4. Volúmenes (persistencia)

| Volumen | Contenido |
|---|---|
| `pgdata` | Base de datos PostgreSQL. |
| `uploads` | Fotos/evidencias (`backend/uploads`). |
| `data` | CSVs/Excel/imágenes de referencia (`data/`). |
| `backups` | Respaldos generados por la app (`BACKUP_DIR=/backups`). |

---

## 5. Probar con datos reales (restaurar backup)

1. Genera un respaldo en el servidor actual (botón «Crear respaldo» en Opciones de Desarrollador, o `scripts/backup.sh`).
2. Copia los 4 archivos (`fiix_*.sql.gz`, `uploads_*.tar.gz`, `data_*.tar.gz`, `env_*.env`) a la máquina Docker.
3. Arranca **sin** tocar el esquema y restaura:

```bash
SKIP_DB_PUSH=1 DB_PASSWORD=tu_clave JWT_SECRET=tu_secreto docker compose up -d --build

# Restaurar base de datos
gunzip -c fiix_20260831_0200.sql.gz | docker compose exec -T db psql -U postgres -d fiix_cmms -v ON_ERROR_STOP=1

# Restaurar fotos y data (copiando dentro de los volúmenes)
tar -xzf uploads_20260831_0200.tar.gz -C backend/
docker compose cp backend/uploads app:/app/backend/
tar -xzf data_20260831_0200.tar.gz
docker compose cp data app:/app/

docker compose restart app
```

> Forma más simple (recomendada): con la app ya levantada, entra con el admin demo y usa **Opciones de Desarrollador → «Restaurar desde archivo»** para subir el `fiix_*.sql.gz` (y el `uploads_*.tar.gz` si quieres las fotos) sin tocar la terminal; o **«Restaurar respaldo»** si los archivos ya están dentro del volumen `backups`.

---

## 6. Detener / limpiar

```bash
docker compose down          # detiene (conserva volúmenes)
docker compose down -v       # detiene Y borra volúmenes (empezar de cero)
```

---

## 7. Nota sobre HTTPS (cámara)

- El **Portal de Solicitudes** (`/request`) captura fotos con `<input type="file" capture>`, por lo que **funciona sobre HTTP** sin dominio ni HTTPS.
- Lo que sí exige HTTPS es el **escáner QR en vivo** (`getUserMedia`). Para HTTPS sin instalar nada en los teléfonos: Cloudflare Tunnel (gratis) o un dominio barato + Let's Encrypt (ver discusión en el historial del proyecto).
