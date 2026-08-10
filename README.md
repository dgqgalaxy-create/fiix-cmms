# GTZ CMMS
*(Última actualización: 22 de Julio de 2026 — v1.35.0)*

Sistema de Gestión de Mantenimiento (CMMS) self-hosted: órdenes de trabajo, activos, inventario, preventivos, checklist, KPIs, compras, RCA, roster y notificaciones (Telegram + Web Push PWA).

**Stack:** PostgreSQL · Prisma · Node.js 22+ / Express · React/Vite · Tailwind v4 · Socket.IO · PM2 (servidor)

---

## Servidor nuevo (checklist rápido)

En un Ubuntu limpio, el flujo completo es:

| # | Qué | Comando / detalle |
|---|---|---|
| 1 | Git | `sudo apt update && sudo apt install -y git` |
| 2 | Clonar (SSH recomendado) | §1 abajo → `git clone … ~/fiix-cmms` |
| 3 | Instalar | `cd ~/fiix-cmms && chmod +x install.sh update.sh && ./install.sh` |
| 4 | Abrir | `http://IP:3000` (o `http://IP/` si activaste nginx) |
| 5 | Actualizar después | `cd ~/fiix-cmms && ./update.sh` (o push a `main` con Actions self-hosted) |

**Recomendado en `install.sh` (defaults actuales):** **S** a PM2 al reiniciar y **S** a nginx + healthcheck. Telegram y ufw siguen opcionales (**N** por defecto).

**Qué se conserva en cada update:** `backend/.env`, `backend/uploads/` y la base de datos (Prisma solo ajusta el schema; no vacía datos).

**Producción:** un solo proceso PM2 `fiix-backend` → `node dist/index.js` en **:3000** (API + SPA). Sin nodemon. nginx opcional en **:80**.

---

## 1. Primer paso: clonar el repositorio en el servidor Ubuntu

Antes de correr `install.sh` debes tener el código en el disco. Este repo suele estar en **privado**: GitHub pedirá autenticación. Elige **una** de las dos vías (SSH recomendada, o HTTPS con token).

Requisitos previos en el Ubuntu:
```bash
sudo apt update
sudo apt install -y git
```

Datos del proyecto:
| | |
|---|---|
| **Owner / repo** | `dgqgalaxy-create/fiix-cmms` |
| **Carpeta sugerida** | `~/fiix-cmms` |
| **URL SSH** | `git@github.com:dgqgalaxy-create/fiix-cmms.git` |
| **URL HTTPS** | `https://github.com/dgqgalaxy-create/fiix-cmms.git` |

También puedes copiar la URL desde GitHub: botón verde **Code** → pestaña **SSH** o **HTTPS**.

---

### Opción A — Clonar por SSH (recomendado en servidores)

Sirve para `git clone` y, más adelante, para `./update.sh` (`git pull`) sin escribir contraseña cada vez.

#### A1. Crear una clave SSH en el Ubuntu
```bash
# Genera un par de claves solo para este servidor (sin frase de paso)
ssh-keygen -t ed25519 -C "fiix-ubuntu" -f ~/.ssh/id_ed25519_fiix -N ""

# Muestra la clave PÚBLICA (empieza con ssh-ed25519 ...). Cópiala entera.
cat ~/.ssh/id_ed25519_fiix.pub
```
No compartas ni subas el archivo **privado** `~/.ssh/id_ed25519_fiix` (sin `.pub`).

#### A2. Registrar la clave pública en GitHub

**Variante Deploy key (solo este repo, solo lectura — ideal para el servidor de planta):**
1. Abre el repo en GitHub → **Settings** → **Deploy keys** → **Add deploy key**.
2. Title: por ejemplo `ubuntu-fiix-servidor`.
3. Key: pega el contenido de `id_ed25519_fiix.pub`.
4. Deja **Allow write access** desmarcado (solo hace falta leer para clone/pull).
5. Guarda.

