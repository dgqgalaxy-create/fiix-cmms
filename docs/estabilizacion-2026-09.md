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
- [x] **2. Importación segura** — sin TRUNCATE (dedupe por Inventory ID/tupla), reporte por fila
      (ver commit 9213c5b) y ahora con **vista previa dry-run**: POST /dev/import-csv-preview
      calcula cuántos movimientos se crearían/omitirían/ignorarían SIN escribir; botón en
      Opciones de Desarrollador (Paso 1) «Vista previa de movimientos» + «Confirmar e
      importar movimientos». Prueba: run-import-safety-test.sh incluye assertions de preview.
- [x] **3. Protección del stock** — salidas manuales con baja atómica condicional (nunca
      negativas, ni con retiros simultáneos); borrar una ENTRADA ya consumida queda bloqueado
      (evita stock negativo); borrar un consumo ligado a una OT queda bloqueado (trazabilidad);
      borrar salida = reversión de stock. Pendiente pulido: etiqueta de «reversión» explícita en UI.
- [x] **4. Evidencias offline recuperables** — la cola offline YA NO elimina fotos tras
      intentos fallidos: todo fallo (red, 5xx, 4xx, sesión) conserva la petición y sus fotos en
      una BANDEJA de pendientes. La cola se etiqueta por usuario (separación por usuario en
      sync y bandeja). UI: banner «Ver pendientes (N)» abre la bandeja con miniaturas de las
      fotos, motivo del fallo y acciones Reintentar (individual/todos) o Eliminar (explícito).
      Reintento automático solo mientras quedan intentos; al tope → bandeja. Verificación:
      typecheck + vite build OK (comportamiento en navegador pendiente de probar en sitio).
- [x] **5. Permisos de compras** — `PATCH /:id/status` exige permiso `MANAGE_PURCHASES` +
      guardas en controlador (rol, estado válido, cancelación solo Admin/Gestionador);
      recepción con `FOR UPDATE` + rechequeo (dos recepciones simultáneas suman stock una
      sola vez). Pendiente pulido UI: entregas parciales explícitas (por ahora cantidad por
      línea ≤ pedido queda documentada en el movimiento).
- [x] **6. Indicadores precisos (parcial)** — la disponibilidad YA NO cuenta dos veces los paros
      superpuestos: por línea/zona se unen los intervalos y solo se suma la cobertura efectiva
      (dos OT solapadas = misma disponibilidad que una sola con la misma cobertura; dos líneas
      paradas a la vez sí suman). Periodos KPI (THIS_WEEK/LAST_WEEK/THIS_MONTH/LAST_MONTH/THIS_YEAR/
      CUSTOM/ALL + intervalos de gráficas) fijos en hora de planta real (America/Mexico_City),
      independientes del TZ del proceso. El recorte de duraciones largas en el import ya avisa por
      fila (en vez de silenciarse).
  - MTBF: supuesto de horas/día ahora explícito y configurable (`FIIX_OPERATING_HOURS_PER_DAY`,
    1–24, default 24) y expuesto en cada punto como `mtbfAssumptionHoursPerDay`.
    `accumulated_time_ms` (int32 ~24.8 días): el cierre ya no puede romper por overflow (recorte
    al máximo) y el import avisa por fila; migración a BigInt queda documentada como mejora
    futura. Prueba: `backend/scripts/run-kpi-periods-test.sh`.
- [x] **7. Respaldos y actualizaciones** — restauración de BD en UNA transacción
      (BEGIN → DROP/CREATE schema → dump → COMMIT): si el dump falla a mitad se revierte
      TODO (la base queda como estaba). Tras restaurar, verificación de conteos
      (User/WorkOrder/Item) incluida en el resultado. Docker y `update.sh` ya no aplican
      `db push --accept-data-loss` por defecto: abortan si el esquema exige cambios
      destructivos; opt-in explícito `ALLOW_DB_PUSH_DATA_LOSS=1` / `FIIX_ALLOW_DB_PUSH_DATA_LOSS=1`.
      Evidencia: prueba real en Postgres local (fallo inyectado revierte; restauración
      correcta verifica 1|1).
