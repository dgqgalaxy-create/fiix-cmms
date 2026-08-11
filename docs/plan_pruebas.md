# Plan de pruebas — FIIX CMMS

**Versión:** v1.34.0 · **Fecha:** 22 Jul 2026  
**App:** FIIX CMMS (LPET)

**Prioridades:** **P0** bloqueante producción · **P1** importante · **P2** nice-to-have

> **Nota:** El canvas *hardening-test-routine* (14 ítems) valida solo el **endurecimiento v1.56.26+**. Este documento es el **plan completo de release** (login, OT, inventario, roles, offline, etc.): no es obligatorio repetirlo tras cada smoke de seguridad; úsalo como gate de release o tras cambios grandes.


---

## Recomendación de ejecución

Enfoque **híbrido**:

| Alcance | Quién | Criterio |
|---------|-------|----------|
| **Fase 0 + Fase 1** | Operador o agente con browser | **Gate de release** — si falla, no publicar |
| Smoke UI (login, OT, inventario, portal, Excel) | Agente AI con browser | Viable si hay **URL + credenciales** de staging/prod de prueba |
| QR en planta, Telegram real, celular de técnicos, Wi‑Fi irregular | Humano en planta | No sustituible por automatización |

Orden práctico: pasar Fase 0 → Fase 1 (P0) → Fase 3 roles (P0) → resto según tiempo.

---

## Cómo usarlo

1. **Fase 0** (5–10 min) — si falla, no seguir  
2. **Fase 1 P0** (~30–45 min) — gate de release  
3. **Fase 3 roles P0** (~15 min)  
4. **Fase 2 módulos P1** (1–2 h)  
5. **Fase 4** offline / móvil (celular)  
6. **Fase 5** Dev solo en staging / con respaldo fresco  

**Cuentas mínimas:** 1 ADMINISTRADOR, 1 GESTIONADOR, 1 TÉCNICO (asignable), 1 ventana sin login para `/request`.

Marca cada casilla al completar. Anota folio, código o captura si falla un **P0**.

---

## Inventario de rutas

| Ruta | Acceso | Pantalla |
|------|--------|----------|
| `/login` | Público | Login |
| `/request` | Público | Portal de solicitudes |
| `/manual` | Público | Manual de usuario |
| `/` | Redirect → `/home` | — |
| `/home` | Auth | Inicio (resumen operativo) |
| `/dashboard` | Auth | Órdenes de trabajo |
| `/calendar` | Auth | Calendario de OT |
| `/roster` | Auth | Horarios / turnos |
| `/assets` | Auth | Activos (`MTTO-NNNN-S-DDD-T`; legacy `ACT-####`) |
| `/inventory` | Auth | Inventario (`MTTO-####`) |
| `/maintenance-plans` | Auth + permiso | Planes preventivos |
| `/purchase-orders` | Auth + permiso | Órdenes de compra |
| `/users` | Auth + permiso | Personal / solicitantes |
| `/kpis` | Auth | KPIs y metas |
| `/checklists` | Auth | Checklist diario (lista) |
| `/checklists/:id` | Auth | Formulario checklist |
| `/zones` | Auth + permiso | Zonas |
| `/permissions` | Auth + permiso | Roles y permisos |
| `/rca` | Auth + permiso | Árbol de fallas (RCA) |
| `/settings` | Auth + permiso | Configuración |

**Nav siempre:** Inicio, OT, Activos, Inventario, Checklist, Horarios, Calendario, KPIs  

**Nav condicional (permiso):** Compras, Planes, Zonas, Personal, RCA, Configuración  

**Móvil TECNICO:** Mis OT / Escanear / Inventario / Inicio  

**Deep links útiles:** `?wo=` / `?folio=` / `?asset=` / `?item=`; técnico `/dashboard?tab=mine`; inventario `?tab=items&item=`, `?tab=locations&location=`, `?scan=`

---

## Fase 0 — Infra / salud de deploy

*Duración: 5–10 min. Si falla un P0, detener el release.*