**Variante clave de usuario (si tu cuenta ya es colaboradora del repo):**
1. GitHub → tu foto → **Settings** → **SSH and GPG keys** → **New SSH key**.
2. Pega la misma clave pública y guarda.

#### A3. Decir a SSH que use esa clave con GitHub
```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh

cat >> ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_fiix
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
chmod 600 ~/.ssh/id_ed25519_fiix
chmod 644 ~/.ssh/id_ed25519_fiix.pub
```

#### A4. Probar la conexión
```bash
ssh -T git@github.com
```
La primera vez pregunta si confías en el host: escribe `yes`.  
Éxito típico: `Hi <usuario>! You've successfully authenticated, but GitHub does not provide shell access.`  
Si falla: revisa que pegaste la clave **pública**, que el Deploy key está activo y que `IdentityFile` apunta al archivo correcto.

#### A5. Clonar
```bash
git clone git@github.com:dgqgalaxy-create/fiix-cmms.git ~/fiix-cmms
cd ~/fiix-cmms
ls
# Debes ver: backend  frontend  install.sh  update.sh  README.md  ...
```

---

### Opción B — Clonar por HTTPS + token (Personal Access Token)

Útil si no quieres configurar SSH. GitHub **ya no acepta la contraseña de la cuenta** en `git clone`; hace falta un **token**.

#### B1. Crear el token en GitHub
1. GitHub → tu foto → **Settings** → **Developer settings** → **Personal access tokens**.
2. **Fine-grained** o **Tokens (classic)**:
   - Classic: marca el scope **`repo`** (acceso a repos privados).
   - Fine-grained: elige este repositorio y permiso **Contents: Read-only** (suficiente para clone/pull).
3. Genera el token y **cópialo al momento** (solo se muestra una vez). Trátalo como una contraseña.

#### B2. Clonar
```bash
git clone https://github.com/dgqgalaxy-create/fiix-cmms.git ~/fiix-cmms
```
Cuando pida credenciales:
- **Username:** tu usuario de GitHub (no el email, salvo que GitHub lo indique).
- **Password:** pega el **token** (no la contraseña de login de GitHub).

```bash
cd ~/fiix-cmms
ls
```

#### B3. (Opcional) Guardar credenciales para `update.sh`
Sin esto, cada `git pull` puede volver a pedir el token:
```bash
git config --global credential.helper store
# La próxima vez que hagas pull y te autentiques, se guardará en ~/.git-credentials
```
En un servidor de planta, **SSH (opción A)** suele ser más limpio que guardar el token en texto plano.

---

### Si el clone falla — checklist rápido

| Síntoma | Qué revisar |
|---|---|
| `Permission denied (publickey)` | Clave no agregada en GitHub, o `~/.ssh/config` no apunta a `id_ed25519_fiix` |
| `Repository not found` | Repo privado sin acceso; Deploy key en **otro** repo; URL mal escrita |
| `Authentication failed` (HTTPS) | Usaste la contraseña de la cuenta en vez del **token**; token sin scope `repo` / Contents |
| `Could not resolve host` | El Ubuntu no tiene red/DNS |

Cuando `cd ~/fiix-cmms` muestre `install.sh` y las carpetas `backend` / `frontend`, pasa al paso 2.

---

## 2. Instalar la aplicación — `./install.sh`

`install.sh` **no clona** el repo. Solo configura el servidor: paquetes del sistema, Node (nvm), PostgreSQL, `backend/.env`, Prisma, PM2 y **preguntas opcionales** al final.

```bash
cd ~/fiix-cmms
chmod +x install.sh update.sh
./install.sh
```

### Preguntas que verás (para que sepas qué decidir)

**Obligatorias / núcleo**
| Pregunta | Qué decides |
|---|---|
| Contraseña PostgreSQL `postgres` | La que usará la BD en este servidor (guárdala). |
| `JWT_SECRET` | Secreto de sesiones (puedes aceptar el valor generado). |
| Contraseña menú desarrollador | Clave para *Opciones de desarrollador* en la app. |
| Hostname opcional (ej. `lpet-cmms`) | Solo te recuerda el comando `hostnamectl` (no lo aplica solo). |
| ¿Cargar seed? (`admin@fiix.com` / `password123`) | **S** = usuario demo inicial; **N** = BD vacía de usuarios (los creas tú). |

