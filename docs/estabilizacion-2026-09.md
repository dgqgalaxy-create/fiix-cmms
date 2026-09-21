# Estado de estabilización — 21 de septiembre de 2026

La versión base revisada es v1.63.0 (`bd54cbb`). La continuación local v1.64.0 completa los pendientes comprobados en la revisión; ver [detalle de release](estabilizacion-resumen-release.md).

- [x] Cierre atómico de órdenes y consumo de repuestos (conservado y verificado).
- [x] Importación sin truncar historial, detección de movimientos repetidos y transacción del lote de datos.
- [x] Stock protegido ante concurrencia y recepción parcial de compras con control de reintentos.
- [x] Bloqueo de desarrollador independiente de preferencias y serialización de intentos.
- [x] Proxy de imágenes con validación IPv6 y conexión fijada a IP verificada.
- [x] Candado de importación entre procesos y recuperación del estado tras reconexión.
- [x] KPIs con tiempos válidos, disponibilidad calendario y supuestos MTBF visibles.
- [x] Paginación del filtro de stock crítico desde la base de datos.
- [x] Versión, novedades y documentación sincronizadas.

La bandeja offline, el expediente anual, los reportes de calidad y auditoría y la restauración transaccional ya existían en la base. No se afirma cobertura visual completa ni disponibilidad exacta por turnos; esos límites están descritos en el manual y el resumen de release.
