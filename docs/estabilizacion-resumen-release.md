# Estabilización 2026-09 — Resumen de release (para revisión y publicación)

Base: `origin/main` (`f0f5587`, v1.56.91). 17 commits locales, **sin push**.
Todos los cambios están en la laptop; nada se publicó todavía.

## Commits (en orden cronológico, del más antiguo al más reciente)

| # | Commit | Qué hace |
|---|--------|----------|
| 1 | `0d4f3af` | **P1 — Cierre de OT + consumo atómicos**: consumo dentro de la misma transacción que el cierre, `SELECT … FOR UPDATE` sobre la OT, bajas condicionales (nunca negativas), orden estable por ítem, `consumed_parts` en auditoría. Prueba: `run-atomic-close-test.sh`. |
| 2 | `9213c5b` | **P2a — Import de movimientos seguro**: se eliminó el `TRUNCATE` de `InventoryTransaction`; dedupe por `Inventory ID` (nueva columna `external_id` + migración) y por tupla; reporte por fila (`inventoryDetails`, `workOrderWarnings`). Prueba: `run-import-safety-test.sh`. |
| 3 | `82c7d47` | **P3/P5 — Stock y compras**: salidas manuales con baja atómica; borrar entrada consumida o consumo de OT queda bloqueado; `PATCH /:id/status` exige `MANAGE_PURCHASES` (técnico no cancela); recepción con `FOR UPDATE` anti-duplicado. Prueba: `run-stock-purchase-test.sh`. |
| 4 | `7fd75ff` | **P6a — Indicadores**: disponibilidad une paros superpuestos por línea/zona; periodos KPI e intervalos fijos en hora de planta (`America/Mexico_City`); helpers de calendario de planta. Prueba: `run-kpi-periods-test.sh`. |
| 5 | `eb19af0` | **P7a — Restauración atómica verificada**: la restauración corre en una transacción (fallo ⇒ rollback total) + verificación de conteos; `docker/entrypoint.sh` sin `db push --accept-data-loss` (opt-in `ALLOW_DB_PUSH_DATA_LOSS=1`). |
| 6 | `48de30c` | **P8a — Tipos frontend**: `npx tsc -b` en 0 (85 errores corregidos, sin cambios de comportamiento). |
| 7 | `f09d861` | **P7b — `update.sh` seguro**: sin `db push` destructivo por defecto (opt-in `FIIX_ALLOW_DB_PUSH_DATA_LOSS=1`); docs al día. |
| 8 | `32b8d53` | **P4 — Bandeja offline**: la cola ya no descarta fotos tras fallos (todo fallo → bandeja `parked`); separación por usuario; UI `OfflinePendingTray` con reintento manual y miniaturas. |
| 9 | `1a238fc` | **P8b (parcial) — Auditoría**: `PO_STATUS`/`PO_RECEIVED` con de→a y cantidades; `INVENTORY_TX_DELETE` con motivo. |
| 10 | `b659384` | **P2b — Vista previa dry-run**: `POST /dev/import-csv-preview` calcula crear/omitir/ignorar sin escribir; UI en Opciones de Desarrollador. |
| 11 | `0cf8bb9` | **P8c — Expediente anual**: `GET /dev/annual-file?year=YYYY` + botón de descarga `.xlsx` (Órdenes/Consumos/Fotos-URLs). Prueba: `run-annual-file-test.sh`. |
| 12 | `25f600a` | **P9a — Calidad de datos (backend)**: detector (stock vs saldo, sin precio, fotos faltantes, tiempos atípicos). Prueba: `run-data-quality-test.sh`. |
| 13 | `d0ea8b2` | **P9b — Calidad de datos (UI)**: panel en Opciones de Desarrollador con acciones directas (`fix-stock`, `fix-price`, copiar folio). |
| 14 | `0972b86` | **P8b — Diffs en ediciones**: `ITEM_UPDATE` y `UPDATE_WORK_ORDER` con `meta.changes` (campo/antes/después). Prueba: `run-audit-changes-test.sh`. |
| 15 | `1bbe6d2` | **P8b — Usuarios**: `USER_UPDATE` con antes/después; WO diff solo compara campos tocados. |
| 16 | `cecf954` | **P6b — MTBF y tiempos**: horas/día de operación explícitas y configurables (`FIIX_OPERATING_HOURS_PER_DAY`) + recorte seguro del int32 en el cierre (sin overflow). |
| 17 | `23ef063` | **Smoke reutilizable**: `backend/scripts/run-runtime-smoke.sh` (servidor real contra BD temporal). |

## Validación ejecutada
- **7 suites de integración** aisladas (bases `fiix_cmms_test_*`, auto-creadas y borradas):
  `run-atomic-close-test`, `run-import-safety-test`, `run-stock-purchase-test`, `run-kpi-periods-test`, `run-annual-file-test`, `run-data-quality-test`, `run-audit-changes-test`.
- **Restauración atómica** probada contra PostgreSQL real (fallo inyectado ⇒ rollback; restauración correcta ⇒ verificación 1|1).
- **Smoke del servidor real** (`node dist/index.js`, BD temporal): health, login y endpoints core en 200.
- **Aceptación HTTP sobre el servidor en ejecución** (BD demo `fiix_cmms_dev_ui`): 8/8 flujos (cierre+consumo, replay sin doble descuento, stock insuficiente, técnico-no-cancela, recepción única, salida>stock, borrado de entrada consumida, corrección de saldo auditada).
- Typechecks: `backend: tsc --noEmit` y `frontend: tsc -b` en 0; `vite build` en 0.
- La base operativa `fiix_cmms` nunca se tocó (regla cumplida en todo momento).

## Checklist de despliegue (cuando se autorice)
1. `git pull` + `./update.sh` (aplica esquema con `db push` **sin** pérdida de datos por defecto; si el esquema exigiera un cambio destructivo, `update.sh` abortará y pedirá `FIIX_ALLOW_DB_PUSH_DATA_LOSS=1` tras respaldar).
2. Los dos cambios aditivos (`InventoryTransaction.external_id` única sobre NULLs y
   `accumulated_time_ms` INT→BIGINT) los aplica `update.sh`/Docker con SQL idempotente
   ANTES del `db push` (`prisma db execute`), para que Prisma no los marque como posible
   pérdida de datos y el push quede sin pendientes.
3. `FIIX_OPERATING_HOURS_PER_DAY` (1–24): opcional; default 24 (sin cambio histórico del MTBF).
4. En Docker: mismo comportamiento seguro; `ALLOW_DB_PUSH_DATA_LOSS=1` solo si se entiende el riesgo.
5. Ningún cambio de esquema destructivo incluido en esta fase.

## Limitaciones conocidas / mejoras opcionales (documentadas)
- ~~`accumulated_time_ms` Int (32 bits)~~ → migrado a **BigInt/int64**: sin recorte de tiempos largos; serialización BigInt→number global (commit posterior a esta tabla: `20260907010000_accumulated_time_ms_bigint`).
- MTBF asume `FIIX_OPERATING_HOURS_PER_DAY` × activos operativos; un calendario real de operación por activo daría una métrica exacta.
- La bandeja offline, la vista previa de importación, el expediente anual y el panel de calidad están listos para validación en navegador (pendiente reporte del usuario).