**Opcionales al final (todas aceptan N = omitir)**
| Pregunta | Si dices **S** | Si dices **N** |
|---|---|---|
| ¿Registrar PM2 al reiniciar? (sudo) **[S por defecto]** | Ejecuta `pm2 startup` con sudo para que FIIX vuelva tras un reboot. | Lo haces después a mano con `pm2 startup`. |
| ¿Configurar/activar **ufw**? | Abre SSH (22), el puerto **80** (nginx) y el **3000** (UI + API) y activa el firewall. Pide **segunda confirmación** (riesgo de cortar acceso si SSH falla). | Sin firewall del script; útil si solo usarás Tailscale. |
| ¿Telegram en `.env` ahora? | Pides Bot Token y Chat ID; los escribe en `backend/.env` y reinicia el backend. | Lo configuras luego en la app o en `.env`. |
| ¿Instalar **nginx + healthcheck**? **[S por defecto]** | nginx (`deploy/nginx-fiix.conf` → `:80` → Express `:3000`) y cron cada 5 min (`scripts/healthcheck.sh`) con alertas Telegram. | Puedes activarlo después a mano (sección siguiente). |
| ¿Instalar **Tailscale**? | Instala el cliente. Si pegas un *auth key*, hace `tailscale up` solo; si no, te indica `sudo tailscale up`. MagicDNS/HTTPS se activan en la consola web de Tailscale. | Lo instalas cuando quieras. |

| Al terminar | Dirección |
|---|---|
| Interfaz (UI) + API (Express/PM2) | `http://IP_DEL_SERVIDOR:3000` |
| Con nginx (si lo activaste) | `http://IP/` o `http://lpet-cmms/` (sin `:3000`) |
| Admin del seed (si lo aceptaste) | `admin@fiix.com` / `password123` → **cámbialo** |

**Producción en un solo puerto:** `install.sh` compila el frontend (`frontend/dist`) y el backend Express lo sirve directamente en `:3000` junto con la API (`/api/*`) y `/uploads`. Ya no se necesita PM2 aparte para el frontend (`fiix-frontend` se elimina si existía). Opcionalmente **nginx** escucha en el **puerto 80** y reenvía a `:3000` (acceso sin escribir el puerto). Para desarrollar con recarga en caliente sigue usando `cd frontend && npm run dev` en `:5173` (ver §4).

Plantilla de variables: `backend/.env.example` (el `.env` real **no** se sube a GitHub).

### Acceso sin `:3000` — nginx en Ubuntu (manual)

Express/PM2 **sigue en 3000**; nginx es solo la fachada pública.

```bash
sudo apt-get install -y nginx
sudo cp ~/fiix-cmms/deploy/nginx-fiix.conf /etc/nginx/sites-available/fiix
sudo ln -sf /etc/nginx/sites-available/fiix /etc/nginx/sites-enabled/fiix
sudo rm -f /etc/nginx/sites-enabled/default   # evita conflicto en :80
sudo nginx -t && sudo systemctl reload nginx
# Si ufw ya estaba activo con 3000/5173:
sudo ufw allow 80/tcp
```

Ajusta `server_name` en el conf si tu hostname no es `lpet-cmms`. Al final de `update.sh` (modo interactivo) te pregunta si quieres **actualizar nginx** desde `deploy/nginx-fiix.conf` (útil tras cambios de `client_max_body_size`); en CI no pregunta. También puedes forzar: `UPDATE_NGINX=1 ./update.sh`.