- [ ] **P0** Abrir `https://<host>/api/health` (o `:3000`) → `status: ok`, `db: ok`, `version` ≈ backend.
- [ ] **P0** Abrir la UI (con nginx, sin forzar `:3000`) → login carga; no 502.
- [ ] **P0** SSH: `pm2 status` → `fiix-backend` online; arranca con `node dist/index.js` (no nodemon / no `fiix-frontend` en :5173).
- [ ] **P1** Crear OT en una pestaña y verla en otra sin F5 → Socket.IO OK.
- [ ] **P1** (Opcional) `scripts/healthcheck.sh` o cron → sin error en log; Telegram solo si está configurado.
- [ ] **P2** Carpeta de respaldos existe; último `fiix_*.sql.gz` no está vacío / `[VACÍO]`.

---

## Fase 1 — Smoke crítico

*Duración: ~30–45 min. Cuenta ADMIN o GESTIONADOR. Gate de release = todos los P0 de esta fase.*

### Auth / sesión

- [ ] **P0** Login válido → aterriza en `/home` (sesión nueva).
- [ ] **P0** Credenciales incorrectas → error; no entra.
- [ ] **P1** Logout → `/login`; rutas protegidas redirigen.
- [ ] **P1** Usuario seed/CSV con contraseña temporal → obliga a cambiarla antes de usar la app.

### Inicio / sala de control

- [ ] **P0** `/home` carga tarjetas de estado + bloque «finalizadas esta semana».
- [ ] **P0** (Admin/Gest) Sala de control visible; clic Urgentes / Sin asignar / SLA → `/dashboard` filtrado.
- [ ] **P1** Campana: abrir notificación de solicitud → detalle de la OT.

### OT (CRUD básico)

- [ ] **P0** `+ Nueva Orden` → folio `FOL-####` inmutable; aparece en el listado (y en otra sesión vía socket).
- [ ] **P0** Abrir Pendiente → **Aceptar orden** + foto Antes → En Proceso; sin técnicos → autoasignación (admin/gest).
- [ ] **P0** Pausar → En Espera; Reanudar → En Proceso.
- [ ] **P0** Finalizar + foto Después + (opc.) refacciones → stock baja; OT no eliminable/anulable; RCA opcional en correctiva.
- [ ] **P1** Búsqueda `FOL-####` (listado + Ctrl/Cmd+K) → encuentra la orden.
- [ ] **P1** Export Excel del listado filtrado → descarga `.xlsx`.

### Inventario

- [ ] **P0** Pestaña Repuestos carga; códigos `MTTO-####` no editables.
- [ ] **P0** Registrar OUT con stock suficiente → OK; OUT > stock → bloqueado.
- [ ] **P1** Stock mínimo = 0 → rechazado; tarjeta Stock crítico filtrable.
- [ ] **P1** Excel de repuestos filtrados → `.xlsx`.

### Activos

- [ ] **P0** Lista carga; abrir activo → pestaña «De un vistazo».
- [ ] **P1** Crear activo → código `MTTO-NNNN-S-DDD-T` automático; campo Fijo/Controlable obligatorio; código no editable a mano.

### Portal `/request`

- [ ] **P0** Sin login → enviar solicitud (solicitante + activo/zona/descripción) → OT en dashboard con folio.
- [ ] **P1** Adjuntar foto (si posible) → evidencia visible en la OT.

---

## Fase 2 — Flujos por módulo

### 2.1 Órdenes (`/dashboard`)

- [ ] **P0** Tabs Vista General / Mis Órdenes / Historial cambian el conjunto de OT.
- [ ] **P1** Filtros estado / prioridad / fecha / equipo + orden (recientes / antiguos / prioridad).
- [ ] **P1** Export CSV y PDF/impresión.
- [ ] **P1** Flechas ←→ en el detalle recorren la lista filtrada.
- [ ] **P1** Dos usuarios abren la misma OT → el segundo ve «En edición por {nombre}» (solo lectura).
- [ ] **P1** Dos aceptan la misma Pendiente → el segundo recibe conflicto / 409.
- [ ] **P2** Foto en tarjeta/tabla cuando hay imagen de solicitud.
- [ ] **P2** Móvil: Atrás cierra el detalle y permanece en el listado de OT.

### 2.2 Portal `/request`

- [ ] **P0** No hay selector de técnicos.
- [ ] **P1** «Otro (escribir nombre)…» crea/usa nombre libre.
- [ ] **P1** Móvil: cámara/galería no pierde el formulario (borrador local).
- [ ] **P2** Telegram recibe alerta si las notificaciones están ON.

### 2.3 Activos (`/assets`)

