# Avance semanal de OT

Disponible en **Órdenes de Trabajo → Avance semanal**, para cuentas con permiso de ver todas las OT.

## Uso diario

1. Programa el trabajo desde el calendario, indicando fecha programada y fecha límite.
2. Elige una semana y una o varias zonas. Sin selección se incluyen todas las zonas.
3. Consulta los indicadores y pulsa una tarjeta para ver las OT que la componen.
4. Antes de la reunión, pulsa **Guardar corte actual**. La vista cambia al corte guardado, con su fecha y hora.
5. Descarga Excel (resumen, cortes diarios y todas las categorías) o PDF (resumen, cortes diarios y el detalle seleccionado).
6. Para volver a cifras actuales, elige **Al momento / vista previa**. Para revisar un día anterior, selecciona su corte o pulsa ese día en la tabla.

Abrir una OT desde un corte consulta el detalle **actual**. La tabla del avance conserva el estado y los datos históricos del corte, incluso si la OT se elimina después.

## Programa inicial y significado de los indicadores

- Semana de lunes 00:00 a domingo 23:59:59, en `America/Mexico_City`, independiente de la zona horaria del servidor.
- Entran en el programa las OT cuya **fecha límite** está en la semana. Si no tienen límite se usa la fecha programada. Las OT sin ambas fechas quedan fuera del programa, aunque pueden aparecer en backlog o trabajo nuevo.
- El programa inicial se fija automáticamente al comenzar la semana. Un chequeo cada minuto y al arrancar recupera la captura si el servicio no estaba disponible. Las órdenes de planes preventivos generadas después de fijarlo se muestran como incorporaciones.
- Si el sistema empieza a mitad de semana, se indica la fecha real de inicio. El programa/arrastre de esa captura no se presentan como si hubieran sido registrados el lunes. No se fija un programa retroactivo ni se reemplaza uno existente.
- **Cumplimiento:** OT del programa inicial finalizadas dentro de la semana y hasta el corte / total del programa inicial. Sin programa, el porcentaje es `—`.
- Anular, eliminar, reprogramar o mover una OT de zona no reduce el denominador. Anuladas y eliminadas aparecen por separado.
- Pendientes, en proceso, pausadas y finalizadas describen el programa inicial. Las pausadas muestran su motivo.
- **Vencidas del programa:** abiertas con fecha límite **original** anterior al corte. Sin límite explícito no se marca vencimiento. No se suman a los estados porque son las mismas OT vistas bajo otra condición.
- El filtro por zona del programa usa la zona del compromiso inicial. El backlog y trabajo adicional usan la zona registrada en la OT al corte.
- **Incorporadas:** OT programadas para esa semana que no estaban en el programa inicial; no cambian su porcentaje.
- **Reprogramadas/cambio de zona:** comparación de fechas y zona actuales al corte contra el programa inicial. No sustituye una bitácora de cada edición intermedia.
- **Arrastre anterior:** OT creadas antes de la semana y abiertas al iniciar el seguimiento; se conserva su pertenencia aunque se cierren después.
- **Trabajo nuevo fuera del programa inicial:** OT creadas durante la semana no incluidas en el programa inicial. Puede solaparse con incorporadas.
- **Backlog:** todas las OT abiertas al corte. **Backlog vencido:** las que exceden su límite actual.
- **Cierres totales:** OT finalizadas durante la semana, incluyendo las que no estaban en el programa inicial.

## Cortes e históricos

- Corte automático diario a las **23:59:59** de México, mientras el servidor está disponible y fuera de mantenimiento. Se guarda la hora real de captura.
- Se pueden guardar varios cortes manuales del día. Requieren permiso de edición de OT y conexión: nunca se encolan para ejecutarse después sin conexión.
- La tabla diaria utiliza el último corte de cada día hasta el corte consultado; para hoy en consulta actual utiliza cifras en vivo. `—` significa que no hay corte o que el día está en el futuro, no cero OT.
- Una semana pasada abre su último corte disponible. Si no existe ninguno, se informa sin reconstruir estados actuales como históricos.
- Los cortes y el programa inicial se almacenan en la base de datos, no en el navegador. El programa no se reinicia al cambiar filtros. El cron evita duplicar cortes automáticos entre procesos.

## Instalación y validación

Se agregan `WeeklyWorkOrderPlan` y `WeeklyWorkOrderCut` al esquema Prisma, con migración aditiva en `20260923120000_weekly_work_order_progress`. El flujo habitual de actualización del proyecto sincroniza el esquema y genera el cliente. Es necesario actualizar backend y frontend juntos; no modifica ni borra OT existentes.

Prueba aislada, usando una conexión PostgreSQL **local** con permiso para crear bases:

```sh
node backend/scripts/run-weekly-progress-test.cjs
```

Lee `DATABASE_URL` del entorno o de `backend/.env`. Crea una base aleatoria `fiix_cmms_test_weekly_*`, ejecuta la migración y pruebas, y elimina únicamente esa base al finalizar. Nunca usa las tablas operativas. Las pruebas cubren límites lunes/domingo y cambio de año, UTC frente a México, zonas múltiples, estados, porcentajes, concurrencia, cortes inmutables, cambios/eliminaciones y permisos.
