# Estabilización — v1.64.0

Revisión del 21 de septiembre de 2026 sobre la base local `bd54cbb` (v1.63.0). Estos cambios todavía no se han publicado.

- Proxy de imágenes: validación IPv4/IPv6, IP fijada para la conexión y redirecciones validadas; únicamente formatos raster admitidos.
- Seguridad de desarrollador: tabla independiente de preferencias; intentos serializados por usuario y migración diferida del bloqueo previo.
- Importación: exclusión mutua PostgreSQL compartida por procesos, estado recuperable al reconectar y transacción única para los datos. Fotos en fase posterior independiente.
- Inventario: reimportar no sobrescribe las existencias operativas; filtro de stock crítico y paginación ejecutados en la base.
- Compras: entregas parciales acumuladas, validación de pendientes, control de pantalla desactualizada y reintentos idempotentes. Movimientos y auditoría de recepción en la misma transacción.
- KPIs: cumplimiento MTTR excluye tiempos cero, disponibilidad calendario sin factor productivo inventado y MTBF identificado como estimación.
- Versiones de aplicación y archivos de dependencias sincronizadas; manual actualizado.

## Despliegue cuando se autorice

Se añaden `DeveloperAccessLock` y `PurchaseReceipt`; no se eliminan columnas ni registros. El flujo existente de update.sh/Docker aplica el esquema con db push. También se incluye SQL de migración para instalaciones gestionadas con Prisma migrate. Respaldar antes de actualizar y reiniciar el backend con el esquema actualizado.

## Límites de alcance

Las fotos no comparten transacción con los datos. La exclusión distribuida implementada corresponde a importaciones; restauraciones siguen requiriendo la operación coordinada habitual del servidor. El MTBF conserva supuestos de horas y población actual de activos; no sustituye un calendario histórico de operación. La revisión visual en navegador no forma parte de esta validación automatizada.