- [ ] **P1** Editar datos con `MANAGE_ASSETS`; sin permiso → solo lectura.
- [ ] **P1** QR masivo → hoja de etiquetas.
- [ ] **P2** Tooltips RCA / PM / stock en «De un vistazo».

### 2.4 Inventario (`/inventory`)

- [ ] **P0** IN online OK; IN offline → bloqueado / requiere conexión.
- [ ] **P1** Categorías / Ubicaciones / Proveedores → lista de repuestos asociados clickeable.
- [ ] **P1** Ubicación: búsqueda + «Ver/Imprimir QR»; escanear código tipo ubicación abre el detalle.
- [ ] **P1** Stock crítico + `MANAGE_PURCHASES` → **Generar borrador OC** (por proveedor; sin proveedor listados en aviso).
- [ ] **P2** Navegación ←→ entre fichas de repuesto.
- [ ] **P2** QR masivo de repuestos / ubicaciones.

### 2.5 Checklist (`/checklists`, `/checklists/:id`)

- [ ] **P0** Crear checklist del día (online) → columnas L1… según catálogo.
- [ ] **P0** Completar Check / Número / Texto → enviar.
- [ ] **P1** Con `APPROVE_CHECKLIST` → revisar / aprobar pendiente.
- [ ] **P1** Settings → Catálogo: tipo de tarea + columnas + «Restaurar por Defecto».
- [ ] **P1** Editar/enviar checklist existente sin red → encola y sincroniza al volver.

### 2.6 Calendario (`/calendar`)

- [ ] **P1** Ver OT programadas; con `MANAGE_CALENDAR` agendar / mover.
- [ ] **P1** Lista lateral de pendientes sin programar (con permiso).
- [ ] **P2** No llama a `localhost`; usa el host del servidor.

### 2.7 Roster (`/roster`)

- [ ] **P1** Ver horarios; con `MANAGE_SHIFTS` asignar patrón.
- [ ] **P1** Incidencia (Falta / TXT / Vacaciones) en un día → guarda al instante.

### 2.8 KPIs (`/kpis`)

- [ ] **P0** Carga Disponibilidad / MTTR / Backlog / ejecución.
- [ ] **P1** Cambiar ventana de retrabajo (3/7/14/30/custom) → métrica cambia.
- [ ] **P1** Dashboard técnicos: carga del día, pausadas, productividad semanal.
- [ ] **P1** Excel del periodo → libro multi-hoja; Imprimir/PDF.
- [ ] **P2** Con `MANAGE_KPIS` editar metas (horas / % / órdenes).

### 2.9 Compras (`/purchase-orders`)

- [ ] **P0** Menú visible solo con `MANAGE_PURCHASES`.
- [ ] **P1** Avanzar OC BORRADOR → APROBADA → ENVIADA → RECIBIDA (o CANCELADA).
- [ ] **P1** Borradores desde stock crítico aparecen y son editables.
- [ ] **P1** En recepción (`ENVIADA` → Recibir…): editar cantidades por línea (menos/más que pedido); solo lo recibido suma stock; histórico pedido vs recibido visible en RECIBIDA.

### 2.10 Planes preventivos (`/maintenance-plans`)

- [ ] **P1** Crear/editar plan ligado a activo; visible en «De un vistazo» / calendario según diseño.

### 2.11 Zonas / Personal / RCA

- [ ] **P1** Zonas CRUD con `MANAGE_ZONES`.
- [ ] **P1** Personal: internos + solicitantes; buscar; Ver inactivos; no borrar usuario con historial → desactivar.
- [ ] **P1** RCA: jerarquía Problema → Causa → Solución; `MANAGE_RCA` alta/activar; sin él solo lectura.
- [ ] **P2** RCA móvil: flujo guiado por pasos.

### 2.12 Configuración (`/settings`)

- [ ] **P0** TECNICO no ve Configuración en el menú.
- [ ] **P1** Notificaciones Telegram ON/OFF.
- [ ] **P1** SLA por prioridad (Urgente / Normal / Bajo): recordatorio / máximo / escalamiento; badges en OT.
- [ ] **P1** Apariencia Claro / Oscuro / Sistema.
- [ ] **P1** Roles y Permisos: toggle auto-guarda (sin botón Guardar).
- [ ] **P2** Reordenar ítems del sidebar (DnD) → persiste preferencia.

