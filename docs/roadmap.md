# Hoja de Ruta y Tareas Pendientes (Living Checklist)

Este documento contiene la lista de módulos y características pendientes de desarrollar. **Se debe actualizar eliminando las tareas al completarlas** para mantenerlo siempre limpio y relevante.
*(Última actualización: 21 de Julio de 2026)*

## 🚀 Versión Actual: v1.30.8 (Actualización: 21 de Julio de 2026)

### Novedades en v1.30.8 (fotos OT visibles en listado)
- **Corrección:** La importación del zip de solicitudes copia FOTO ANTES también a `request_image_url` (visible en tarjetas/tabla) y a evidencia «Antes»; FOTO DESPUÉS a «Después».

### Novedades Anteriores (v1.30.7 - compat zip OT en import)
- **Corrección:** El zip de órdenes se sube como parte de `csvFiles` para no romper Multer en backends antiguos; el servidor lo detecta por extensión/nombre. `/api/health` ahora incluye `version`.

### Novedades Anteriores (v1.30.6 - import CSV + zip OT)
- **Corrección:** Multer ya no responde `Unexpected field` al subir el zip de fotos de órdenes; la importación acepta los campos de archivo de forma flexible.

### Novedades Anteriores (v1.30.5 - fotos antes/después al importar OT)
- **Nuevo:** En Opciones de Desarrollador puedes seleccionar `Formulario Solicitudes_Images.zip` junto con los CSV. Se emparejan `FOTO ANTES` / `FOTO DESPUÉS` por FOLIO; firmas del export se ignoran.

### Novedades Anteriores (v1.30.4 - navegación en detalle de repuesto)
- **Nuevo:** En el modal de detalle/edición de un repuesto, flechas ← → (o botones del encabezado) cambian al anterior/siguiente según la lista filtrada y ordenada de Inventario.

### Novedades Anteriores (v1.30.3 - auto-deploy Ubuntu)
- **Corrección:** GitHub Actions ya no aborta el `git pull` si `npm install` dejó modificados los `package-lock.json` en el servidor: el workflow hace `git restore .` antes del pull y `update.sh` usa `npm ci`.

### Novedades Anteriores (v1.30.2 - Inventario visible tras importación)
- **Corrección:** Tras importar CSV, los repuestos no se veían porque fallaba `/inventory/transactions` por columnas faltantes (`work_order_id`, `unit_cost`). Migración aplicada; la UI carga repuestos aunque un catálogo falle.

### Novedades Anteriores (v1.29.1 - carpeta Items_Images del export Fiix)
- **Cambio:** La importación de fotos de repuestos usa `data/Items_Images/` (casing exacto). Los archivos del export Fiix son `{Item ID}.Image.{HHMMSS}.{ext}` (p. ej. `MTTO-0001.Image.163526.png`); el emparejamiento se hace sobre los archivos reales de esa carpeta → `internal_code` / columna Item ID.

### Novedades en v1.29.0 (fotos de repuestos al importar CSV)
- **Nuevo:** Al importar CSV (casilla «También asignar fotos…») se copian fotos de repuestos a `uploads/inventory/` y se actualiza `image_url` (carpeta actualizada en 1.29.1 a `data/Items_Images/`).

### Novedades en v1.28.7 (sin herramienta de migración EQ→ACT)
- **Cambio:** Se eliminó **Migrar códigos de activos → ACT-0001** de Opciones de Desarrollador (obsoleta: alta manual e importación CSV ya generan `ACT-XXXX`; el código no es editable).

### Novedades en v1.28.6 (sin respaldo JSON)
- **Cambio:** Se eliminó exportar/importar respaldo JSON. Solo queda el respaldo del servidor (**Crear respaldo** / **Restaurar respaldo**: `pg_dump` + `uploads`).

### Novedades en v1.28.5 (sin Mi día)
- **Cambio:** Se eliminó **Mi día**. La barra del técnico vuelve a **Mis OT** → todas las OT abiertas asignadas. Sin filtro `myday` ni chip «Ver todas mis OT».

