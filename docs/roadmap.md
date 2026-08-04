# Hoja de Ruta y Tareas Pendientes (Living Checklist)

Este documento contiene la lista de módulos y características pendientes de desarrollar. **Se debe actualizar eliminando las tareas al completarlas** para mantenerlo siempre limpio y relevante.
*(Última actualización: 31 de Julio de 2026)*

## 📌 Próxima implementación

### Importación desde Google Sheets + Drive (GTZ)

**Estado Fase 1 (datos Sheets):** Hecha en **v1.46.0–1.46.2** (export CSV público).  
**Estado Fase 3 (fotos Drive):** Hecha en **v1.46.3** — casilla «Fotos desde Google Drive»; `GOOGLE_DRIVE_*` en `.env`; prioridad zip → Drive → `data/`.  
**Pendiente:** Fase 2 (auto-sync periódico) y opcionalmente volver a cuenta de servicio.

**Objetivo:** Importar los mismos datos que hoy llegan por CSV + zip, pero leyendo **Google Sheets** (tablas) y **Google Drive** (fotos), reutilizando la tubería de import CSV (upsert + orden Categorías → … → Órdenes).

**Orígenes (confirmados por el usuario):**

| Origen Google | Equivale a |
|---------------|------------|
| Spreadsheet A — **6 pestañas** | Categorías, Ubicaciones, Proveedores, Items, Usuarios, Inventario (mismas columnas que los CSV) |
| Spreadsheet B — **1 pestaña** | Solicitudes / Órdenes (mismas columnas que el CSV) |
| Carpeta Drive plana — inventario | Como `Items_Images.zip` / `data/Items_Images/` |
| Carpeta Drive plana — órdenes | Como `Formulario Solicitudes_Images.zip` / carpeta de fotos OT |

**IDs / links capturados (30 Jul 2026) — revisión parcial:**

