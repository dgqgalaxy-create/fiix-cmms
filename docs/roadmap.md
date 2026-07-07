# Hoja de Ruta y Tareas Pendientes (Living Checklist)

Este documento contiene la lista de módulos y características pendientes de desarrollar. **Se debe actualizar eliminando las tareas al completarlas** para mantenerlo siempre limpio y relevante.
*(Última actualización: 07 de Julio de 2026)*

## 🚀 Versión Actual: v1.7.1 (Lanzamiento: 07 de Julio de 2026)

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
- [x] Implementar disparadores basados en tiempo (ej. cada 30 días) o medidores.
- [x] Tarea en el servidor (Cron Job) que revise diariamente qué mantenimientos deben generarse y los cree como Órdenes de Trabajo automáticamente.

## [x] Módulo 8: Analíticas y Reportes Gráficos (Dashboard Avanzado)
- [x] Gráficas de Tiempo Medio de Reparación (MTTR) y Tiempo Medio Entre Fallas (MTBF).
- [x] Reportes de Costos de Mantenimiento desglosados por Máquina y por Fecha.
- [x] Exportación de reportes gerenciales en PDF/Excel.

## [x] Módulo 9: Sistema Integral de Órdenes de Compra (POs)
- [x] Convertir la actual "Lista de compras .txt" en Órdenes de Compra digitales reales guardadas en la base de datos.
- [x] Flujo de estados: "Borrador" -> "Solicitado" -> "Recibido".
- [x] Alimentación automática del inventario al marcar un PO como "Recibido".

## [ ] Mejoras Transversales Futuras (Backlog)
- [x] **Migración de Órdenes e Inventario:** Importación exitosa de los archivos CSV históricos.
- [ ] **Checklists avanzados y LOTO:** Pasos obligatorios dentro de la Orden de Trabajo y firmas de bloqueo de energías peligrosas.
- [x] **Notificaciones y Escalamiento:** Avisar por Email/Push/WhatsApp a técnicos y escalar SLAs vencidos a gerentes.
- [ ] **Control de Medidores (CBM):** Registro histórico de horómetros y detonación automática de PMs por uso real.
- [x] **Soporte PWA (Offline):** Que la app funcione sin conexión a internet y sincronice datos en segundo plano.
- [x] **Gestión con Códigos QR:** Escaneo físico en máquinas para abrir historiales y escaneo en estantes para el control rápido de refacciones.
- [x] **Árbol de Fallas (RCA):** Clasificación obligatoria de Problema -> Causa -> Remedio para generar análisis Pareto de fallas comunes.
- [x] **Calendario de Carga de Trabajo (Gantt):** Vista interactiva para los supervisores para balancear la carga semanal de los técnicos.
- [ ] **Portal de Contratistas:** Acceso limitado para proveedores externos donde puedan reportar sus trabajos sin ver datos sensibles.
- [ ] **Multiplanta / Multisítio:** Segregación de información para empresas con múltiples fábricas con un dashboard corporativo global.