### Novedades en v1.28.3 (fix restore pg_dump/psql + URI Prisma)
- **Corrección crítica:** En Windows/PostgreSQL 15+, `pg_dump`/`psql` rechazan `?schema=` de Prisma → dumps vacíos (~20 B) y restauración sin datos. Ahora se limpia la URI, se validan tamaños, se recrea `public` al restaurar y la UI muestra el error sin logout si falla.

### Novedades en v1.28.2 (logout tras vaciar/restaurar BD)
- **Mejora:** Tras vaciar la BD o restaurar un respaldo en Opciones de Desarrollador se cierra la sesión y el login muestra un aviso claro (credenciales del admin recreado tras wipe).

### Novedades Anteriores (v1.28.0 - restore, contraseña obligatoria, offline claro)
- **Nuevo:** Restaurar respaldo del servidor (`fiix_*.sql.gz` + uploads opcional) desde Opciones de Desarrollador o `scripts/restore.sh`; confirmación fuerte «RESTAURAR».
- **Nuevo:** Tras seed/CSV con contraseña temporal, el login obliga a cambiarla (`must_change_password`) antes de usar la app.
- **Mejora:** Banner offline: éxito verde «Sincronización completa (N)», fallos parciales con motivo (401/409/red) y Reintentar/Descartar.

### Novedades Anteriores (v1.27.0 - nginx puerto 80 + healthcheck Telegram)
- **Nuevo:** Reverse proxy nginx opcional (`deploy/nginx-fiix.conf`): `http://lpet-cmms` (puerto 80) → Express/PM2 en `:3000`, con cabeceras WebSocket para Socket.IO. `install.sh` puede instalarlo; `update.sh` no lo toca.
- **Nuevo:** Vigilancia de salud: `scripts/healthcheck.sh` (cron cada 5 min) comprueba API y Postgres y avisa por Telegram al caer (debounce + recordatorio cada 6 h). El backend también hace ping a la BD cada 5 min.
- **Mejora:** `/api/health` incluye `db: "ok"|"error"`; el frontend trata puerto 80/443 como mismo origen detrás de nginx.
- **Docs:** README (nginx manual + healthcheck), manual y roadmap alineados. Telegram debe estar configurado para que las alertas lleguen.

### Novedades Anteriores (v1.26.5 - Respaldos multiplataforma)
- **Fix Windows:** el respaldo desde Opciones de Desarrollador ya no usa `/bin/bash` (ENOENT en Windows); ejecuta `pg_dump` y `tar` de forma nativa, busca `pg_dump` en PATH y en rutas típicas de PostgreSQL, y guarda en `%USERPROFILE%\fiix-backups` por defecto.

### Novedades Anteriores (v1.26.4 - PWA build / deploy)
- **Fix deploy:** Workbox rechazaba el precache del bundle JS (~2.5 MB > límite 2 MiB) y fallaba `npm run build:app` en Actions; `maximumFileSizeToCacheInBytes` subido a 5 MiB.

### Novedades Anteriores (v1.26.3 - cola offline estable)
- **Fix crítico offline:** ya no se encolan fallos de red estando online; se quitaron interceptores globales de axios que re-encolaban al sincronizar. Sync en segundo plano con auth actual, descarta 4xx y entradas tras 5 reintentos; GET nunca se encola. Botón «Descartar» en el aviso y en Opciones de Desarrollador.

### Novedades Anteriores (v1.26.2 - update.sh alineado con same-origin)
- **Fix crítico deploy:** `update.sh` ahora ejecuta `npm run build:app`, reinicia solo `fiix-backend`, elimina `fiix-frontend` si existía, y smoke-testea `:3000` (API + SPA). Queda alineado con `install.sh` / v1.26.0+.

### Novedades Anteriores (v1.26.1 - Deploy self-hosted resiliente a nvm)
- **Corrección:** `update.sh` carga nvm desde varias rutas (`$NVM_DIR`, `$HOME/.nvm`, `/home/usuario/.nvm`) o continúa si `node`/`npm` ya están en el PATH; solo falla si faltan herramientas tras todos los intentos.
- **Corrección:** El workflow de GitHub Actions hace `git pull` antes de `./update.sh` para evitar el chicken-egg cuando el script antiguo fallaba antes del pull.