| Recurso | Spreadsheet ID / URL |
|---------|----------------------|
| **Órdenes / Solicitudes** (público lectura OK) | `1yApMaUXyhBeMkuJczDOr6mH6f3VdNdcFrctPuSKU1to` — [abrir](https://docs.google.com/spreadsheets/d/1yApMaUXyhBeMkuJczDOr6mH6f3VdNdcFrctPuSKU1to/edit) |
| **Inventario y demás** (lectura OK tras compartir) | `1ciJtRqFvIzKYskYGdd6t_MR0r9hml2SUxMkTr6dwp_U` — [abrir](https://docs.google.com/spreadsheets/d/1ciJtRqFvIzKYskYGdd6t_MR0r9hml2SUxMkTr6dwp_U/edit) |

**Mapeo verificado — Solicitudes (`1yApMaUXyh…`):**

| Pestaña (gid) | ¿Usar en import CMMS? | Notas |
|---------------|----------------------|--------|
| **Formulario Solicitudes** (`gid=1826783870`) | **SÍ → Órdenes CSV** | Columnas idénticas al CSV local (`Marca temporal`, `FOLIO`, `FOTO ANTES`, `FOTO DESPUÉS`, etc.). ~794 filas. |
| Auditar (`2101138842`) | No | Auditoría / tiempos |
| Uso Refacciones (`1922817217`) | No (por ahora) | Consumos; no es uno de los 7 CSV maestros |
| Datos LockerStudio (`588049399`) | No | Dashboard externo |
| Dashboard Inicio (`1832532611`) | No | KPIs embebidos |
| Horarios (`538831923`) | No | Turnos; el CMMS ya tiene Roster propio |

**Mapeo verificado — Inventario (`1ciJtRqFvIzKYskYGdd6t_MR0r9hml2SUxMkTr6dwp_U`) — 30 Jul 2026:**

| Pestaña (gid) | ¿Usar en import CMMS? | CSV equivalente | Notas |
|---------------|----------------------|-----------------|--------|
| **Categories** (`915855901`) | **SÍ** | `Items - Categories.csv` | Headers OK (`ID,Category,Icon`; cols vacías extra al final) |
| **Location** (`524501125`) | **SÍ** | `Items - Location.csv` | Headers idénticos (~161 filas) |
| **Vendors** (`1305174716`) | **SÍ** | `Items - Vendors.csv` | Headers OK (+ col vacía) |
| **Items** (`1448500833`) | **SÍ** | `Items - Items.csv` | Headers idénticos (~2482 filas) |
| **Users** (`1571243379`) | **SÍ** | `Items - Users.csv` | Headers idénticos |
| **Inventory** (`1882570459`) | **SÍ** | `Items - Inventory.csv` | Headers idénticos (~4127 filas) |
| Menu / Shift Schedule / Print / Buscar | No | — | Auxiliares del spreadsheet Fiix |

**Resumen — 7 fuentes para el import (orden de proceso):**  
Categories → Location → Vendors → Items → Users → Inventory → **Formulario Solicitudes**.

**UI (Opciones de Desarrollador):**

1. **Botón «Importar ahora desde Google Sheets»** — bajo demanda. **← Hecho (v1.46.0).**
2. **Interruptor «Actualización automática»** — ON/OFF. **← Después.**
3. Config: IDs de 2 spreadsheets + credencial Google (carpetas Drive y horario auto más adelante).
4. **Conservar** importación CSV + zip como respaldo.

**Credenciales (Fase 1 — modo temporal actual):**

1. **Sin JSON / sin Google Cloud:** ambos Sheets en **Cualquier persona con el enlace → Lector**.
2. Opcional: `GOOGLE_SHEETS_INVENTORY_ID` / `GOOGLE_SHEETS_ORDERS_ID` (hay defaults).
3. Más adelante: cuenta de servicio si dejan de ser públicos.
4. **ID de carpeta Drive:** cuando implementemos fotos.

**Fases:**

1. **Hecha:** Auth + 2 Sheets (7 pestañas) + botón «Importar ahora».
2. **Después:** Interruptor auto + cron + logs / no solapar.
3. **Después:** Fotos Drive (2 carpetas planas).
4. Pulido (progreso UI, errores, docs).

**Acuerdos:** Primero solo import bajo demanda. Auto-sync **después**. Fotos Drive **después**.

### 🔧 Acordado para mañana (30→31 Jul 2026)

1. **Fotos / imágenes** — integrar import de fotos (botón «solo fotos» y/o Drive; ver conversación Fase 1 Sheets).
2. **Zona horaria México en rachas / import CSV** — `parseCsvDate` y el conteo de racha/récord (`calendarDaysBetween` en `getLineStoppageStatus`) deben usar **`America/Mexico_City`**, no la TZ del SO. Hoy Mac (México) vs Ubuntu (UTC) dejan **±1 día** en racha y récord tras el mismo import. Fijar TZ en código (y/o `TZ=` en el servidor) y reimportar OT si hace falta para alinear `created_at`.

---

## 🚀 Versión Actual: v1.56.12 (Actualización: 4 de Agosto de 2026)

### Novedades en v1.56.12
- **Corrección:** Push duplicado en Windows (2 toasts) — se elimina la suscripción vieja del mismo PC (Chrome + PWA).

### Novedades en v1.56.11
- **Mejora:** Push Android — vibración más fuerte; si la PWA sigue en memoria vibra también por la app. Con app cerrada depende del interruptor «Vibrar» del sistema.

### Novedades en v1.56.10
- **Corrección:** En interfaz móvil, el menú lateral ya no queda oculto detrás de la barra Mis OT / Escanear / Inventario / Inicio.

### Novedades en v1.56.9
- **Corrección:** ACK de entrega de chat fuera de Mensajes (palomitas ✓✓ en vivo aunque el otro esté en otro módulo).
- **Corrección:** «Usuarios en línea» usa sockets conectados + heartbeat más frecuente (lista más fiel).

### Novedades en v1.56.8
- **Corrección:** Compilación del backend (import ESM en socket de chat) y reintento del banner «Recargar ahora».

### Novedades en v1.56.7
- **Nuevo:** Palomitas de estado en mensajes propios (enviado / entregado / leído), tipo WhatsApp.
- **Mejora:** Reconexión del chat al volver a la app en móvil.

### Novedades en v1.56.6
- **Mejora:** Mensajes — tono de notificación al llegar un mensaje (además de vibración); push del sistema con sonido del teléfono.

### Novedades en v1.56.5
- **Corrección:** El banner de mensaje nuevo ya no sale duplicado; con la app abierta solo se muestra el banner in-app (el push del sistema queda para segundo plano).

### Novedades en v1.56.4
- **Mejora:** Push de mensajes en PWA — vibración + notificación de sistema más fiable en móvil (Android).

### Novedades en v1.56.3
- **Nuevo:** Banner de mensaje entrante (arriba derecha, zoom in, sale a la derecha a los 5 s).

### Novedades en v1.56.2
- **Mejora:** Chat vacío — texto «Sin mensajes» (sin apariencia de cuadro de escritura en el hilo).

### Novedades en v1.56.1
- **Mejora:** Listado de OT — contador de comentarios + preview del más reciente en tarjetas/tabla.

### Novedades en v1.56.0
- **Nuevo:** Rol **Observador** — consulta operativa (Inicio, OT, activos, inventario, etc.) + Mensajes; sin crear/editar/eliminar. Mutaciones bloqueadas en API (`requireWritable`); chat permitido.

### Novedades en v1.55.0
- **Nuevo:** Soft-delete de mensajes propios (10 min) → «Mensaje eliminado»; sin panel Admin ni lectura de chats ajenos.
- **Corrección (1.54.1):** Compositor de Mensajes encima de la barra inferior en interfaz móvil.

### Novedades en v1.54.1
- **Corrección:** Mensajes en interfaz móvil — el compositor queda encima de la barra inferior (Mis OT / Escanear / Inventario / Inicio).

### Novedades en v1.54.0
- **Nuevo:** Comentarios en detalle de OT (lectura/escritura para quien pueda abrirla; adjuntos; socket en vivo).
- **Nuevo:** Chat interno 1:1 y grupos ad-hoc con adjuntos; página Mensajes + badge de no leídos; push/in-app.
- **Mejora:** Formulario de avisos globales colapsado detrás de «Nuevo aviso global».
- **Corrección:** Check «Completados» solo en Mis notas / Pendientes (no en Avisos).

### Novedades en v1.53.1
- **Mejora:** UOM — editar Enteros/Decimales en unidades existentes.
- **Mejora:** Menú lateral más denso/compacto.
- **Corrección:** Fallo al registrar movimientos de inventario (backend).

### Novedades en v1.53.0
- **Nuevo:** UOM en Configuración (siempre visible para Admin) + `qty_mode` Enteros/Decimales por ítem (validado en movimientos/OT/OC).
- **Mejora:** OT móvil — «Aceptar y continuar» con auto-guardado (sin confirm extra si hay foto Antes; al subir la foto también guarda).
- **Mejora:** Stock crítico en Inicio; borradores OC omiten ítems ya en OC abiertas; etiqueta del botón más clara.

### Novedades en v1.52.2
- **Corrección:** Tras «Aceptar orden» (móvil) el botón azul se reemplaza por confirmación + Guardar; igual patrón en Pausar / Finalizar / Reanudar.

### Novedades en v1.52.1
- **Corrección:** Avisos con foto — zoom dentro de la app (sin `target=_blank` que en PWA abre y cierra); marcar visto ya no dispara recarga global por socket.

### Novedades en v1.52.0 (Avisos globales)
- **Nuevo:** Pestaña **Avisos** en Notas y pendientes — visibles para todos; solo Admin crea (con foto opcional).
- **Nuevo:** Lecturas: al verlos se marcan; el Admin ve quién ya los leyó (contador y nombres).

### Novedades en v1.51.0 (Costos históricos congelados)
- **Corrección:** OT / KPI / activo usan solo el `unit_cost` guardado al consumir; ya no releen el catálogo.
- **Al cerrar OT:** siempre se guarda un número (`purchase_cost` o `0`).
- **Migración one-shot:** rellena consumos OT viejos null/0 desde el catálogo una sola vez.
- **Extra:** movimientos manuales y recepción de OC también guardan `unit_cost` snapshot.

### Novedades en v1.50.0 (OC — costos desde inventario + ficha del ítem)
- **Mejora:** Costo unitario precargado del catálogo; solo Admin lo edita en la compra (y lo guarda en el ítem).
- **Nuevo:** Desde líneas de la OC se abre el detalle del artículo; en borradores, botón para sincronizar precios con inventario.
- **Cambio (Notas):** Solo Admin/Gestionador crean y editan pendientes; técnicos asignados solo completan.
- **Cambio (OC):** Solo Admin aprueba; Gestionador no autoaprueba; Admin crea ya aprobada.

### Novedades en v1.49.0 (Notas — mejoras de uso diario)
- **Mejora:** Edición, filtros, vencidos/próximos, prioridad Alta, comentario al completar, reabrir, snooze (+1 h / mañana).
- **Nuevo:** Tarjeta resumen en Inicio, badge en el menú lateral y acceso «Crear pendiente» desde el detalle de OT.

### Novedades en v1.48.0 (Notas personales + pendientes operativos)
- **Nuevo:** Menú **Notas y pendientes**: notas privadas con recordatorio opcional; pendientes asignables a cualquier usuario, con folio OT / código de activo opcionales.
- **Avisos:** al asignar y al vencer la fecha → in-app + push (sin Telegram). Cron cada 5 min.

### Novedades en v1.47.3 (Texto Limpiar caché PWA)
- **Mejora:** En Herramientas locales se aclara cuándo usar **Limpiar caché PWA** (versión vieja tras update, UI rota o desactualizada).

### Novedades en v1.47.2 (Bitácora — Excel sin límite de retención)
- **Aclare:** La bitácora de auditoría guarda todo el histórico en PostgreSQL (sin caducidad ni job de purga). La vista en pantalla sigue mostrando los últimos 50.
- **Nuevo:** Descarga Excel (.xlsx) por periodo de fechas (día civil México) o histórico completo, en Opciones de Desarrollador (solo Admin).

### Novedades en v1.47.1 (Opciones de Desarrollador — respaldo compacto)
- **Mejora:** «Respaldo del servidor» deja de estirarse con espacio vacío: ahora se apila con «Importar desde Google Sheets» en la columna derecha y los botones Crear/Restaurar comparten fila.

### Novedades en v1.47.0 (Checklist — Incumplimiento + continuación)
- **Nuevo:** Autocierre a medianoche (México): checklists no enviados → **Incumplimiento** (bloqueados). Si faltaba el del día anterior, se crea vacío en Incumplimiento.
- **Nuevo:** Admin puede asignar técnico sin cambiar el estado; el técnico asignado solicita continuar; solo Admin aprueba/rechaza; al aprobar se reabre en borrador.

### Novedades en v1.46.11 (Traspaso de checklist + líneas paradas preventivo)
- **Nuevo:** Checklist Diario — el técnico asignado puede **Traspasar** a otro; el destinatario **Acepta** o **Rechaza**; el emisor puede **Cancelar traspaso** mientras esté pendiente. Notificaciones in-app.
- **Mejora:** En Inicio, **Líneas paradas** (L1–L5) incluye OT **PREVENTIVO** abiertas con paro de máquina (además de correctivas). La **racha** / récord siguen siendo solo correctivo.
- **Docs:** Manual de usuario alineado con la versión de release.

### Novedades en v1.46.10 (Inventario — Registrar movimiento por permisos)
- **Corrección:** En el detalle del repuesto, el botón naranja **Registrar movimiento** ya no requiere `MANAGE_INVENTORY`: Técnico y Gestionador lo ven. El modal limita **Entrada (IN)** a quien tenga permiso de entradas (`REGISTER_INVENTORY_ENTRIES`); las salidas (OUT) quedan disponibles con acceso a Inventario.

### Novedades en v1.46.9 (Checklist — imprimir solo finalizado + A4)
- **Cambio:** Imprimir/PDF del Checklist Diario solo si está **COMPLETED** o **REVIEWED** (borrador: botón deshabilitado; Ctrl+P bloqueado con aviso).
- **Mejora:** El PDF cabe en **una hoja A4 portrait** (tipografía/márgenes compactos + zoom print).

### Novedades en v1.46.8 (Inicio — Total recibidas)
- **Mejora:** La tarjeta **Total recibidas** muestra la leyenda «Sin contar invalidadas» (el recuento ya excluía `ANULADO`).

### Novedades en v1.46.7 (OT — acciones, tiempos, roles y costos)
- **Nuevo:** Acciones rápidas en tarjetas de OT (Admin/Gestionador): **Sin asignar** abre el detalle en asignación; icono de calendario navega a Calendario listo para agendar esa orden.
- **Mejora:** Listas de asignación (crear OT, detalle, asignación masiva) incluyen **Gestionadores** activos además de Técnicos.
- **Corrección:** Al finalizar no se sobrescribe `completed_at` si ya venía del CSV; `formatDateTime` usa **America/Mexico_City**.
- **Corrección:** Costo de refacciones en OT ya no queda en $0 (`unit_cost` nullable, fallback al catálogo, migración `0→null`).
- **Mejora:** Búsqueda de OT por **zona** en Ctrl+K y en la barra de Órdenes (atajo «Órdenes en zona…»).

### Novedades en v1.46.6 (fechas CSV en hora de planta)
- **Corrección:** `parseCsvDate` / `parseDateInput` interpretan la hora de pared como **America/Mexico_City** (`utils/plantTimezone.ts`), sin depender del `TZ` del proceso. En el servidor (UTC) el mismo CSV guardaba `created_at` 6 h antes que en local → la racha sin paros y el récord salían con un día de diferencia.
- **Pendiente para el servidor:** `timedatectl set-timezone America/Mexico_City` + reimportar el CSV/Sheets de órdenes para reescribir los `created_at` ya guardados con el desfase.

### Novedades en v1.46.5 (Iniciar checklist)
- **Cambio:** Crear/abrir el Checklist Diario no asigna técnico. Solo lectura hasta **Iniciar checklist**; entonces se reclama y se puede editar/enviar. Si otro ya lo inició → solo lectura.

### Novedades en v1.46.4 (Import CSV separado)
- **Mejora:** Opciones de Desarrollador separa el import manual en **Inventario (6 CSV + zip)** y **Órdenes (1 CSV + zip)**. Pueden ejecutarse por separado; el motor conserva upsert y no borra los datos de la otra sección.

### Novedades en v1.46.3 (Fotos Google Drive + Telegram)
- **Nuevo:** Casilla «Fotos desde Google Drive» en Opciones de Desarrollador (CSV y Sheets). Requiere `GOOGLE_DRIVE_API_KEY` + carpetas públicas. Prioridad: zip → Drive → `data/`.
- **Corrección:** Con «Alertas por Telegram» desactivadas no se envían SLA/checklist/OT; el `.env` solo respalda el healthcheck si la BD está caída.

### Novedades en v1.46.2 (login sin pista permanente)
- **Cambio:** El login ya no muestra siempre `admin@fiix.com` / `password123`. Esas credenciales solo aparecen en el aviso ámbar tras vaciar la BD.

### Novedades Anteriores (v1.46.1 - Sheets públicos temporales)
- **Cambio:** Import Google Sheets sin cuenta de servicio: descarga CSV público. Ambos spreadsheets deben estar en «Cualquier persona con el enlace → Lector».

### Novedades Anteriores (v1.46.0 - Google Sheets bajo demanda)
- **Nuevo:** En Opciones de Desarrollador, **Importar ahora desde Google Sheets** lee las 7 pestañas mapeadas y usa el mismo motor que el import CSV (`processCsvImportFiles`).

### Novedades Anteriores (v1.45.3 - volumen alerta)
- **Mejora:** Sonido de OT críticas otro **+50%** de volumen.

### Novedades Anteriores (v1.45.2 - volumen alerta)
- **Mejora:** Sonido de OT críticas otro **+50%** de volumen.

### Novedades Anteriores (v1.45.1 - volumen alerta)
- **Mejora:** Sonido de OT críticas (Inicio / sala de control) un **50% más alto**.

### Novedades Anteriores (v1.45.0 - marca GTZ + bip QR)
- **Cambio:** Nombre visible del producto **GTZ CMMS** (PWA, títulos, Telegram/email, install/update).
- **Cambio:** QR nuevos `GTZ-ASSET` / `GTZ-ITEM` / `GTZ-LOCATION`; se siguen leyendo etiquetas `FIIX-*`.
- **Nuevo:** Bip corto al escanear un QR.

### Novedades Anteriores (v1.44.14 - Import CSV — timeouts nginx/axios 120m)
- **Corrección:** Timeouts nginx (`client_body_timeout`, `send_timeout`, `proxy_read_timeout`, `proxy_send_timeout`) y axios de import a **120m** (2 h); `client_max_body_size` sigue en **1100M**.

### Novedades en v1.44.13 (Import CSV — Tailscale / nginx 60m + data/)
- **Corrección:** `client_body_timeout` de nginx a **60m** (zips grandes por Tailscale).
- **Mejora:** Si no hay zip en el formulario, la importación CSV usa `data/Items_Images/` y `data/Formulario Solicitudes_Images/` (SCP/rsync).
- **Docs:** checklist de verificación nginx (`grep` = aplicado vs default) y workaround `:3000` / SCP.

### Novedades en v1.44.12 (PWA — recarga fiable)
- **Corrección:** Si el banner decía «servidor ya tiene vX» pero **Recargar ahora** no avanzaba la UI, el soft-reload seguía sirviendo el precache del SW. Ahora desregistra SW, limpia Cache Storage y fuerza navegación; `skipWaiting`/`clientsClaim`; `index.html`/`sw.js` con `Cache-Control: no-cache`.

### Novedades en v1.44.11 (Limpieza Dev — Solo fotos OT)
- **Cambio:** Se eliminó la tarjeta/API «Solo fotos de órdenes» (redundante respecto a la importación maestra CSV + zip). Se conservan los selectores de zip de inventario y fotos de OT en Importar CSV.

### Novedades en v1.44.9 (Racha — récord e incentivos)
- **Mejora:** En Inicio, Racha sin paro muestra el récord histórico y mensajes de ánimo/celebración.

### Novedades en v1.44.8 (Activos — listado denso)
- **Mejora:** Tabla/lista de Activos más compacta (como Checklist/Compras); código MTTO completo en una línea; sin chip C/F redundante.

### Novedades en v1.44.7 (Import CSV — timeout 408)
- **Corrección:** Subida de CSV + zip por nginx/Tailscale: `408 Request Timeout` por `client_body_timeout` corto; plantilla nginx con timeouts 30m/60m, mensaje UX y axios a 60 min.

### Novedades en v1.44.2 (Fotos Activos + Editar en detalle)
- **Nuevo:** Zip `Items_Images` — ítems ACTIVOS copian foto a `uploads/assets/` y actualizan el activo.
- **Nuevo:** Botón **Editar** en el detalle del activo (pestaña Información).
- **Confirmado:** Generador MTTO intacto; import no usa Item ID Fiix como `internal_code`.

### Novedades en v1.44.1 (Activos desde inventario ACTIVOS)
- **Nuevo:** En la importación CSV maestra, tras Items, los ítems con categoría **ACTIVOS** se crean/actualizan en el módulo Activos (sin borrar el ítem de inventario). Ubicación `LINEA N ACTIVOS` → zona `LN`; `TAPANCO` → `TAPANCO`; sección no se inventa.

### Novedades en v1.44.0 (Zonas dentro de Activos + secciones)
- **Nuevo:** Las zonas se gestionan desde **Activos → Administrar zonas** (la ruta `/zones` redirige ahí). Cada zona puede tener **secciones/subzonas** o modo **Sin secciones**.
- **Migración:** En L1–L5 existentes se crean secciones A–E y se enlazan activos que ya tenían `section` A–E; el resto de zonas quedan en Sin secciones.
- **Import CSV:** Solicitudes sigue emparejando por `Equipo:` / `Zona:`; sin columna de sección los activos quedan sin sección (`zone_section_id` null). No exige columnas nuevas.
- **Respaldos:** Siguen siendo `pg_dump` completo (incluyen `ZoneSection` y columnas nuevas automáticamente).

### Novedades en v1.43.11 (Inicio: líneas paradas + racha)
- **Nuevo:** Indicadores en Inicio — **Líneas paradas** (L1–L5 con OT correctiva abierta y paro de máquina) y **Racha sin paro** (días sin paro correctivo de línea; preventivos no cuentan).

### Novedades en v1.43.10 (PWA: no quedarse en versión vieja)
- **Corrección:** Si el servidor ya tiene build nuevo pero la pestaña/PWA sigue en versión anterior, se detecta (`deployed` > `APP_VERSION`) y se recarga. Service worker otra vez en `autoUpdate`.

### Novedades en v1.43.9 (Turno actual móvil denso)
- **Mejora:** Inicio → Turno actual en celular más compacto (sin scroll horizontal); SLA abreviado R/V.

### Novedades en v1.43.8 (aviso de actualización)
- **Nuevo:** Banner si GitHub va por delante del servidor (Admin: recuerda `./update.sh`) y banner para **Recargar** cuando el build nuevo ya está desplegado (PWA).

### Novedades en v1.43.7 (lista inventario: acciones restauradas)
- **Corrección:** Botones de acciones en la lista de refacciones como antes; «Registrar movimiento» naranja solo en el detalle del artículo.

### Novedades en v1.43.6 (Registrar movimiento en detalle)
- **Mejora:** En detalle de repuesto (incl. Ctrl+K): botón **Registrar movimiento** naranja de acción.

### Novedades en v1.43.5 (formato moneda MXN)
- **Mejora:** Costos y precios en UI con formato México (`$1,234.56`) vía `formatCurrency` (compras, activos, OT, tooltips KPI).

### Novedades en v1.43.4 (KPIs: tabla técnicos densa)
- **Mejora:** Dashboard de técnicos — tabla «Detalle por técnico» más compacta para caber mejor junto a la gráfica (sin tocar las 4 tarjetas ni el chart).

### Novedades en v1.43.3 (Planes Preventivos móvil compacto)
- **Mejora:** Planes Preventivos en celular: encabezado compacto + lista densa (mismo patrón que Checklist y Compras); en PC se mantiene la tabla.

### Novedades en v1.43.2 (Pendiente: solo Aceptar orden)
- **Corrección:** En OT **Pendiente** no se muestra Unirme / Colaborar; solo **Aceptar orden**. Unirme / Colaborar queda para En proceso / En espera sin asignación.

### Novedades en v1.43.1 (install: VAPID automático)
- **Mejora:** `install.sh` / `update.sh` generan claves VAPID en `backend/.env` si faltan (`scripts/ensure-vapid-env.sh`); no pisan claves ya configuradas.

### Novedades en v1.43.0 (Web Push / notificaciones del dispositivo)
- **Nuevo:** Canal Web Push (PWA/navegador) opt-in: campana o Configuración → Apariencia. Dispara en nuevas OT y avisos SLA (mismo alcance que campana/Telegram para esos eventos).
- **Deploy:** generar VAPID una vez (`npx web-push generate-vapid-keys`) y poner `VAPID_*` en `backend/.env`. Requiere HTTPS (o localhost); en iOS, app instalada en Inicio.

### Novedades en v1.41.0 (UX operativa: turno, KPIs, auditoría, táctil)
- **Nuevo:** InfoTip ⓘ en Inventario (Stock crítico / Excel / filtros) y áreas táctiles más grandes en escaneo y acciones de fila.
- **Nuevo:** Entradas de inventario (IN) offline, igual que OUT.
- **Nuevo:** Asignación masiva de técnicos a varias OT (`Asignar…`).
- **Nuevo:** Panel **Turno actual** en Inicio (conteos por técnico + SLA).
- **Nuevo:** KPIs: periodo **Semana pasada** y comparación Esta semana vs semana anterior.
- **Nuevo:** Bitácora de auditoría (Admin) en Opciones de Desarrollador.
- **Mejora:** Acciones rápidas del técnico móvil (siguiente paso, Guardar destacado, auto-guardar al aceptar/reanudar con foto Antes).

### Novedades en v1.39.0 (interfaz móvil de técnico configurable)
- **Cambio:** Con permiso **Ver Configuración**, Técnico y Gestionador solo ven **Apariencia**; Administrador ve todas las secciones.

### Novedades en v1.38.9 (Nueva OC: catálogo por proveedor + búsqueda)
- **Mejora:** Al elegir proveedor en **Nueva Orden de Compra** se listan de inmediato sus refacciones. También puedes buscar por nombre/código sin proveedor; al agregar el ítem se toma su proveedor.

### Novedades en v1.38.8 (módulo en línea + pulso + calendario touch)
- **Nuevo:** Usuarios en línea muestran el módulo actual (ruta → etiqueta amigable).
- **Mejora:** Las cifras de Inicio (resumen y Sala de control) latean suavemente al cambiar.
- **Corrección:** Arrastrar pendientes al Calendario funciona en tablet/celular (pointer drop; HTML5 DnD no sirve con touch).

### Novedades en v1.38.7 (progreso al crear respaldo)
- **Nuevo:** Barra de progreso en Opciones de Desarrollador al crear respaldo (pasos: preparar → BD → fotos → limpieza).

### Novedades en v1.38.3 (botones Inventario + stock crítico)
- **Mejora:** Botones **Nuevo Repuesto**, **Excel** y **Registrar Movimiento** con misma altura/ancho (rejilla en celular; tamaño uniforme en escritorio).
- **Mejora:** La alerta **Stock crítico** ya no se aprieta en el encabezado: franja ancha debajo del título, con acciones claras (filtrar / sin proveedor / borrador OC).

### Novedades Anteriores (v1.38.0 - checklist completo + recordatorio Telegram)
- **Nuevo:** No se puede enviar el checklist diario incompleto (checks y lecturas obligatorios); observaciones vacías → **N/A**. Validación en UI y API.
- **Nuevo:** Recordatorio Telegram si el checklist del día no está enviado (default 10/14/16 hora México; `CHECKLIST_REMINDER_HOURS`).

### Novedades en v1.37.0 (código MTTO + fijo/controlable)
- **Nuevo:** Formato de código de activos **`MTTO-NNNN-S-DDD-T`** en altas nuevas (reemplaza `ACT-XXXX`). NNNN por nombre de equipo; S = sección A–E o X; DDD = duplicado en la misma zona (mismo nombre); T = F/C.
- **Nuevo:** Campo obligatorio **Tipo de activo** (`asset_kind`: Activo fijo / Controlable). El código se regenera al editar nombre, zona, sección o tipo.
- Los activos con código `ACT-####` existentes se conservan hasta una edición que regenere el código.

### Novedades en v1.36.0 (sección de activos L1–L5)
- **Nuevo:** Campo **Sección** (A–E) en activos cuya zona es exactamente L1–L5. Obligatorio al crear/editar en esas líneas; oculto y nulo en el resto. Visible en detalle/listado; filtro por sección al filtrar una zona Lx.

### Novedades en v1.35.2 (fechas CSV inventario)
- **Corrección:** Importación CSV de movimientos/OT interpreta fechas Fiix como **día/mes/año** (no mm/dd US) y las muestra en locale México.

### Novedades en v1.34.2 (movimientos OC + PDF vertical)
- **Corrección:** Movimientos de recepción de OC con **fecha = instante de recepción** (válido si el material llega antes de lo pactado). El listado de movimientos ya no corta a 1000. PDF de OC en **vertical**.
- **Mejora:** Busca `PO-` o `Recepción` en Inventario → Movimientos.

### Novedades en v1.34.1 (totales pedido vs recibido)
- **Mejora:** En recepción/detalle de OC: **Total pedido** (orden original) y **Total recibido** (cantidad real × costo unitario), con subtotales por línea.

### Novedades en v1.34.0 (recepción parcial OC)
- **Nuevo:** Al recibir una Orden de Compra puedes capturar cantidad real por línea (más/menos que lo pedido). Solo lo recibido suma al inventario; se guarda pedido vs recibido y el movimiento lo documenta.

### Novedades en v1.33.1 (deploy endurecido)
- **Mejora:** `install.sh` / `update.sh` listos para servidor nuevo: PM2 con `node dist/index.js`, Node 22 default, smoke test con reintentos, `chmod +x` tras pull, defaults **S** para PM2 startup y nginx+healthcheck.
- **Docs:** README con checklist «servidor nuevo» y tabla de fallos (502 / nodemon / Permission denied).

### Novedades en v1.33.0 (export Excel nativo)
- **Nuevo:** Exportación `.xlsx` en Órdenes (lista filtrada), Inventario/Repuestos (filtrados) y KPIs (multi-hoja: resumen, top fallas, costos, técnicos, tendencia). CSV e impresión se conservan.

### Novedades en v1.32.0 (offline ampliado, sala de control, Node 22)
- **Nuevo:** Offline: checklist (editar/enviar) + salidas de inventario OUT con `client_request_id` idempotente; endurecimiento de sync de fotos (limpia blobs al descartar).
- **Nuevo:** Inicio «sala de control» (admin/gestionador): Urgentes / Sin asignar / SLA riesgo / SLA vencido + badge en pestaña + sonido opcional.
- **Mejora:** Code-splitting por rutas + `manualChunks` (react/recharts/jspdf).
- **Cambio:** Node.js 22+ (`.nvmrc`, install/update, `engines`).

### Novedades en v1.31.0 (UX OT + import fotos + rendimiento)
- **Mejora:** `update.sh` pregunta si actualizar nginx (o `UPDATE_NGINX=1`) para evitar 413 en zips.
- **Mejora:** Listado de Órdenes más ligero (sin firmas base64 en el GET de lista).
- **Mejora:** Galería Antes/Después con tamaño fijo y zoom.
- **Mejora:** Fotos offline al finalizar se encolan y se suben al recuperar señal.
- **Nuevo:** Navegación ← → entre OT en el detalle (lista filtrada).
- **Corrección:** Búsqueda global Cmd/Ctrl+K encuentra `FOL-0001`.

### Novedades Anteriores (v1.30.11 - búsqueda FOL)
- **Corrección:** Filtrar por `FOL-0001` en Órdenes de Trabajo ya encuentra la orden (antes el buscador solo miraba `wo-####`).

### Novedades Anteriores (v1.30.10 - semántica FOTO ANTES)
- **Cambio:** En la importación CSV/zip, **FOTO ANTES** solo llena `before_image_url` (evidencia del técnico). No se usa como foto del solicitante (`request_image_url`).

### Novedades Anteriores (v1.30.9 - fotos OT en detalle tras importar)
- **Corrección:** El detalle de la OT vuelve a pedir los datos al abrir, para mostrar Antes/Después importados aunque la lista en memoria estuviera vieja.

### Novedades Anteriores (v1.30.8 - fotos OT visibles en listado)
- **Corrección:** La importación del zip de solicitudes asigna FOTO ANTES → evidencia «Antes» y FOTO DESPUÉS → «Después»; el listado puede mostrar la de «Antes» en tarjetas.

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
- [x] Exportación / impresión de reportes (CSV en órdenes, PDF de OT, impresión desde KPIs, **Excel nativo .xlsx** en Órdenes / Inventario / KPIs — v1.33.0).

## [x] Módulo 9: Sistema Integral de Órdenes de Compra (POs)
- [x] Convertir la actual "Lista de compras .txt" en Órdenes de Compra digitales reales guardadas en la base de datos.
- [x] Flujo de estados: "Borrador" -> "Solicitado" -> "Recibido".
- [x] Alimentación automática del inventario al marcar un PO como "Recibido".
- [x] **Stock crítico accionable (v1.18.0):** Desde la tarjeta de Stock Crítico en Inventario, generar borradores de OC con ítems bajo mínimo en un clic (agrupados por proveedor).

## [ ] Mejoras Transversales Futuras (Backlog)
- [x] **Importación Google Sheets Fase 1 (v1.46.0):** Botón «Importar ahora» (2 Sheets, 7 pestañas). CSV/zip se conservan.
- [x] **Fotos Google Drive (v1.46.3):** Casilla + `GOOGLE_DRIVE_*`; prioridad zip → Drive → `data/`. Pendiente: auto-sync periódico.
- [x] **Migración de Órdenes e Inventario:** Importación exitosa de los archivos CSV históricos.
- [ ] **Checklists avanzados y LOTO:** Pasos obligatorios dentro de la Orden de Trabajo y firmas de bloqueo de energías peligrosas.
- [x] **Notificaciones y Escalamiento:** Recordatorios y escalamiento SLA por prioridad (respuesta, detenida, resolución) vía Telegram + in-app a gestores/admins (v1.14.0).
- [ ] **Control de Medidores (CBM):** Registro histórico de horómetros y detonación automática de PMs por uso real.
- [x] **Soporte PWA (Offline) para técnicos (v1.26.0 + fix v1.26.3 + v1.32.0):** Aceptar/pausar/finalizar/reanudar OT funciona sin conexión; v1.32 añade checklist (editar/enviar) y salidas de inventario OUT con idempotencia; sync de fotos limpia blobs al descartar. Pendiente: IN/catálogo offline y más módulos.
- [x] **Gestión con Códigos QR:** Escaneo físico en máquinas para abrir historiales y escaneo en estantes para el control rápido de refacciones (incluye galería si no hay HTTPS).
- [x] **Árbol de Fallas (RCA):** Clasificación Problema → Causa → Solución para Pareto; al cerrar correctivas es **opcional**.
- [x] **Calendario de Carga de Trabajo / Turnos (Roster):** Vista interactiva para gestionar y asignar turnos, días festivos y faltas del personal (Completado en v1.7.3).
- [x] **Rol Observador (v1.56.0):** Solo consulta + Mensajes; mutaciones bloqueadas en API.
- [x] **Mensajería interna (v1.54.0):** Comentarios en OT; chat 1:1 y grupos ad-hoc con adjuntos; avisos con formulario colapsado.
- [ ] **Portal de Contratistas:** Acceso limitado para proveedores externos donde puedan reportar sus trabajos sin ver datos sensibles.
- [ ] **Multiplanta / Multisítio:** Segregación de información para empresas con múltiples fábricas con un dashboard corporativo global.
