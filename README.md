# FIIX CMMS 🛠️
*(Última actualización: 17 de Julio de 2026)*

Sistema de Gestión de Mantenimiento Computarizado (CMMS) construido con el stack PERN y Prisma ORM.

## 🚀 Tecnologías Principales
- **Base de Datos:** PostgreSQL
- **ORM:** Prisma
- **Backend:** Node.js + Express (TypeScript)
- **Frontend:** React + Vite + Tailwind CSS v4 (TypeScript)
- **Almacenamiento de Archivos:** Local (Multer)

---

## 💻 Guía de Instalación para una Computadora Nueva

Para correr este proyecto en una nueva laptop o computadora en casa, sigue exactamente estos pasos:

### 1. Requisitos Previos
Asegúrate de tener instalados estos dos programas en tu computadora nueva:
- [Node.js](https://nodejs.org/es) (Versión 18 o superior recomendada)
- [PostgreSQL](https://www.postgresql.org/download/) (Asegúrate de recordar la contraseña del usuario `postgres` que pongas al instalarlo).

### 2. Extensiones Recomendadas para el Editor
Para tener la mejor experiencia programando en Antigravity IDE (o VS Code), te sugiero instalar las siguientes extensiones:
- **Prettier - Code formatter:** Para mantener el código ordenado y limpio automáticamente.
- **ES7+ React/Redux/React-Native snippets:** Para escribir componentes de React más rápido (atajos como `rfce`).
- **Tailwind CSS IntelliSense:** Indispensable para autocompletado y colores de las clases de Tailwind.
- **Prisma:** Para que el archivo `schema.prisma` tenga colores, resaltado de sintaxis y autocompletado.

### 3. Clonar el repositorio
Abre tu terminal y descarga el código:
```bash
git clone https://github.com/dgqgalaxy-create/fiix-cmms.git
cd fiix-cmms
```

### 4. Instalar Dependencias
Instala los paquetes necesarios tanto para el backend como para el frontend:
```bash
# Terminal 1 (Instalar Backend)
cd backend
npm install

# Terminal 2 (Instalar Frontend)
cd frontend
npm install
```

### 5. Configurar Variables de Entorno (.env)
Las credenciales de conexión NO se suben a GitHub por seguridad. 
Crea un archivo llamado `.env` **dentro de la carpeta `backend`** y pega el siguiente código. Modifica `TU_CONTRASEÑA` por la contraseña que le pusiste a PostgreSQL al instalarlo:

```env
# backend/.env
DATABASE_URL="postgresql://postgres:TU_CONTRASEÑA@localhost:5432/fiix_cmms?schema=public"
JWT_SECRET="mi_secreto_super_seguro_para_jwt_123"
```

### 6. Configurar la Base de Datos
Desde tu terminal, dentro de la carpeta `backend`, ejecuta los siguientes comandos de Prisma:

```bash
# 1. Esto creará la base de datos "fiix_cmms" y todas las tablas necesarias
npx prisma migrate dev

# 2. Esto poblará la base de datos con tu usuario Administrador inicial y activos de prueba
npx prisma db seed
```

*Nota: La contraseña para el usuario administrador (`admin@fiix.com`) que se crea con el seed es `password123`.*

### 7. Levantar los Servidores
Necesitas dos terminales abiertas para correr el proyecto localmente:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
# Correrá en http://localhost:3000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
# Correrá típicamente en http://localhost:5173
```

---

## 📸 Notas Importantes sobre el Proyecto

### 1. Imágenes y Archivos (Evidencias)
Las evidencias fotográficas que se suben al sistema **no se guardan en la base de datos**, sino físicamente en la computadora que funciona como servidor (en `backend/uploads/`). Si en tu trabajo subes una foto, esa foto física se queda en el disco duro del trabajo. Si quieres ver las fotos viejas en tu casa, no estarán ahí a menos que las copies en una USB. Las nuevas que subas en casa, se guardarán en tu casa.

### 2. Reglas del Módulo de Órdenes
- **Técnicos:** No pueden crear, ni borrar activos, ni alterar el origen de una orden. Solo pueden cambiar los estados.
- **En Espera:** Si una orden se pone `EN_ESPERA`, es obligatorio llenar el campo de "Motivo".
- **Finalizado:** Cuando una orden se finaliza, es obligatorio llenar "Notas de Resolución".

### 3. Prisma Schema
Si en el futuro agregas nuevas tablas o columnas a la base de datos, siempre debes hacerlo en `backend/prisma/schema.prisma` y luego ejecutar `npx prisma migrate dev` para aplicarlo.

### 4. Actualizaciones en Producción (Deploy)
Para desplegar nuevos cambios al servidor de producción (Ubuntu), el proyecto cuenta con un script automatizado (`update.sh`) que evita el error humano y reinicia los servicios.

**Paso 1 (En tu Computadora - Entorno Local):**
Sube los cambios a GitHub:
```bash
git add .
git commit -m "Descripción de los cambios"
git push
```

**Paso 2 (En el Servidor de Producción):**
Conéctate por SSH a tu servidor y ejecuta el script de actualización:
```bash
cd ~/fiix-cmms
./update.sh
```
El script automáticamente:
1. Descargará los cambios de GitHub (`git pull`).
2. Instalará nuevas dependencias si es necesario (`npm install`).
3. Construirá las nuevas tablas de Prisma respetando la información existente (`npx prisma db push`).
4. Reiniciará los servidores suavemente (`pm2 restart`).