### Novedades Anteriores (v1.26.0 - Producción de un solo puerto, offline real, respaldos y contraseña maestra editable)
- **Nuevo:** Servidor de producción de un solo proceso: el backend Express sirve la API y el frontend ya compilado (`frontend/dist`) en el mismo puerto `:3000`. `install.sh`/`update.sh` compilan el frontend y solo administran `fiix-backend` en PM2.
- **Nuevo:** Offline real para técnicos: aceptar/pausar/finalizar/reanudar una orden de trabajo funciona sin conexión (se guarda localmente y se sincroniza al volver la señal); si hay fotos pendientes y no hay conexión, se guarda el estado/notas y se avisa que las imágenes deben subirse después.
- **Nuevo:** Aviso de conexión con el número de peticiones pendientes de sincronizar, visible en toda la app.
- **Nuevo:** Respaldo automático diario (2:15 AM) de base de datos + `uploads/` con retención de 14 días, más un botón de respaldo manual en Opciones de Desarrollador.
- **Nuevo:** La contraseña maestra de Opciones de Desarrollador se puede cambiar desde la propia interfaz (se guarda como hash en la base de datos); ya no depende únicamente de editar `backend/.env`.
- **Mejora:** `BACKEND_URL` se resuelve respetando HTTPS/mismo origen (soporta accesos detrás de proxy/Tailscale con certificado, no solo HTTP plano).

### Novedades Anteriores (v1.25.8 - install.sh: preguntas opcionales)
- **Mejora:** al final del install puedes activar PM2 startup, ufw, Telegram en `.env` y Tailscale; el README explica qué implica cada respuesta.

### Novedades Anteriores (v1.25.7 - Documentación alineada)
- **Docs:** manual, roadmap, contexto y README corregidos para coincidir con la app (install/update, RCA opcional, Inicio vs KPIs, sin Puppeteer/5 Porqués).

### Novedades Anteriores (v1.25.6 - update.sh endurecido)
- **Mejora:** `update.sh` con `set -e`, validaciones, reinicio/alta de PM2, recreación del frontend con `--host 0.0.0.0` y smoke test HTTP.

### Novedades Anteriores (v1.25.5 - Script de instalación Ubuntu)
- **Nuevo:** `install.sh` para el primer montaje en servidor limpio; `update.sh` solo actualiza código ya instalado. Plantilla `backend/.env.example`.

### Novedades Anteriores (v1.25.4 - Hosts Tailscale en Vite)
- **Mejora:** `allowedHosts` incluye `.ts.net` para entrar por MagicDNS de Tailscale, además de `lpet-cmms`.

### Novedades Anteriores (v1.25.3 - QR de ubicación abre el detalle)
- **Corrección:** escanear una ubicación (código interno como `E2-0` o `FIIX-LOCATION:…`) abre el detalle con los repuestos asociados; el enlace profundo espera a que cargue el catálogo.

### Novedades Anteriores (v1.25.2 - QR en celular por HTTP)
- **Causa:** en `http://IP` el navegador bloquea la cámara en vivo (solo HTTPS/localhost).
- **Solución:** escaneo por foto/galería + cierre seguro del escáner sin tumbar la app.

### Novedades Anteriores (v1.25.1 - Escáner QR estable)
- **Corrección:** abrir Escanear desde la barra de técnico ya no rompe la app al iniciar/detener la cámara.

### Novedades Anteriores (v1.25.0 - Capa móvil para técnicos)
- **Barra inferior (solo TECNICO en celular):** Mis OT, Escanear QR, Inventario e Inicio.
- **Acciones rápidas en detalle de OT:** Aceptar / Pausar / Finalizar / Reanudar fijas abajo; luego Guardar con evidencias.
- **Admin/Gestionador:** sin cambios en la interfaz.

### Novedades Anteriores (v1.24.1 - Inicio al abrir la app)
- **Aterrizaje en Inicio:** al abrir el sistema en una sesión nueva del navegador, carga el módulo Inicio (no Órdenes de Trabajo). Se respetan portal público y enlaces profundos.

