# Contexto Global del Proyecto (CMMS)

## ¿Qué estamos construyendo?
Un Sistema Computarizado de Gestión de Mantenimiento (CMMS / GMAO) de clase mundial diseñado específicamente para entornos industriales. Inspirado en plataformas robustas como Fiix o SAP PM, pero con una experiencia de usuario (UX/UI) moderna, extremadamente rápida e intuitiva.

## Filosofía de Diseño
- **Estética Premium:** Colores vibrantes (Indigo, Emerald, Rose), interfaces limpias, animaciones fluidas, y un diseño enfocado en la usabilidad tanto en escritorio como en dispositivos móviles.
- **Rendimiento:** Interfaces optimizadas (ej. paginación), evitando recargas innecesarias (React, Vite).
- **Automatización:** Minimizar clics (autocompletado de imágenes web, alertas de stock crítico automáticas).

## Módulos Desarrollados (Completados)
1. **Autenticación y Usuarios:** Roles (Admin, Gestionador, Técnico) con matriz dinámica de permisos y autoguardado.
2. **Dashboard de Inicio:** KPIs en tiempo real, calendario interactivo, tiempo promedio para reparar (MTTR).
3. **Gestión de Activos:** Catálogo de máquinas, jerarquías y Zonas.
4. **Órdenes de Trabajo (WO):**
   - Core (creación, firma, evidencia fotográfica).
   - *WebSockets:* Notificaciones y actualizaciones silenciosas en tiempo real del portal al técnico.
5. **Directorio y Solicitantes:** Separación lógica entre personal interno y personal externo (solicitantes) para evitar mezclar registros.
6. **Mantenimientos Preventivos:** Programación por calendario con CronJobs que disparan OTs automáticamente en base a fechas o frecuencias (Días, Semanas, Meses, Años).
7. **Análisis de Causa Raíz (RCA):** Sistema de 5 Porqués para investigaciones de fallas recurrentes.
8. **Inventario y Compras:**
   - Control de refacciones (Categorías, Ubicaciones, Proveedores).
   - Módulo de Reabastecimiento con alertas de stock crítico.
   - Búsqueda inteligente de imágenes web (Puppeteer).
9. **Portal de Reportes Públicos:** Formulario accesible sin contraseña donde los usuarios de la planta pueden escanear un código y levantar un reporte (ticket).
10. **Checklist Diario:** Módulo para la revisión estructurada de las líneas de producción, con lógica estricta de un checklist por día. Incluye actividades con campos mixtos (Check, Texto y Número).
11. **Horarios y Turnos (Roster):** Calendario interactivo de arrastrar y soltar para asignar patrones de turnos (4x4) y excepciones (Vacaciones, Faltas, Tiempo Extra). Incluye integración de Días Festivos Globales (México) y soporte de impresión PDF.
12. **Manual de Usuario (v1.9.0):** Manual interactivo integrado en el sistema con UI premium, filtrado dinámico (Opciones de Desarrollador ocultas para no-administradores) y explicación profunda de mecánicas internas.

## Estrategia de Migración de Datos (Completada / En Progreso)
Los datos base de refacciones, inventario e históricos han sido integrados con éxito:
- `seed_inventory.ts` importó las refacciones.
- `seed_orders.ts` importó y unificó exitosamente todo el historial de Órdenes de Mantenimiento de años anteriores.
- **Pendiente / Actual:** La carpeta `docs/` se utilizará exclusivamente para albergar documentos de referencia (PDFs, manuales, requerimientos como formatos físicos) que dictarán las reglas de negocio, como el "Check list diario.pdf".

## Tecnologías
- **Frontend:** React, TypeScript, TailwindCSS, Vite, Lucide React, Socket.io-client.
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, WebSockets, Node-cron, Puppeteer.