- [ ] **8 (parcial). Auditoría y calidad** — errores de tipos del frontend CORREGIDOS
      (`npx tsc -b` en 0, 85 errores, sin cambios de comportamiento). Pendiente: bitácora

      con valores anteriores/nuevos y motivos. Hecho: transiciones de OC (`PO_STATUS`/`PO_RECEIVED`
      con de→a y cantidades recibidas) y corrección de movimientos (`INVENTORY_TX_DELETE` con
      movimiento original y motivo opcional). Pendiente: diffs antes/después en ediciones de
      catálogo/usuario/OT y el expediente anual.
- [x] **9. Centro de calidad de datos** — detector `GET /dev/data-quality`: (a) stock vs saldo de
      movimientos, (b) repuestos sin precio con movimiento/stock, (c) OT finalizadas sin foto
      «después», (d) tiempos atípicos (labor >3 d o vida total >30 d). Correcciones auditadas:
      `POST /dev/data-quality/fix-stock` (alinea stock al saldo; `INVENTORY_STOCK_CORRECTION` con
      antes/después) y `/dev/data-quality/fix-price` (`ITEM_PRICE_CORRECTION`). Panel en Opciones
      de Desarrollador → «Centro de calidad de datos» con acciones directas (Corregir saldo,
      Asignar precio, Copiar folio) y estado por sección. Prueba: `run-data-quality-test.sh`
      (detección + correcciones + auditoría).

## Revisión independiente (ronda 2026-09) — correcciones aplicadas
- **MAJOR (compras):** transiciones de estado NO-RECIBIDA (cancelar/aprobar/enviar) ahora se
  serializan con `FOR UPDATE` y re-validan el estado fresco (antes, una OC leída ENVIADA podía
  quedar CANCELADA con stock ya incrementado por una recepción paralela). Prueba H en
  `run-stock-purchase-test.sh`.
- **MINOR:** borrar una ENTRADA ahora reconstruye el saldo y bloquea si en algún punto posterior
  la entrada ya era necesaria (evita historiales internamente inconsistentes).
- **MINOR:** dedupe del import usa `external_id` como clave exclusiva cuando existe (la tupla solo
  aplica a filas sin ID): dos movimientos legítimos idénticos con IDs distintos ya no se descartan.
- **MINOR/INFO:** recorte de labor en el cierre queda marcado en la bitácora
  (`labor_clamped_at_close`); `consumed_parts` audita la cantidad ya validada; auditoría de
  ubicación refleja «Sin Asignación» persistido.
- **No aplica:** el hallazgo sobre audit post-commit (writeAuditLog ya es best-effort, nunca 500).
- **Documentado sin cambio:** parseo numérico del CSV (coma = miles, punto = decimal; cambiar
  rompería el formato Fiix actual) y escalabilidad del dedupe para historiales muy grandes.

## Checklist ampliado (del diagnóstico original)
- [ ] 10. Controles de seguridad separados de preferencias.
- [ ] 11. Descarga segura de imágenes.
- [ ] 12. Trazabilidad y expediente de auditoría.
- [ ] 13. Exclusión y estado de importaciones.
- [ ] 14. Rendimiento e interacción de listas.

## Cómo validar sin tocar la operación
- Smoke del servidor REAL: `cd backend && bash scripts/run-runtime-smoke.sh` (compila dist,
  arranca el servidor contra base temporal, login y verifica /kpis, /work-orders,
  /inventory y /charts).
- Suites backend: `cd backend && bash scripts/run-atomic-close-test.sh` (base temporal auto-gestionada).
- Typecheck backend (gate CI): `cd backend && npx tsc --noEmit`.
- Nunca apuntar las pruebas a `fiix_cmms` (los scripts lo bloquean por nombre).