### Novedades Anteriores (v1.24.0 - Fotos de OT en todas las vistas)
- **Escritorio incluido:** la tabla web muestra la foto de solicitud como fondo progresivo en las órdenes que tienen evidencia.
- **Mayor nitidez:** la foto es 10% más visible en celular, tablet y escritorio, manteniendo el texto protegido por el degradado.

### Novedades Anteriores (v1.23.1 - Atrás móvil en detalle de OT)
- **Botón/gesto Atrás en celular:** al revisar el detalle de una orden, Atrás cierra el modal y permanece en Órdenes de Trabajo (ya no salta a Inicio).

### Novedades Anteriores (v1.23.0 - Tarjetas de solicitudes con foto)
- **Órdenes de Trabajo responsive:** las tarjetas con `request_image_url` muestran la foto como fondo lateral desenfocado, protegido por degradados en modo claro y oscuro; incluye indicador de cámara y carga diferida.

### Novedades Anteriores (v1.22.3 - Cámara móvil robusta)
- **Portal `/request`:** comprime la foto en el dispositivo y recupera el borrador desde `sessionStorage` si el navegador recarga el formulario al abrir la cámara.

### Novedades Anteriores (v1.22.2 - Foto en portal público)
- **Portal `/request`:** carga opcional de fotografía (cámara o galería), misma evidencia `request_image_url` que en Órdenes de Trabajo.

### Novedades Anteriores (v1.22.1 - Calendario en servidor)
- **Conexión corregida:** Calendario y notificaciones usan el host del servidor en lugar de `localhost`, para funcionar al acceder a Ubuntu por IP o dominio.

### Novedades Anteriores (v1.22.0 - Dashboard de técnicos)
- **KPIs → Dashboard de técnicos:** carga del día, OTs pausadas, tiempo en espera y productividad semanal (cierres + horas de labor), con gráfica top 8.
- **Reloj de pausa:** al pasar una OT a En espera se guarda `paused_at` para medir el tiempo detenido.

### Novedades Anteriores (v1.14.2 - Formulario SLA en Configuración)
- **Pestaña SLA y tiempos:** formulario por prioridad (Urgente / Normal / Bajo) para editar horas de recordatorio, máximo y escalamiento sin tocar código.

### Novedades Anteriores (v1.14.1 - SLA anti-saturación)
- **Baseline silencioso:** al arrancar, el rezago de OT vencidas se registra sin enviar Telegram.
- **Digest:** si un ciclo genera más de 5 avisos nuevos, se manda un solo resumen al grupo.

### Novedades Anteriores (v1.14.0 - SLA y escalamiento)
- **Relojes SLA:** respuesta (PENDIENTE), detenida (EN_ESPERA) y resolución (hasta FINALIZADO), con umbrales por prioridad URGENTE/NORMAL/BAJO.
- **Automatización:** cron cada 15 minutos envía recordatorios y escalamientos (Telegram + in-app a GESTIONADOR/ADMINISTRADOR) sin duplicar el mismo evento.
- **Configuración:** umbrales editables en **Configuración → SLA (Acuerdo de Nivel de Servicio)**; en Notificaciones solo toggles de avisos. Badges de cumplimiento en listado y detalle de OT.

### Novedades Anteriores (v1.13.0 - Migración de códigos de activos)
- **Importación CSV:** Los activos creados al importar órdenes reciben `ACT-XXXX` (deja de generarse `EQ-` aleatorio).
- **Nota (v1.28.7):** La herramienta de migración masiva EQ→ACT en Opciones de Desarrollador se retiró por obsoleta.

### Novedades Anteriores (v1.12.9 - Desplazamiento suave del manual)
- **Degradado progresivo:** La intensidad aumenta gradualmente durante los primeros píxeles de desplazamiento, sin activación repentina.
- **Altura completa:** El área desplazable se adapta al espacio real y llega hasta el borde inferior disponible.

### Novedades Anteriores (v1.12.8 - Degradado del manual)
- **Ocultamiento suave:** El contenido se desvanece bajo un degradado al pasar detrás del encabezado y temario fijos.

