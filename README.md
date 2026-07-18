# FIIX CMMS
*(Última actualización: 18 de Julio de 2026 — v1.25.7)*

Sistema de Gestión de Mantenimiento (CMMS) self-hosted: órdenes de trabajo, activos, inventario, preventivos, checklist, KPIs, compras, RCA, roster y notificaciones (Telegram).

**Stack:** PostgreSQL · Prisma · Node.js/Express · React/Vite · Tailwind v4 · Socket.IO · PM2 (servidor)

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

`install.sh` **no clona** el repo. Solo configura el servidor: paquetes del sistema, Node (nvm), PostgreSQL, `backend/.env`, Prisma y PM2.

```bash
cd ~/fiix-cmms
chmod +x install.sh update.sh
./install.sh
```

Durante la instalación te pedirá:
- Contraseña de PostgreSQL (`postgres`)
- `JWT_SECRET` (sesiones)
- Contraseña del menú **Opciones de desarrollador**
- Si quieres cargar datos iniciales (seed)

| Al terminar | Dirección |
|---|---|
| Interfaz (UI) | `http://IP_DEL_SERVIDOR:5173` |
| API | `http://IP_DEL_SERVIDOR:3000` (el frontend llama a `http://<mismo-hostname>:3000`) |
| Admin del seed (si lo aceptaste) | `admin@fiix.com` / `password123` → **cámbialo** |

**Queda manual después del install:** firewall (`ufw`), Tailscale/HTTPS, Telegram (en la app o en `.env`), y el comando que imprime `pm2 startup` para arrancar al reiniciar el PC.

Plantilla de variables: `backend/.env.example` (el `.env` real **no** se sube a GitHub).

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

`update.sh` valida nvm/`.env`/repo, ejecuta `git restore .` (descarta cambios locales en archivos del repo), luego `git pull --ff-only`, `npm install`, `prisma db push`, reinicia/recrea PM2 y comprueba que `:3000` y `:5173` respondan. **No modifica** `backend/.env` ni borra `backend/uploads/`. No edites código en el servidor: se pierde en el próximo update.

| | `install.sh` (primera vez) | `update.sh` (después) |
|---|---|---|
| `git clone` / SSH | **No** (ya debiste clonar en §1) | No |
| `git pull` | No | Sí |
| Node, PostgreSQL, PM2 | Instala / configura | No |
| Crear BD y `.env` | Sí (interactivo) | No (exige `.env` existente) |
| Código + dependencias + Prisma | `npm` + Prisma sobre el código local | Sí (`pull` + `npm` + Prisma) |
| Seed admin | Opcional | No |
| PM2 | Arranca servicios | Reinicia backend; recrea frontend con `--host 0.0.0.0` |

---

## 4. Desarrollo en laptop (sin `install.sh`)

Para programar en Windows/Mac/Linux de escritorio:

1. Instala [Node.js 20+](https://nodejs.org/) y [PostgreSQL](https://www.postgresql.org/download/).
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
5. Dos terminales:
   ```bash
   cd backend && npm run dev    # http://localhost:3000
   cd frontend && npm run dev   # http://localhost:5173
   ```

Vite permite hosts `lpet-cmms` y `*.ts.net` (`frontend/vite.config.ts`). En red local puedes usar `npm run dev -- --host`.

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
| Login de la aplicación | Usuarios en la BD (seed: `admin@fiix.com` / `password123`) |
| Telegram | Opciones de desarrollador en la app, o variables en `.env` |
| GitHub | Cuenta/token de Git — **no** es la contraseña de Postgres |

### Manual de usuario
Detalle de pantallas y módulos: [`docs/manual_usuario.md`](docs/manual_usuario.md). Roadmap/versiones: [`docs/roadmap.md`](docs/roadmap.md).