### 2.13 Manual / versión

- [ ] **P2** `/manual` y modal de versión abren; versión mostrada `1.34.0`.

---

## Fase 3 — Roles y permisos

*~15 min con las tres cuentas. Samplear permisos clave tras la matriz.*

### Matriz mínima

- [ ] **P0** **ADMIN:** menú completo (Compras, Planes, Zonas, Personal, RCA, Config); sala de control; Dev options tras master password.
- [ ] **P0** **GESTIONADOR:** OT todas + compras/inventario típicos; **sin** Personal/Permisos si defaults; Settings sí (`VIEW_SETTINGS`).
- [ ] **P0** **TECNICO:** default Mis Órdenes (no Vista General completa); no crea OT si sin `CREATE_WORK_ORDERS`; no edita asignación de técnicos; bottom nav en móvil; no Settings.
- [ ] **P1** TECNICO abre OT no asignada → no opera como asignado (o solo lectura según reglas).
- [ ] **P1** Apagar `VIEW_RCA` a TECNICO → desaparece Árbol de Fallas del menú (auto-save).
- [ ] **P1** Apagar `MANAGE_PURCHASES` → sin Compras ni «Generar borrador OC».
- [ ] **P1** Sin `REGISTER_INVENTORY_ENTRIES` → puede OUT, no IN.
- [ ] **P1** Sin `DELETE_WORK_ORDERS` → no anular/eliminar OT abiertas.
- [ ] **P2** Locks ADMIN: `MANAGE_PERMISSIONS` / `MANAGE_USERS` no desactivables.

**Permisos a samplear (según tiempo):** `VIEW_ALL_WORK_ORDERS`, `CREATE/EDIT/DELETE_WORK_ORDERS`, `MANAGE_INVENTORY`, `REGISTER_INVENTORY_ENTRIES`, `MANAGE_PURCHASES`, `MANAGE_ASSETS`, `USE_QR_SCANNER`, `APPROVE_CHECKLIST`, `MANAGE_CHECKLIST_CATALOG`, `MANAGE_SHIFTS`, `MANAGE_CALENDAR`, `MANAGE_KPIS`, `VIEW_RCA` / `MANAGE_RCA`, `VIEW_SETTINGS`, `MANAGE_PERMISSIONS`.

---

## Fase 4 — Offline / móvil / tiempo real

### Offline

- [ ] **P0** Aceptar / Pausar / Finalizar / Reanudar OT offline → banner de cola; al online → «Sincronización completa (N)» y estado en servidor.
- [ ] **P0** Finalizar con fotos offline → fotos en dispositivo; suben al recuperar señal.
- [ ] **P1** OUT inventario offline → sync sin doble descuento; IN offline rechazado.
- [ ] **P1** Checklist existente: editar/enviar offline OK; **crear** checklist del día offline → requiere conexión.
- [ ] **P1** Fallo de sync (401/409) → aviso con Reintentar/Descartar; Dev → «Descartar cola offline» limpia cola + fotos locales.

### Móvil / PWA

- [ ] **P0** TECNICO: Mis OT / Escanear / Inventario / Inicio funcionan.
- [ ] **P1** Acciones grandes Aceptar / Pausar / Finalizar / Reanudar en detalle OT.
- [ ] **P1** QR: HTTPS/localhost → cámara en vivo; HTTP por IP → fallback galería (sin crash).
- [ ] **P2** Instalar PWA / service worker no rompe login ni `/api`.

### Tiempo real

- [ ] **P0** Portal crea OT → aparece en dashboard admin sin F5.
- [ ] **P1** Cambio inventario / checklist / roster en usuario A → refresca en B.
- [ ] **P1** Badge de usuarios en línea / presencia coherente (si visible).

---

## Fase 5 — Admin / Dev

> **Solo staging o con respaldo fresco.** Nunca vaciar ni restaurar producción sin confirmación explícita y backup previo.

