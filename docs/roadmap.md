# Hoja de Ruta y Tareas Pendientes (Living Checklist)

Este documento contiene la lista de módulos y características pendientes de desarrollar. **Se debe actualizar eliminando las tareas al completarlas** para mantenerlo siempre limpio y relevante.

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
- [ ] **Notificaciones y Escalamiento:** Avisar por Email/Push/WhatsApp a técnicos y escalar SLAs vencidos a gerentes.
- [ ] **Control de Medidores (CBM):** Registro histórico de horómetros y detonación automática de PMs por uso real.
- [ ] **Soporte PWA (Offline):** Que la app funcione sin conexión a internet y sincronice datos en segundo plano.
- [x] **Gestión con Códigos QR:** Escaneo físico en máquinas para abrir historiales y escaneo en estantes para el control rápido de refacciones.
- [x] **Árbol de Fallas (RCA):** Clasificación obligatoria de Problema -> Causa -> Remedio para generar análisis Pareto de fallas comunes.
- [ ] **Calendario de Carga de Trabajo (Gantt):** Vista interactiva para los supervisores para balancear la carga semanal de los técnicos.
- [ ] **Portal de Contratistas:** Acceso limitado para proveedores externos donde puedan reportar sus trabajos sin ver datos sensibles.
- [ ] **Multiplanta / Multisítio:** Segregación de información para empresas con múltiples fábricas con un dashboard corporativo global.