**Import CSV + zip grande:** el conf del repo usa `client_max_body_size 1100M` (2 zips × 500 MB multer + CSV) y timeouts largos (`client_body_timeout 120m`, `proxy_read_timeout 120m`). Si ves *Network Error*, *413* o *408 Request Timeout* al subir el zip por el puerto 80, el sites-enabled del servidor probablemente sigue con defaults de nginx (body 1m, timeouts 60s). Actualiza la conf (comandos arriba o fila de la tabla «Si algo falla»), entra por `http://HOST:3000` directo, o copia las carpetas de fotos a `data/` en el servidor e importa solo los CSV.

**Verificar que nginx ya aplicó la conf del repo** (en el Ubuntu):

```bash
# Debe mostrar 1100M / 120m / 120m — NO vacío y NO 1m / 60s
grep -E 'client_max_body_size|client_body_timeout|proxy_read_timeout' /etc/nginx/sites-available/fiix
# Confirmar que sites-enabled apunta a ese archivo:
ls -la /etc/nginx/sites-enabled/fiix
# Tras copiar/actualizar:
sudo nginx -t && sudo systemctl reload nginx
```

| Valor en grep | Significado |
|---|---|
| `client_max_body_size 1100M` | Aplicado (zip grande OK) |
| `client_body_timeout 120m` | Aplicado (evita 408 por Tailscale lento) |
| `proxy_read_timeout 120m` | Aplicado (evita 504 al procesar) |
| Sin líneas / `1m` / `60s` / archivo inexistente | **Aún default** — hay que `sudo cp ~/fiix-cmms/deploy/nginx-fiix.conf …` y reload |

**Workaround Tailscale (recomendado si sigue el 408):** sube los zips/carpetas por SCP/rsync (no pasa por nginx HTTP) y abre la app en `:3000`:

```bash
# Desde tu PC (PowerShell / WSL), ejemplo:
scp -r "Items_Images" usuario@HOST:~/fiix-cmms/data/
scp -r "Formulario Solicitudes_Images" usuario@HOST:~/fiix-cmms/data/
# O el zip y descomprimir en el servidor:
# scp Items_Images.zip usuario@HOST:~/fiix-cmms/data/ && ssh … 'cd ~/fiix-cmms/data && unzip -o Items_Images.zip'
```

Luego en el navegador: `http://HOST:3000` → Opciones de Desarrollador → importa **solo los 7 CSV** (sin elegir zip). El backend usa `data/Items_Images/` y `data/Formulario Solicitudes_Images/` si no hay zip en el formulario.

**Windows / desarrollo local:** sigue usando `http://localhost:3000` (build de producción) o Vite en `:5173`; nginx es para el servidor Ubuntu.

### Vigilancia (healthcheck) y Telegram

- **Externo (cron):** `scripts/healthcheck.sh` hace `curl` a `http://127.0.0.1:3000/api/health` y comprueba Postgres. Si falla, envía a Telegram *«GTZ: servidor caído / API no responde»* o *«Postgres no responde»*. Solo avisa al pasar de sano→caído (y un recordatorio cada 6 h mientras siga caído). Estado en `/tmp/fiix-health-state`.
- **Interno (backend):** cada 5 min el propio Node hace `SELECT 1` vía Prisma; si la BD cae pero PM2 sigue vivo, también avisa por Telegram (mismo debounce).
- **Requisito:** Telegram debe estar configurado (Opciones de Desarrollador o `TELEGRAM_*` en `backend/.env`). Sin eso, el healthcheck corre pero no puede notificar.

### Web Push (notificaciones del dispositivo)
En **install.sh** / **update.sh**, si faltan `VAPID_*` en `backend/.env`, el script `scripts/ensure-vapid-env.sh` las genera y las escribe (no sobrescribe claves ya existentes). También puedes hacerlo a mano: `cd backend && npx web-push generate-vapid-keys` y pegar `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`. Los usuarios activan el interruptor en la campana o en Configuración → Apariencia.
- `/api/health` responde `{ status, db: "ok"|"error", message }` (503 si la BD no responde).

---

## 3. Actualizar el servidor — `update.sh`

Cuando ya está instalado y hay cambios en GitHub:

