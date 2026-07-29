# Contexto Global del Proyecto (CMMS)

## ¿Qué estamos construyendo?
Un Sistema Computarizado de Gestión de Mantenimiento (CMMS / GMAO) self-hosted para entornos industriales. Inspirado en plataformas como Fiix o SAP PM, con UX moderna y operación en planta (escritorio + celular). Nombre del producto en repo: **FIIX CMMS** (despliegue LPET).

## Filosofía de Diseño
- **Estética industrial:** base slate/emerald, interfaces limpias y usables en escritorio y móvil (capa específica para técnicos en celular).
- **Rendimiento:** React + Vite, paginación y actualización en tiempo casi real sin F5.
- **Automatización:** menos clics (imágenes de refacciones, stock crítico → borrador OC, PMs por calendario, SLA).

## Módulos Desarrollados (Completados)
1. **Autenticación y Usuarios:** Roles ADMINISTRADOR, GESTIONADOR, TECNICO con matriz de permisos.
2. **Inicio (`/home`):** Resumen operativo (Pareto, tarjetas de estado, cierres de la semana). *No* es el módulo de KPIs/MTTR ni el calendario de turnos.
3. **KPIs (`/kpis`):** MTTR/MTBF, costos, dashboard de técnicos, metas.
4. **Calendario / Roster:** Turnos, excepciones y festivos (módulo aparte de Inicio).
5. **Gestión de Activos:** Catálogo, zonas, historial «de un vistazo», QR.
6. **Órdenes de Trabajo:** Creación, estados, evidencias, consumo de refacciones al cerrar, presencia/bloqueo suave, Socket.IO.
7. **Directorio y Solicitantes:** Personal interno vs solicitantes externos.
8. **Mantenimientos Preventivos:** Frecuencias por Días / Semanas / Meses / Años + cron que genera OTs. *(Medidores/CBM: backlog.)*
9. **Análisis de Causa Raíz (RCA):** Árbol **Problema → Causa → Solución** (opcional al cerrar correctivas).
10. **Inventario y Compras:** Refacciones, ubicaciones, proveedores, stock crítico, OC digitales; búsqueda de imágenes vía API DuckDuckGo (no Puppeteer).
11. **Portal `/request`:** Reporte público sin login; foto opcional.
12. **Checklist Diario:** Un checklist por día; tareas Check / Número / Texto; columnas configurables.
13. **Manual de Usuario:** Integrado en la app + `docs/manual_usuario.md` de referencia.
14. **SLA y notificaciones:** Umbrales por prioridad; Telegram + in-app + Web Push opt-in (nuevas OT / SLA); campana; aviso de actualización (GitHub vs desplegado / PWA).
15. **Capa móvil técnico:** Barra Mis OT / Escanear / Inventario / Inicio.
16. **Despliegue:** `install.sh` (Ubuntu limpio) y `update.sh` (pull + builds + PM2 `node dist/index.js` + VAPID si falta); producción UI+API en `:3000`, nginx opcional `:80`.

## Datos y documentación
- Seeds/importadores históricos: `backend/src/seed_*.ts`, herramientas en Opciones de desarrollador.
- `docs/` guarda manual, roadmap, contexto y estrategia (markdown). Los PDF de planta, si existen, son referencia externa.

## Tecnologías
- **Frontend:** React, TypeScript, Tailwind CSS v4, Vite, Lucide, Socket.IO client, PWA (vite-plugin-pwa + `push-sw.js` para Web Push).
- **Backend:** Node.js 22+, Express, TypeScript, Prisma, PostgreSQL, Socket.IO, node-cron, Multer (`uploads/`), `web-push` (VAPID).
- **Ops:** nvm, PM2, `install.sh` / `update.sh` (`ensure-vapid-env.sh`); producción `:3000` (UI+API); desarrollo UI Vite `:5173`.
