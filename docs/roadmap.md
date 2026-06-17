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

## [ ] Módulo 9: Sistema Integral de Órdenes de Compra (POs)
- [ ] Convertir la actual "Lista de compras .txt" en Órdenes de Compra digitales reales guardadas en la base de datos.
- [ ] Flujo de estados: "Borrador" -> "Solicitado" -> "Recibido".
- [ ] Alimentación automática del inventario al marcar un PO como "Recibido".

## [ ] Mejoras Transversales Futuras (Backlog)
- [ ] **Migración de Órdenes de Mantenimiento:** Alinear el esquema y agregar la funcionalidad al `seed_csv.ts` para poder importar el historial de órdenes de mantenimiento de Fiix cuando se provean los archivos base.
- [ ] **Checklists avanzados:** Pasos obligatorios dentro de la Orden de Trabajo (Ej. `[ ] Engrasar motor`).
- [ ] **Notificaciones Push/Email:** Avisar al técnico de nuevas órdenes asignadas.
- [ ] **Control de Medidores:** Registro histórico de horómetros de maquinaria.
- [ ] **Soporte PWA:** Que la app funcione offline para sótanos sin conexión.
