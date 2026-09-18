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
| `docker-compose.yml` | Levanta `db` (PostgreSQL 17) + `app` (GTZ CMMS). Lee las variables del `.env` de la raíz (incluida `CORS_ORIGINS`); no contiene ningún dominio hardcodeado. |
| `.env.example` | Plantilla comentada del `.env` de la raíz. **Sí se versiona** (no lleva secretos); el `.env` real está en `.gitignore`. |
| `.gitignore` | Excluye `.env`, `backend/uploads/` y respaldos, para que nunca se suban secretos ni datos al repositorio. |
| `.dockerignore` | Evita subir `node_modules`, `dist`, secretos y datos al contexto de build. |
| `docker/entrypoint.sh` | Aplica el esquema (`prisma db push`), siembra usuarios demo y arranca el servidor (en BD vacía crea el esquema primero). |

---

## 3. Levantar

```bash
cd fiix-cmms

# 1) Crea el .env raíz con tus claves (docker compose lo lee solo).
#    Hay una plantilla comentada en .env.example:
cp .env.example .env
#    …o créalo a mano:
cat > .env <<'EOF'
DB_PASSWORD=una_clave_fuerte
JWT_SECRET=otro_secreto_largo
PORT=3000
# Dominio público, si publicas la app en Internet (Cloudflare Tunnel, nginx…):
# CORS_ORIGINS="https://cmms.ejemplo.com"
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
| `CORS_ORIGINS` | vacío | Orígenes extra permitidos para **CORS y Socket.IO**, separados por comas. **Obligatorio si entras por un dominio público** (Cloudflare Tunnel, nginx, Tailscale Funnel); sin él la API responde `CORS: origen no permitido` y la app puede quedar en pantalla blanca. Ej.: `CORS_ORIGINS="https://cmms.ejemplo.com"`. Varios: `CORS_ORIGINS="https://cmms.ejemplo.com,https://otro.ejemplo.com"`. |
| `ALLOWED_ORIGINS` | vacío | Alias de `CORS_ORIGINS` (si defines las dos, gana `CORS_ORIGINS`). |
| `ALLOW_DB_PUSH_DATA_LOSS` | `0` | Déjalo sin definir. `1` permite que `prisma db push` aplique cambios destructivos al arrancar; con `0` el arranque falla y los datos se conservan. |
| Claves de Google Drive y Telegram | — | **No van en el `.env`**: se configuran desde la app en **Opciones de Desarrollador → Integraciones** (guardadas en BD, enmascaradas; el `.env` solo es respaldo opcional si el campo queda vacío). |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | vacío | Notificaciones Web Push PWA (solo por `.env`). |

> **Orígenes permitidos siempre** (aunque `CORS_ORIGINS` esté vacío): `localhost`,
> `127.0.0.1`, `[::1]`, `lpet-cmms`, cualquier host `*.ts.net` (Tailscale), rangos LAN
> privados (`10.x`, `172.16–31.x`, `192.168.x`) y el rango CGNAT de Tailscale (`100.x`).
> Es decir: añadir tu dominio público **no rompe** el acceso por LAN ni por Tailscale.

Verificar:

```bash
curl http://localhost:3000/api/health
```

Acceso desde la red: **`http://<IP-del-servidor>:3000`**.

---

## 4. Volúmenes (persistencia)

| Volumen | Contenido |
|---|---|
| `pgdata17` | Base de datos PostgreSQL 17 (el volumen antiguo `*_pgdata` de PG 16 se conserva intacto por si hay que volver atrás). |
| `uploads` | Fotos/evidencias (`backend/uploads`). |
| `data` | CSVs/Excel/imágenes de referencia (`data/`). |
| `backups` | Respaldos generados por la app (`BACKUP_DIR=/backups`). |