### Novedades Anteriores (v1.12.7 - Encabezado fijo del manual)
- **Desplazamiento independiente:** El título y el temario permanecen estáticos; solo se desplaza el contenido del tema activo.

### Novedades Anteriores (v1.12.6 - Navegación del manual)
- **Botón Volver fijo:** Se integra debajo del temario y permanece accesible durante el desplazamiento, tanto en escritorio como en celular.

### Novedades Anteriores (v1.12.5 - Estado de órdenes cerradas)
- **Estado estático:** En órdenes finalizadas y anuladas, el estado se muestra como etiqueta informativa y no como un desplegable bloqueado.

### Novedades Anteriores (v1.12.4 - Órdenes finalizadas + estados claros)
- **Finalizadas protegidas:** No se pueden eliminar ni anular; el backend también lo rechaza.
- **Técnicos en cierre:** En detalle de órdenes finalizadas se listan quienes intervinieron, sin checkboxes.
- **Estados legibles:** Etiquetas Pendiente / En Proceso / En Espera / Finalizado y acciones Aceptar orden, Pausar, Finalizar, Reanudar.

### Novedades Anteriores (v1.12.3 - Inicio + navegación del manual)
- **Total recibidas:** Tarjeta informativa sin navegación y cifra ligeramente más grande para destacar el total general.
- **Temario móvil:** Barra horizontal deslizable para elegir temas y transición de entrada de derecha a izquierda.

### Novedades Anteriores (v1.12.2 - Manual + RCA móvil)
- **Introducción renovada:** El manual presenta propósito, pilares, ciclo operativo y responsabilidades por tipo de usuario.
- **RCA móvil guiado:** Navegación paso a paso Problema → Causa → Solución, ruta seleccionada y regreso al paso anterior.
- **Terminología:** “Remedios” se reemplaza visualmente por “Soluciones” sin alterar la compatibilidad interna de datos/API.

### Novedades Anteriores (v1.12.1 - Versión móvil + Telegram)
- **Versión en celular:** Acceso a novedades/manual desde la barra superior móvil (`vX.Y.Z`) y botón más visible en el menú.
- **Manual Telegram ampliado:** Guía para crear bot/grupo y obtener Token + Chat ID, y para recuperar claves olvidadas con BotFather / getUpdates.

### Novedades Anteriores (v1.12.0 - Estandarización visual + temas)
- **Design system industrial:** Tokens CSS + primitivos UI (`Button`, `Card`, `Modal`, `PageHeader`, `DataTable`, `Badge`) y helpers compartidos.
- **Consistencia global:** Emerald como CTA primaria; títulos, cards, tablas y modales unificados en todos los módulos.
- **Modo día/noche:** Cobertura completa en shell, páginas, modales, login, portal, calendario y gráficas.
- **MTTR/MTBF:** Leyenda arriba y etiqueta del eje X fuera del plot para eliminar el solape.

### Novedades Anteriores (v1.11.12 - KPIs y acceso desarrollador)
- **Retrabajo configurable:** La ventana de búsqueda de fallas previas acepta 3/7/14/30 días o un valor personalizado (1–90).
- **Gráfica MTTR/MTBF aclarada:** Etiquetas de ejes (meses vs horas) y leyenda de qué significa cada métrica.
- **Login de desarrollador centrado:** El formulario de contraseña deja de empujarse hacia abajo por `min-h-screen`.

### Novedades Anteriores (v1.11.11 - Opciones de Desarrollador)
- **Nueva jerarquía visual:** Importación y respaldos, Telegram, mantenimiento local y acciones destructivas ahora están separados por función y nivel de riesgo.
- **Importación CSV destacada:** La carga de los 7 archivos muestra visualmente el orden automático de procesamiento.
- **Diseño responsive:** Mejor aprovechamiento del espacio en escritorio, tablet y celular.

### Novedades Anteriores (v1.11.10 - Importación CSV robusta)
- **Orden garantizado:** Al seleccionar los 7 CSV a la vez, el sistema los detecta por nombre y los procesa siempre en el orden correcto (Categorías → Ubicaciones → Proveedores → Items → Usuarios → Inventario → Órdenes).
- **Sin transacciones perdidas:** Los usuarios de movimientos de inventario que no vienen en `Users.csv` se crean automáticamente (inactivos), evitando descartar ~729 movimientos.
- **MTTR fiel:** Los tiempos de reparación con coma de miles (ej. `2,140.22`) se parsean correctamente, eliminando la distorsión del MTTR.