- [ ] **P1** Desbloquear Opciones de Desarrollador (master password); sesión ~5 min.
- [ ] **P1** **Crear respaldo** → `fiix_*.sql.gz` no vacío (+ tar de uploads si aplica).
- [ ] **P2** Listar respaldos; archivos `[VACÍO]` no restaurables.
- [ ] **P1** (Staging) **Restaurar** escribiendo `RESTAURAR` → éxito cierra sesión; fallo muestra error **sin** cerrar sesión.
- [ ] **P1** Import de 7 CSV juntos → datos coherentes; folios `FOL-####`; activos nuevos sin código → `MTTO-…`.
- [ ] **P2** Zip fotos repuestos (`Items_Images`) → «Fotos asignadas: N».
- [ ] **P2** Zip + CSV solicitudes (junto a los 7 CSV) → Antes/Después por FOLIO.
- [ ] **P2** Telegram token/chat ID en UI → prueba con OT nueva.
- [ ] **P1** Descartar cola offline desde Dev.
- [ ] **P0 (peligro)** Vaciar BD solo en lab: confirma `ELIMINAR` → login `admin@fiix.com` / `password123` + aviso.

---

## Fase H — Endurecimiento v1.56.26+ (estabilidad / seguridad / rendimiento)

**Tiempo:** ~20–40 min · **Automático:** `scripts/smoke-hardening.sh` · **Checklist UI:** canvas *hardening-test-routine*

```bash
BASE_URL=http://127.0.0.1:3000 EMAIL=admin@fiix.com PASS=password123 \
  bash ./scripts/smoke-hardening.sh
```

### H1 · API / seguridad (P0)
- [ ] **P0** `/api/health` OK con `version`.
- [ ] **P0** Helmet: `X-Content-Type-Options: nosniff` (u otros headers de seguridad).
- [ ] **P0** `/uploads/...` **sin** token → **401/403**.
- [ ] **P0** `/uploads/...?access_token=<JWT>` → auth OK (404 si el archivo no existe).
- [ ] **P0** En la app: fotos de OT, activos, repuestos y avisos se ven estando logueado.
- [ ] **P1** Usuario `is_active=false`: deja de usar la API aunque tenga JWT viejo.

### H2 · Rendimiento listados (P0)
- [ ] **P0** Activos: páginas de 20 + búsqueda; Network muestra `page`/`limit`.
- [ ] **P0** Repuestos: igual; filtros stock crítico / sin proveedor.
- [ ] **P1** KPIs → top fallas (`/api/kpis/top-failures`) sin 500.

### H3 · Estabilidad cliente (P1)
- [ ] **P1** Dos usuarios/pestañas: Inicio no refresca en cascada (debounce sockets).
- [ ] **P1** Cola offline: un **401** no descarta la petición a la primera; tras re-login reintenta.
- [ ] **P1** Deploy: build PWA completa (sin error Workbox `NetworkOnly` + timeout).

### H4 · Límites (P2)
- [ ] **P2** Body JSON ~3 MB rechazado (smoke script).
- [ ] **P2** Subida de imagen enorme (>12 MB) rechazada en OT/inventario/activos.

**Criterio:** H1 P0 + H2 P0 + smoke script en verde.

---

## Quién prueba qué

| Ámbito | Agente (browser) | Humano en planta |
|--------|------------------|------------------|
| Health, login, rutas, CRUD OT (archivo), portal, Excel, checklist, KPIs, compras, permisos (3 cuentas), socket 2 pestañas | Sí | Opcional |
| Offline parcial (DevTools Network Offline) | Sí, si el browser lo permite | Preferible validar en celular real |
| QR físico, impresión de etiquetas | No | Sí |
| Telegram real (alertas OT / SLA / healthcheck) | Solo bot de prueba en staging | Sí en prod |
| Cámara / firma / fotos de campo | Limitado (archivo) | Sí |
| Wi‑Fi irregular, HTTP vs HTTPS en celulares, PWA «Añadir a inicio» | No | Sí |
| Cron backup 2:15 / retención 14 días / restore completo Ubuntu | No | Ops / Dev |
| Import masivo (~2000 fotos, zip grande, nginx 413) | No | Ops |
| Wipe / restore BD producción | **Prohibido** | Solo con procedimiento |

---

## Orden sugerido

1. Fase 0 (5–10 min)  
2. Fase 1 smoke **P0** (30–45 min) — **gate de release**  
3. Fase 3 roles **P0** (~15 min)  
4. Fase 2 módulos **P1** (1–2 h)  
5. Fase 4 offline / móvil (30–60 min; celular)  
6. Fase 5 Dev solo staging (30–90 min)  

**Criterio de release mínimo:** Fase 0 P0 + Fase 1 P0 + Fase 3 P0 en verde.