> Estos volúmenes **no se borran** al actualizar. `docker compose up -d --build` solo
> recrea los contenedores; los volúmenes con nombre se reutilizan tal cual.

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
docker compose down          # detiene y elimina los contenedores (CONSERVA los volúmenes)
docker compose stop          # solo detiene, sin eliminar nada
```

> ### ⚠️ Nunca en producción: `docker compose down -v`
>
> El flag `-v` (equivalente a `--volumes`) **elimina los volúmenes nombrados**
> `pgdata17`, `uploads`, `data` y `backups`: perderías la base de datos, las fotos y
> todos los respaldos de golpe, sin confirmación.
>
> Lo mismo aplica a `docker volume prune`, `docker system prune --volumes` y
> `docker compose rm -v`. Para empezar de cero en un entorno de **pruebas**, usa antes
> un nombre de proyecto distinto (`docker compose -p fiix-test up`) en lugar de borrar
> volúmenes de producción.
>
> Si necesitas liberar espacio, elimina solo la imagen vieja
> (`docker image prune` sin `-a` no toca volúmenes).

---

## 7. Producción con dominio público (Cloudflare Tunnel)

### Arquitectura

```
Internet
  → HTTPS  (https://cmms.ejemplo.com)
  → Cloudflare  (DNS + TLS + WAF)
  → Cloudflare Tunnel  (cloudflared, servicio systemd nativo en el host Ubuntu)
  → http://localhost:3000
  → GTZ CMMS  (contenedor «app», Docker)
  → PostgreSQL 17  (contenedor «db», volumen pgdata17)
```

`cloudflared` abre una conexión **saliente** hacia Cloudflare. Por eso:

- **No hay que abrir el puerto `3000` en el router ni publicarlo en Internet.**
- No hace falta IP fija ni abrir puertos entrantes: funciona detrás de CGNAT.
- No hay que instalar certificados en el servidor: TLS lo termina Cloudflare.

`cloudflared` se instala **nativo en Ubuntu como servicio systemd**, fuera de este
`docker-compose.yml`. El token de Cloudflare Tunnel **no se guarda en el repositorio**.

### Paso 1–3: publicar el puerto 3000 mediante Cloudflare Tunnel

```bash
# 1) La app tiene que responder en local (el compose publica 3000 en el host)
curl http://localhost:3000/api/health

# 2) Instala cloudflared en el host (no dentro del compose)
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

# 3) Autentica y crea el túnel
cloudflared tunnel login
cloudflared tunnel create cmms
cloudflared tunnel route dns cmms cmms.ejemplo.com
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: <UUID-del-tunel>
credentials-file: /home/<usuario>/.cloudflared/<UUID>.json
ingress:
  - hostname: cmms.ejemplo.com
    service: http://localhost:3000
  - service: http_status:404
```

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

### Paso 4: añadir el hostname público a `CORS_ORIGINS` (imprescindible)

El navegador entra por `https://cmms.ejemplo.com`, así que ese es el `Origin` que envía.
Si no está permitido, el backend responde `CORS: origen no permitido` y la app puede
quedar en **pantalla blanca** (la API falla y Socket.IO no conecta).

```bash
# .env (raíz del proyecto) — ejemplo, usa TU dominio
CORS_ORIGINS="https://cmms.ejemplo.com"
```

Se admiten **varios orígenes separados por comas** (el backend los separa con `,` y
quita espacios):

```bash
CORS_ORIGINS="https://cmms.ejemplo.com,https://otro.ejemplo.com,http://192.168.1.50:3000"
```

Aplica el cambio recreando el contenedor (no hace falta reconstruir la imagen):

```bash
sudo docker compose up -d
```

### Paso 5: comprobar

```bash
# Debe responder con el dominio reflejado en Access-Control-Allow-Origin
curl -i -H "Origin: https://cmms.ejemplo.com" http://localhost:3000/api/health
```

> **Cloudflare Tunnel y Tailscale conviven.** Tailscale sigue activo para administración
> y acceso privado; sus orígenes (`*.ts.net`, `100.x`) están permitidos por defecto y no
> hay que listarlos en `CORS_ORIGINS`. Lo mismo vale para el acceso por LAN.
>
> El mismo procedimiento sirve para nginx, Caddy o Tailscale Funnel: publica el puerto
> `3000` y añade el hostname público a `CORS_ORIGINS`. Para nginx ya hay un ejemplo de
> proxy inverso en [`deploy/nginx-fiix.conf`](../deploy/nginx-fiix.conf).

---

## 8. Nota sobre HTTPS (cámara)

- El **Portal de Solicitudes** (`/request`) captura fotos con `<input type="file" capture>`, por lo que **funciona sobre HTTP** sin dominio ni HTTPS.
- Lo que sí exige HTTPS es el **escáner QR en vivo** (`getUserMedia`). Cloudflare Tunnel (sección 7) da HTTPS gratis y sin abrir puertos; la alternativa es un dominio + Let's Encrypt con nginx (ver [`deploy/nginx-fiix.conf`](../deploy/nginx-fiix.conf)).

---

## 9. Actualizar en producción (sin perder configuración ni datos)

Procedimiento oficial:

```bash
cd ~/fiix-cmms
git restore .          # revierte solo archivos VERSIONADOS (evita conflictos con el pull)
git pull
sudo docker compose up -d --build
```

Este procedimiento es seguro y **no requiere volver a tocar archivos versionados**:

| Elemento | ¿Se conserva? | Por qué |
|---|---|---|
| `.env` de la raíz | ✅ | Está en `.gitignore`: no es un archivo versionado, así que `git restore .` no lo toca ni `git pull` lo sobrescribe. |
| Volúmenes `pgdata17`, `uploads`, `data`, `backups` | ✅ | `up -d --build` recrea contenedores; los volúmenes nombrados se reutilizan. |
| Ediciones manuales de `docker-compose.yml` | ❌ | Son archivos versionados: `git restore .` las revierte. **Toda configuración del servidor va en `.env`.** |

`docker-compose.yml` ya pasa `CORS_ORIGINS` (y `ALLOWED_ORIGINS`) desde el `.env` al
contenedor `app`, así que **el dominio público sigue funcionando tras actualizar** sin
editar el compose a mano — que era justo lo que `git restore .` deshacía.

### Esquema de base de datos en cada arranque

`docker/entrypoint.sh` aplica el esquema antes de arrancar el servidor:

- Ejecuta los cambios **aditivos** conocidos (idempotentes) y luego `npx prisma db push`
  **sin** `--accept-data-loss`.
- Si el esquema pendiente exigiera un cambio destructivo, `db push` **falla y el arranque
  se detiene** en lugar de perder datos en silencio. El log indica las opciones:
  restaurar un respaldo (`SKIP_DB_PUSH=1`) o asumir el riesgo conscientemente.
- `ALLOW_DB_PUSH_DATA_LOSS=1` es **solo una salida de emergencia** y **no está activada
  por defecto** (el compose la pasa con default `0`). Si la usas, vuelve a `0` después.
- `SKIP_DB_PUSH=1` desactiva por completo la sincronización de esquema (útil al restaurar
  un respaldo sobre una base vacía).