### Novedades Anteriores (v1.11.9 - KPIs recalculados + scoreboard)
- **Cálculos corregidos:** MTTR solo en correctivas (horas), backlog como stock abierto, disponibilidad solo con paros (`machine_stopped`), OT finalizadas por `completed_at`, retrabajo a 7 días, metas en horas.
- **UI industrial:** Scoreboard con salud de planta (Disponibilidad / MTTR / Backlog), semáforo de metas, gráficos y carga por técnico.

### Novedades Anteriores (v1.11.8 - KPIs: periodo vacío)
- **Selector siempre visible:** Si no hay órdenes en el periodo actual, KPIs ya no bloquea la pantalla: puedes cambiar a Año o Histórico.
- **Mensaje aclarado:** Indica que el vacío es del periodo seleccionado, no del sistema completo.

### Novedades Anteriores (v1.11.7 - Marco del Resumen por Periodo)
- **Alcance visual del filtro:** En Inicio, el selector de fechas, las tarjetas de estados y la distribución de mantenimiento están agrupados dentro de un mismo marco para mostrar claramente qué información cambia con el periodo.

### Novedades Anteriores (v1.11.6 - Distribución de Mantenimiento)
- **Visual renovado en Inicio:** La relación entre mantenimientos Preventivos, Correctivos y de Servicio ahora usa una gráfica de dona con total central, porcentajes y barras comparativas.

### Novedades Anteriores (v1.11.5 - Notificaciones al detalle + Resumen semanal)
- **Notificaciones con detalle:** Al hacer clic en una notificación de la campana se abre el detalle de esa orden (también funciona con notificaciones anteriores que traen el folio en el título).
- **Resumen semanal en Inicio:** Bloque visual de órdenes finalizadas de la semana actual (Lunes a Domingo), con total, gráfica diaria y listado rápido.

### Novedades Anteriores (v1.11.4 - Separación Inicio / Órdenes de Trabajo)
- **Módulo Inicio:** Contiene el resumen operativo (Pareto, filtro de fechas, tarjetas de estado y gráfica de relación de mantenimiento). Al hacer clic en una tarjeta se abre el listado filtrado en Órdenes de Trabajo.
- **Órdenes de Trabajo:** Queda enfocado en las solicitudes: Vista General, Mis Órdenes, Historial, búsqueda y filtros.

### Novedades Anteriores (v1.11.3 - Portal Request, Telegram y Calendarios Móviles)
- **Portal de Solicitudes unificado:** Mismo formulario que Nueva Orden (desplegable de solicitantes), sin técnicos ni foto.
- **Telegram en Nueva Orden:** Las órdenes creadas desde Órdenes de Trabajo también notifican a Telegram si está activo.
- **Calendario y Horarios en móvil/tablet:** Alturas adaptativas, toolbar responsive y mejor aprovechamiento del ancho.

### Novedades Anteriores (v1.11.2 - Permisos de RCA y Configuración)
- **Árbol de Fallas visible para todos:** Técnicos, Gestionadores y Administradores pueden consultarlo; solo Admin/Gestionador pueden editarlo.
- **Configuración para Gestionador:** El módulo de Configuración ahora aparece también para Gestionadores (sigue oculto para Técnicos).

### Novedades Anteriores (v1.11.1 - Autoasignación de Órdenes)
- **Autoasignación para Administradores y Gestionadores:** Al aceptar una orden sin seleccionar técnicos, se asigna automáticamente al usuario que la aceptó.
- **Atención Directa:** Administradores y Gestionadores pueden atender solicitudes y subir la evidencia “Antes” como cualquier técnico, sin perder los controles de asignación.
- **Corrección de Asignaciones con Evidencia:** La lista de técnicos seleccionada se conserva correctamente cuando la orden se guarda junto con una fotografía.

