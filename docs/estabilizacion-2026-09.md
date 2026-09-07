# Estabilización — septiembre 2026

Base: **v1.56.91 (`f0f5587`) = origin/main de GitHub (versión fiable)**.

## Sincronización con GitHub (hecho)
- 2026-09-06: el working tree local se alineó exactamente con `origin/main` (GitHub = fuente fiable).
- El WIP anterior que había en la laptop (cierre atómico a medias, CSVs de datos modificados, CSV de solicitudes borrado)
  quedó **preservado** en la rama `snapshot/estabilizacion-wip-2026-09-06` (commit `2f53da4`) — no se perdió nada.
- Regla de validación: **no importar, vaciar ni restaurar la base operativa** (`fiix_cmms`).
  Pruebas de integración solo sobre bases temporales `fiix_cmms_test_*` (auto-creadas y eliminadas).

## Prioridades (orden del usuario)

- [x] **1. Cierre de OT y consumo de repuestos atómicos (todo-o-nada).**
  - Antes: los repuestos se descontaban en una transacción y el estado en otra posterior;
    si el cierre era rechazado (409 por otra actualización), el descuento ya estaba hecho.
  - Ahora: el cierre + consumo ocurren en **una sola transacción** con `SELECT … FOR UPDATE`
    sobre la OT (serializa cierres concurrentes) y bajas de stock **condicionales y atómicas**
    (`updateMany stock >= cantidad`) que nunca dejan stock negativo.
    Cualquier fallo revierte todo (estado + descuentos + movimientos).
  - Repuestos procesados en orden estable por `item_id` (evita interbloqueos).
  - `consumed_parts` queda en la bitácora de auditoría al cerrar.
  - Pruebas: `backend/scripts/run-atomic-close-test.sh` (base temporal `fiix_cmms_test_*`).
    Cubren: cierre exitoso, revierte todo ante stock insuficiente, 6 cierres concurrentes → 1
    descuento, replay de cierre no descuenta 2 veces, JSON inválido → 400.
- [ ] 2. **Importación segura** — vista previa crear/actualizar/omitir; conservar historial capturado en la app.
- [x] **3. Protección del stock** — salidas manuales con baja atómica condicional (nunca
      negativas, ni con retiros simultáneos); borrar una ENTRADA ya consumida queda bloqueado
      (evita stock negativo); borrar un consumo ligado a una OT queda bloqueado (trazabilidad);
      borrar salida = reversión de stock. Pendiente pulido: etiqueta de «reversión» explícita en UI.
- [ ] 4. **Evidencias offline recuperables** — bandeja de pendientes con fotos, reintento manual, separación por usuario.
- [x] **5. Permisos de compras** — `PATCH /:id/status` exige permiso `MANAGE_PURCHASES` +
      guardas en controlador (rol, estado válido, cancelación solo Admin/Gestionador);
      recepción con `FOR UPDATE` + rechequeo (dos recepciones simultáneas suman stock una
      sola vez). Pendiente pulido UI: entregas parciales explícitas (por ahora cantidad por
      línea ≤ pedido queda documentada en el movimiento).
- [ ] 6. **Indicadores precisos** — sin doble conteo de paros solapados; MTBF sin supuestos de operación;
      duraciones largas sin recorte; periodos KPI fijos en hora de planta (`America/Mexico_City`).
- [ ] 7. **Respaldos y actualizaciones** — recuperación comprobada post-restauración; Docker sin pérdida de datos.
- [ ] 8. **Auditoría y calidad** — bitácora con valores anteriores/nuevos y motivos; expediente anual
      (órdenes, fotos, consumos); errores de tipos del frontend verificables antes de publicar.
- [ ] 9. **Centro de calidad de datos** — fotos faltantes, tiempos atípicos, repuestos sin precio,
      diferencias de inventario, con acceso directo a corregir.

## Checklist ampliado (del diagnóstico original)
- [ ] 10. Controles de seguridad separados de preferencias.
- [ ] 11. Descarga segura de imágenes.
- [ ] 12. Trazabilidad y expediente de auditoría.
- [ ] 13. Exclusión y estado de importaciones.
- [ ] 14. Rendimiento e interacción de listas.

## Cómo validar sin tocar la operación
- Backend: `cd backend && bash scripts/run-atomic-close-test.sh` (base temporal auto-gestionada).
- Typecheck backend (gate CI): `cd backend && npx tsc --noEmit`.
- Nunca apuntar las pruebas a `fiix_cmms` (los scripts lo bloquean por nombre).