```bash
# En tu PC (desarrollo)
git add .
git commit -m "Descripción"
git push

# En el Ubuntu (misma auth que usaste al clonar: SSH o token)
cd ~/fiix-cmms
./update.sh
```

`update.sh` (modo silencioso / CI-friendly):

1. Carga nvm (Node **22**) o usa `node`/`npm`/`pm2` del PATH.
2. `git restore .` + `git pull --ff-only` + `chmod +x` de scripts.
3. Backend: `npm ci --include=dev` → `prisma generate` → `db push --accept-data-loss` → `npm run build` (exige `dist/index.js`).
4. Frontend: `npm ci` → `npm run build:app` (exige `frontend/dist/index.html`).
5. PM2: borra y crea `fiix-backend` con **`node dist/index.js`** (`--cwd` backend). Quita `fiix-frontend` legado.
6. Smoke test con reintentos: `GET /api/health` y `/` en `:3000`.

**No toca** `backend/.env` ni `backend/uploads/`. Al final (solo con TTY) pregunta si actualizar **nginx**; en CI usa `UPDATE_NGINX=1 ./update.sh` si hace falta. No edites código en el servidor: se pierde en el próximo update.

**GitHub Actions (self-hosted):** mismo usuario que tiene nvm. El workflow hace `git restore .`, `git pull --ff-only`, **`scripts/ci-typecheck.sh`** (tsc backend+frontend) y `bash ./update.sh`. Si el typecheck falla, el job termina en rojo **sin** reiniciar PM2 con un build roto. Si un deploy quedó a medias: `cd ~/fiix-cmms && git restore . && git pull --ff-only && bash ./update.sh`.

### Aviso de versión (banner ámbar) en repo privado

El servidor compara `backend/package.json` local vs `frontend/package.json` en GitHub. En repos **privados** hace falta un token de solo lectura:

1. GitHub → **Settings → Developer settings → Personal access tokens** (fine-grained).
2. Solo este repositorio; permiso **Contents: Read**.
3. En el servidor, `backend/.env`:
   ```bash
   GITHUB_TOKEN="ghp_...."
   # opcional:
   # GITHUB_REPO="dgqgalaxy-create/fiix-cmms"
   # GITHUB_BRANCH="main"
   ```
4. `pm2 restart fiix-backend --update-env`

Sin token, el auto-deploy sigue funcionando; solo falla el aviso ámbar.

### Runner self-hosted se “cuelga” (Waiting for a runner…)

A veces `systemctl` dice **active** pero el listener perdió la sesión con GitHub (red, reinicios, hora del sistema → errores SSL `NotTimeValid`). Los pushes a `main` quedan en cola.

**Instalar vigilancia (recomendado en el servidor de planta):**

```bash
cd ~/fiix-cmms   # o la ruta del repo
sudo bash ./scripts/install-gha-runner-watchdog.sh
sudo ./scripts/gha-runner-watchdog.sh   # prueba inmediata
tail -n 50 /var/log/fiix-gha-runner-watchdog.log
```

- Cron root cada **15 min** (`/etc/cron.d/fiix-gha-runner-watchdog`).
- Activa **NTP** y reinicia el unit `actions.runner.*` solo si no hay `Listening for Jobs` / job en curso.
- `install.sh` pregunta por esto en el paso opcional **7f** (default **S** si ya detecta el runner).

**Node del runner:** el servicio Actions no carga `~/.bashrc`. Debe existir Node **22** vía nvm para el **mismo usuario** del runner (`nvm install 22 && nvm alias default 22`). Desde v1.56.29 el typecheck intenta instalarlo solo si falta.

**Registrar el runner** (solo la primera vez en un servidor nuevo): GitHub → repo → **Settings → Actions → Runners → New self-hosted runner** → Linux x64 → al final `sudo ./svc.sh install` y `sudo ./svc.sh start`. El watchdog no sustituye ese registro.

**Desinstalar watchdog:** `sudo rm -f /etc/cron.d/fiix-gha-runner-watchdog`