### Novedades en v1.9.1 (Mejoras en Inventario y UX)
- **Acceso Ágil para Técnicos:** Habilitado el registro de movimientos para técnicos directamente desde la vista de Repuestos.
- **Actualizaciones Silenciosas:** El guardado y registro de inventario ya no interrumpe la interfaz con pantallas de carga, trabajando en segundo plano.
- **Stock y Movimientos Flexibles:** Ahora es posible registrar fracciones o decimales (ej. litros, metros) al escribir en el campo de cantidad. El control de botones (+ y -) sigue operando en números enteros.
- **Etiqueta Dinámica en Dashboard:** La tarjeta de "Totales Recibidas" en Dashboard ahora especifica dinámicamente el periodo mostrado (Mes Actual, Semana Actual, etc).
- **Validación Robusta:** El stock mínimo permitido es ahora mayor a 0, evitando configuraciones erróneas.

### Novedades Anteriores (v1.9.0)
- Checklists dinámicos con soporte para campos mixtos (texto y número).
- Corrección del guardado de incidencias en el calendario (Roster).
- Habilitada la validación para impedir la salida de inventario por cantidades mayores al stock existente.
- Asignación predeterminada a "Sin Asignación" en inventario.

### Novedades Anteriores (v1.7.5 - Configuración Dinámica y Correcciones)
- **Configuración de Telegram Dinámica:** Se movió la configuración del Bot de Telegram (Token y Chat ID) del archivo `.env` a la base de datos, con una nueva interfaz en "Opciones de Desarrollador" para facilitar la instalación "marca blanca" en nuevas fábricas.
- **Importación CSV de Solicitantes:** Corrección en el módulo de importación masiva. Ahora, al subir el CSV de Órdenes de Trabajo, el sistema alimenta y crea automáticamente los registros faltantes en el Catálogo de Solicitantes.

### Novedades Anteriores (v1.7.4 - Documentación y UI Premium)
- **Manual de Usuario Interactivo:** Reescritura completa del manual con diseño de tarjetas, insignias, navegación lateral sticky, y descripciones a fondo de la lógica interna (WebSockets, alertas de reorden).
- **Opciones de Desarrollador (Manual):** Documentación explícita sobre el "Botón Rojo" de borrado (TRUNCATE CASCADE) restringida dinámicamente a Administradores.
- **Versión en Login:** Se inyectó dinámicamente la variable `APP_VERSION` en la pantalla de inicio de sesión.
- **Ajustes Visuales:** Corrección del efecto "ventana flotante" en contenedores para mejor integración con el Layout principal.

### Novedades Anteriores (v1.7.3 - Checklists y Horarios)
- **Checklist Diario:** Módulo para registro de estado de máquinas, protegido a solo un checklist por día.
- **Módulo de Horarios (Roster):** Calendario de personal con patrones de turnos y excepciones por drag & drop.
- **Impresión Especializada:** Reglas CSS avanzadas para exportar el calendario de horarios a PDF ocultando barras y botones.
- **Días Festivos:** Integración y sombreado automático de los días festivos en México en el calendario.
- **Permisos Simplificados:** Supresión de permisos de sólo lectura para hacer los tableros de KPIs y Horarios públicos a toda la empresa, protegiendo únicamente las mutaciones.

### Novedades en v1.7.2 (Documentación)
- **Actualización de Contexto Global:** Se renovó el documento de arquitectura para reflejar todos los módulos terminados y la convención de separación entre `data` y `docs`.

### Novedades en v1.7.1 (Mantenimiento y Optimización)
- **Limpieza de Código (Dead Code):** Eliminación de variables no utilizadas e importaciones fantasma para optimizar memoria.
- **Refactorización de Hooks en React:** Prevención de renderizados en cascada y flujos de red ineficientes.
- **Seguridad en Logs:** Depuración y silenciamiento de impresiones de consola que exponían información en backend y frontend.
- **Correcciones Tipográficas:** Remoción de código CSS fugado (`dark:text-slate-300`) en los subtítulos de múltiples páginas.