| | `install.sh` (primera vez) | `update.sh` (después) |
|---|---|---|
| `git clone` / SSH | **No** (ya debiste clonar en §1) | No |
| `git pull` | No | Sí |
| Node, PostgreSQL, PM2 | Instala / configura | No (usa lo instalado) |
| Crear BD y `.env` | Sí (interactivo) | No (exige `.env`) |
| Código + deps + Prisma | `npm` + build backend/frontend | `pull` + `npm ci` + Prisma + builds |
| Seed admin | Opcional | No |
| PM2 | `node dist/index.js` → UI+API :3000 | Igual; retira `fiix-frontend` legado |

### Si algo falla (502 / Permission denied / health)

| Síntoma | Qué hacer |
|---|---|
| nginx **502** | `pm2 status` y `pm2 logs fiix-backend --lines 80`. Suele ser proceso caído. Corre `bash ./update.sh` (arranca `node dist/index.js`, no nodemon). |
| Import CSV + zip: **413**, **408** o **Network Error** (body grande / timeout) | Nginx aún con límites default (body 1m, timeouts 60s). Verifica: `grep -E 'client_max_body_size\|client_body_timeout\|proxy_read_timeout' /etc/nginx/sites-available/fiix` — debe verse `1100M` y `120m`. Si no: `sudo cp ~/fiix-cmms/deploy/nginx-fiix.conf /etc/nginx/sites-available/fiix && sudo nginx -t && sudo systemctl reload nginx`. Alternativa Tailscale: `http://HOST:3000` o SCP a `data/` + import solo CSV. Tras `update.sh`, responde **s** a nginx o `UPDATE_NGINX=1 ./update.sh`. |
| `nodemon: not found` | Instalación antigua con `npm run dev`. Recrea con update.sh o: `pm2 delete fiix-backend && pm2 start ~/fiix-cmms/backend/dist/index.js --name fiix-backend --cwd ~/fiix-cmms/backend && pm2 save` |
| `Permission denied: ./update.sh` | `chmod +x update.sh` o usa `bash ./update.sh` |
| `Cannot find module …/dist/index.js` | Build incompleto; `cd backend && npm run build` y reinicia PM2 |
| Healthcheck rojo tras update | Espera ~30 s (el script reintenta); si sigue: logs de PM2 y `curl -i http://127.0.0.1:3000/api/health` |

---

## 4. Desarrollo en laptop (sin `install.sh`)

Para programar en Windows/Mac/Linux de escritorio:

1. Instala [Node.js 22+](https://nodejs.org/) y [PostgreSQL](https://www.postgresql.org/download/).
2. Clona el repo (mismas opciones SSH o HTTPS+token del §1) e instala paquetes:
   ```bash
   # Ejemplo SSH
   git clone git@github.com:dgqgalaxy-create/fiix-cmms.git
   cd fiix-cmms/backend && npm install
   cd ../frontend && npm install
   ```
3. Crea `backend/.env` (copia `backend/.env.example`) con tu contraseña de Postgres.
4. Crea la BD `fiix_cmms` en PostgreSQL y aplica esquema:
   ```bash
   cd backend
   npx prisma generate
   npx prisma db push
   # o: npx prisma migrate dev
   npx prisma db seed
   ```
5. Dos terminales (modo desarrollo, con recarga en caliente):
   ```bash
   cd backend && npm run dev    # http://localhost:3000
   cd frontend && npm run dev   # http://localhost:5173
   ```

Vite permite hosts `lpet-cmms` y `*.ts.net` (`frontend/vite.config.ts`). En red local puedes usar `npm run dev -- --host`.

**Nota (producción vs. desarrollo):** En el servidor (`install.sh` / `update.sh`) solo corre el backend en `:3000`, que sirve tanto la API como el frontend ya compilado (`frontend/dist`, generado con `npm run build:app`). Con nginx opcional entras por el puerto **80** (`http://lpet-cmms`) sin escribir `:3000`. En tu laptop, para desarrollar con recarga en caliente sigue usando los dos procesos de arriba (`:3000` API + `:5173` UI). Si quieres probar el build de producción en local: `cd frontend && npm run build:app && cd ../backend && npm run dev` y abre `http://localhost:3000`.

**Extensiones útiles (VS Code / Cursor):** Prettier, Tailwind CSS IntelliSense, Prisma.

---

## 5. Notas que coinciden con la app actual

### Archivos e imágenes
Las evidencias y fotos viven en **`backend/uploads/`** (disco del servidor), no dentro de PostgreSQL. Al migrar de un servidor a otro, copia también esa carpeta si quieres conservar historial de imágenes.

### Roles (resumen)
- **ADMINISTRADOR / GESTIONADOR:** configuración amplia, catálogos, compras, usuarios, etc.
- **TECNICO:** flujo de órdenes (aceptar / pausar / finalizar), inventario y escaneo QR; en celular, barra inferior dedicada. No administra el sistema completo.

### Órdenes de trabajo
- Pausar (`EN_ESPERA`) pide **motivo**.
- Finalizar pide **notas de resolución** (RCA opcional según el flujo actual).
- Tiempo real: Socket.IO (refresco y bloqueo suave si otro usuario edita la OT).

### Base de datos / Prisma
- En **servidor**, `update.sh` / `install.sh` usan `npx prisma db push`.
- En **desarrollo**, puedes usar `migrate dev` si trabajas con historial de migraciones.
- Cambios de esquema: editar `backend/prisma/schema.prisma` y aplicar con Prisma.

### Credenciales
| Qué | Dónde |
|---|---|
| Postgres + JWT + clave menú dev | `backend/.env` (solo en el servidor/PC) |
| Login de la aplicación | Usuarios en la BD (seed: `admin@fiix.com` / `password123` — al entrar te pedirá cambiarla) |
| Telegram | Opciones de desarrollador en la app, o variables en `.env` |
| Web Push (PWA) | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` en `backend/.env` (generar con `npx web-push generate-vapid-keys` una sola vez) |
| Aviso vs GitHub | Opcional: `GITHUB_REPO` / `GITHUB_BRANCH` (default `dgqgalaxy-create/fiix-cmms` / `main`) |
| GitHub | Cuenta/token de Git — **no** es la contraseña de Postgres |

### Respaldos y restauración (verificar una vez)
Los respaldos diarios (y el botón **Crear respaldo**) guardan `fiix_*.sql.gz` (BD) y `uploads_*.tar.gz` (fotos) en `~/fiix-backups` (o `BACKUP_DIR`). Requieren **`pg_dump`/`psql`** con versión **≥** la del servidor (p. ej. Postgres 17 → `postgresql-client-17`). `install.sh` / `update.sh` (v1.38.5+) ayudan a instalar el cliente; la UI muestra progreso por fases.

Para comprobar que un respaldo sirve:

1. Crea uno desde **Configuración → Opciones de Desarrollador → Crear respaldo** (o `./scripts/backup.sh` en Ubuntu).
2. Restaúralo con **Restaurar respaldo** (escribe `RESTAURAR`) o:
   ```bash
   chmod +x scripts/restore.sh
   ./scripts/restore.sh fiix_YYYYMMDD_HHMM.sql.gz
   ```
3. Recarga la app. Requiere `psql` (cliente PostgreSQL) y `tar`.

### Manual de usuario
Detalle de pantallas y módulos: [`docs/manual_usuario.md`](docs/manual_usuario.md). Roadmap/versiones: [`docs/roadmap.md`](docs/roadmap.md).

### Importación CSV + fotos de repuestos y órdenes
Los CSV de ejemplo viven en `data/`. Zips opcionales en Opciones de Desarrollador:
- Repuestos: `data/Items_Images.zip` / carpeta `Items_Images/` (`MTTO-0001.Image.163526.png`, etc.).
- Órdenes: `data/Formulario Solicitudes_Images.zip` — solo **FOTO ANTES** / **FOTO DESPUÉS** por FOLIO (firmas ignoradas).