### Novedades Anteriores (v1.7.0)
- **Directorio de Personal & Catálogo de Solicitantes:** Separación del personal interno del catálogo público.
- **Auto-Guardado en Permisos:** La interfaz de configuración de roles ahora guarda instantáneamente (sin botones).
- **Actualización Silenciosa:** Sincronización en tiempo real vía WebSockets para nuevas Órdenes de Trabajo del portal público.
- **Filtros Avanzados en Dashboard:**
  - Opción para buscar usuarios rápidamente.
  - Ordenamiento de OTs con base a `Folio` numérico para mayor exactitud.
  - Ocultamiento inteligente de usuarios "Dados de Baja".
- **Prevención de Eliminación:** Bloqueo de borrado para técnicos que tengan historiales o movimientos de inventario ligados.

## [x] Módulo 7: Mantenimiento Preventivo (PMs)
- [x] Crear interfaz para definir "Rutinas de Mantenimiento" o plantillas.
- [x] Implementar disparadores basados en tiempo (Días, Semanas, Meses, Años).
- [x] Tarea en el servidor (Cron Job) que revise diariamente qué mantenimientos deben generarse y los cree como Órdenes de Trabajo automáticamente.
- [ ] Disparadores por medidores / horómetros (CBM) — ver backlog.

## [x] Módulo 8: Analíticas y Reportes Gráficos (Dashboard Avanzado)
- [x] Gráficas de Tiempo Medio de Reparación (MTTR) y Tiempo Medio Entre Fallas (MTBF).
- [x] Reportes de Costos de Mantenimiento desglosados por Máquina y por Fecha.
- [x] Exportación / impresión de reportes (CSV en órdenes, PDF de OT, impresión desde KPIs). *(Excel nativo: no implementado.)*

## [x] Módulo 9: Sistema Integral de Órdenes de Compra (POs)
- [x] Convertir la actual "Lista de compras .txt" en Órdenes de Compra digitales reales guardadas en la base de datos.
- [x] Flujo de estados: "Borrador" -> "Solicitado" -> "Recibido".
- [x] Alimentación automática del inventario al marcar un PO como "Recibido".
- [x] **Stock crítico accionable (v1.18.0):** Desde la tarjeta de Stock Crítico en Inventario, generar borradores de OC con ítems bajo mínimo en un clic (agrupados por proveedor).

## [ ] Mejoras Transversales Futuras (Backlog)
- [x] **Migración de Órdenes e Inventario:** Importación exitosa de los archivos CSV históricos.
- [ ] **Checklists avanzados y LOTO:** Pasos obligatorios dentro de la Orden de Trabajo y firmas de bloqueo de energías peligrosas.
- [x] **Notificaciones y Escalamiento:** Recordatorios y escalamiento SLA por prioridad (respuesta, detenida, resolución) vía Telegram + in-app a gestores/admins (v1.14.0).
- [ ] **Control de Medidores (CBM):** Registro histórico de horómetros y detonación automática de PMs por uso real.
- [x] **Soporte PWA (Offline) para técnicos (v1.26.0 + fix v1.26.3):** Aceptar/pausar/finalizar/reanudar OT funciona sin conexión (cola en IndexedDB + sync automático al reconectar); v1.26.3 evita falsos positivos de encolado, reintentos infinitos y permite descartar la cola. Pendiente: sync fiable de fotos en segundo plano y offline en otros módulos (inventario, checklist).
- [x] **Gestión con Códigos QR:** Escaneo físico en máquinas para abrir historiales y escaneo en estantes para el control rápido de refacciones (incluye galería si no hay HTTPS).
- [x] **Árbol de Fallas (RCA):** Clasificación Problema → Causa → Solución para Pareto; al cerrar correctivas es **opcional**.
- [x] **Calendario de Carga de Trabajo / Turnos (Roster):** Vista interactiva para gestionar y asignar turnos, días festivos y faltas del personal (Completado en v1.7.3).
- [ ] **Portal de Contratistas:** Acceso limitado para proveedores externos donde puedan reportar sus trabajos sin ver datos sensibles.
- [ ] **Multiplanta / Multisítio:** Segregación de información para empresas con múltiples fábricas con un dashboard corporativo global.
