# Manual de Usuario - GTZ CMMS
*(Versión 1.54.0 - 4 de Agosto, 2026)*

Este manual se mantiene alineado con cada release de la app (misma versión que `package.json` y el modal de novedades).

GTZ CMMS centraliza el ciclo completo del mantenimiento: reportar una necesidad, asignar responsables, documentar tiempos y refacciones, cerrar con evidencia y convertir el historial en indicadores para tomar decisiones.

Sus pilares son **Rapidez** (menos formatos y pasos), **Trazabilidad** (responsables, fechas, firmas, consumos y evidencias) y **Control** (permisos por rol y protección de acciones críticas). El flujo recomendado es:
1. **Reportar** la solicitud con activo, zona, descripción y prioridad.
2. **Asignar** técnicos y comenzar el seguimiento.
3. **Ejecutar** el trabajo, registrando tiempos, pausas, consumos y solución.
4. **Comprobar** el cierre mediante evidencia; la información alimenta historial y KPIs.

En celular, el temario del manual aparece como una barra horizontal deslizable. Toca un tema para mostrarlo debajo con una transición de entrada de derecha a izquierda. El encabezado, el temario y el botón **Volver** permanecen fijos; únicamente se desplaza la información del tema hasta el borde inferior, con un degradado superior que aparece progresivamente.

## 0. Operación diaria
- **Inicio de sesión:** Si el usuario o la contraseña no son correctos, verás el mensaje **Contraseña o usuario incorrectos** en la misma pantalla (puedes reintentar de inmediato). No hay bloqueo por intentos fallidos en el login (el menú de Desarrollador sí bloquea tras 3 fallos). El login **no** muestra credenciales de prueba de forma permanente; solo tras **Vaciar base de datos** aparece un aviso con `admin@fiix.com` / `password123`.
- **Colaborar en OT en curso:** Si una orden ya está **En proceso** o **En espera** y tú no estás en la lista de asignados, no verás el desplegable de estado ni Pausar / Finalizar / Reanudar: solo **Unirme / Colaborar**. Al unirte aparecen las acciones. En **Pendiente** no aparece Unirme / Colaborar: solo **Aceptar orden** (te asigna al aceptar). En la interfaz móvil de técnico las acciones van en botones grandes (sin duplicar el desplegable).
- **Ayudas ⓘ (InfoTip):** En pantallas táctiles (y también en PC) el icono ⓘ abre una explicación breve (pestañas de Órdenes, folio, Stock crítico, KPIs, SLA, etc.).
- **Asignación masiva:** En Órdenes de Trabajo, **Asignar…** permite elegir varias OT abiertas y asignarles **técnicos o gestionadores** de una sola vez.
- **Turno actual (Inicio):** Panel con conteo por técnico de OT abiertas (pendientes / en proceso / en espera y avisos SLA). Un toque lleva a Órdenes.
- **Líneas paradas / racha (Inicio):** Chips L1–L5 por OT correctiva o preventiva abierta con paro de máquina; la racha y el **récord** siguen siendo solo correctivo (preventivos no reinician la racha).
- **KPIs — comparar semanas:** Periodo **Semana pasada** y, al ver **Esta semana**, franja de comparación vs la semana anterior.
- **Costos congelados (histórico):** Al **finalizar una OT**, el costo de cada refacción se guarda en ese momento (`unit_cost`) y ya no cambia si después actualizas el precio en inventario. Lo mismo aplica a movimientos de inventario y a la recepción de OC. Los totales de OT, KPIs de costos y gastos de activo usan ese snapshot (no el catálogo “de hoy”). `0` = se cerró sin precio de catálogo o costo cero; un precio positivo = el que tenía el repuesto al consumirse.
- **Órdenes de compra — costos y aprobación:** Al crear o en un borrador, el **costo unitario** se toma del inventario. Solo un **Administrador** puede modificarlo en la compra; si lo cambia, también se guarda en el artículo del catálogo. El Gestionador ve el precio precargado (solo lectura). **Aprobación:** solo un **Administrador** aprueba borradores; el Gestionador no puede autoaprobarse. Si un Admin crea la OC, queda **aprobada de inmediato**. **Precio congelado:** en aprobada/enviada/recibida/cancelada el costo de la OC ya no se actualiza si cambias el precio en inventario (queda el de esa compra; el catálogo puede mostrar otro precio “hoy”). En el detalle puedes tocar el código/nombre del ítem para abrir su ficha. En borradores: **Actualizar precios del inventario**.
- **Unidades de medida:** En **Configuración → Unidades de Medida** (Administrador). Al crear o editar una unidad eliges **enteros** o **decimales**. En cada repuesto eliges Unidad y **Cantidades** (Enteros / Decimales); movimientos, consumo en OT y OC respetan esa regla.
- **Avisos globales:** En **Notas y pendientes → Avisos**. Los ve todo el equipo. Solo un **Administrador** puede publicar: toca **Nuevo aviso global** para abrir el formulario (título, mensaje y foto opcional); **Cancelar** lo oculta. Al abrir la pestaña se marcan como vistos; toca la foto para ampliarla dentro de la app. El Admin ve **Visto por X/Y** y la lista de personas. Push/in-app al publicar.
- **Mensajes (chat interno):** En el menú **Mensajes**. Puedes abrir un chat **1:1** con otro usuario activo o crear un **grupo** eligiendo título y participantes. Adjunta imagen o archivo (PDF/docs). El badge del menú muestra no leídos; también llegan notificaciones in-app y push.
- **Comentarios en OT:** En el detalle de una orden, sección **Comentarios**. Quien pueda abrir la OT puede leer y escribir (texto + adjunto opcional). Los comentarios se actualizan en vivo si el modal está abierto; se notifica a asignados y creador.
- **Notas y pendientes:** En el menú lateral (con contador de abiertos) y tarjeta en **Inicio**. **Mis notas** son privadas (solo tú). **Pendientes operativos** solo los crean/editan **Administrador** y **Gestionador** (pueden asignarlos a técnicos u otros). El **técnico** asignado solo los ve y puede **completarlos** (sin editar ni eliminar). Ligados opcionalmente a OT o activo. Recordatorio: in-app + push (no Telegram).
- **Bitácora de auditoría:** Solo **Administrador**, en Opciones de Desarrollador. El histórico se guarda **sin límite** en la base de datos. En pantalla verás los últimos 50 eventos; puedes **descargar Excel** filtrando por fechas (Desde/Hasta, día México) o el **histórico completo**.
- **Tiempo real:** Los listados y catálogos se actualizan casi al momento cuando otro usuario crea, edita o elimina datos (órdenes, inventario, activos, compras, checklist, turnos, RCA, zonas, usuarios, etc.). No hace falta pulsar F5.
- **Edición concurrente de OT:** Si abres una orden de trabajo, eres el editor. Quien abra la misma orden después la verá en **solo lectura** con el mensaje «En edición por {nombre}». Al cerrar el detalle (o si se pierde la conexión ~40 s), otro puede tomarla. Si dos intentan aceptar la misma orden a la vez, el segundo recibe un aviso de conflicto y debe recargar.
- **Folios FOL-####:** Cada orden recibe un folio automático e inmutable (`FOL-0001`, `FOL-0002`…). No se edita. En importación CSV se usa la columna `FOLIO` (acepta `FOL-####` o el número).
- **Códigos de refacciones MTTO-####:** Ya se generan así al crear el repuesto y el código queda bloqueado (no editable).
- **Consumo de refacciones desde la OT:** Al finalizar una orden, en «Repuestos a descontar del almacén» agrega las piezas usadas. La **cantidad debe ser positiva** (mayor a 0; no se permiten negativos ni cero — el sistema descuenta del almacén al cerrar). Valida stock, descuenta en una sola operación y liga el movimiento a esa OT. En el detalle de una OT finalizada verás los repuestos consumidos y el **costo de refacciones** de esa orden (montos en pesos mexicanos: `$1,234.56`). Si el catálogo no tenía costo al cerrar, el total usa el costo actual del repuesto (ya no se congela en $0).
- **Historial del activo de un vistazo:** Al abrir un activo (o escanear su QR) la pestaña **De un vistazo** muestra últimas OTs, fallas RCA frecuentes, PMs próximos/vencidos, stock crítico de repuestos del plan y costo acumulado (valor del activo + refacciones). Pasa el puntero sobre las etiquetas (icono ?) para ver la definición de RCA, PM y stock crítico.
- **Búsqueda global (Ctrl/Cmd+K):** Desde cualquier pantalla abre el buscador único para activos, repuestos, ubicaciones, folios FOL (p. ej. `FOL-0001`) y **zona** (p. ej. `L1`). Si la consulta coincide con una zona, aparece el atajo **Órdenes en zona…** que abre Órdenes ya filtradas. En celular usa el icono de lupa en la barra superior.
- **Impresión masiva de QR:** En **Activos**, Inventario → **Repuestos** o Inventario → **Ubicaciones**, usa **QR masivo**, selecciona registros (incluidos todos los filtrados) e imprime una hoja con las etiquetas.
- **Aviso de actualización:** Si en GitHub hay una versión más nueva que la del servidor, aviso ámbar (Admin: `./update.sh` / Actions). Si el servidor ya se actualizó pero la pestaña sigue con cache vieja, se detecta y **recarga** (o banner azul «Recargar ahora»). Ese botón desregistra el service worker y limpia la caché de la app para tomar el build nuevo.
- **Si la versión no sube tras recargar:** prueba en este orden — (1) **Ctrl+Shift+R** (recarga forzada); (2) en Chrome/Edge → DevTools (F12) → Application → Storage → **Clear site data**; (3) Application → Service Workers → **Unregister**, luego recarga. En la app, Admin puede usar Opciones de Desarrollador → **Limpiar caché PWA** (cuando tras `./update.sh` o un aviso de actualización la PWA sigue en la versión vieja, con pantallas rotas o sin los botones nuevos).
- **Borrador de compra desde Stock Crítico:** En Inventario, la franja **Stock crítico** (debajo del encabezado) muestra cuántos ítems están bajo mínimo. Un toque filtra la lista; **sin proveedor** aísla los que faltan de proveedor; con permiso de compras, **Generar borrador OC** crea Órdenes de Compra en estado Borrador (una por proveedor, cantidad = lo faltante para llegar al mínimo). Revisa y avanza el flujo en **Órdenes de Compra**.
- **Recepción parcial:** En una OC **Enviada**, **Recibir…** pide la cantidad real por línea (puede ser menos, igual o más que lo pedido). Solo lo recibido entra al inventario como movimiento de entrada con **fecha = momento en que confirmas la recepción** (aunque el material llegue antes de la fecha pactada). Motivo `Recepción de Orden de Compra PO-…`. La OC se cierra como Recibida con histórico pedido vs recibido y dos totales (pedido / recibido). En **Inventario → Movimientos** busca `PO-` o `Recepción` si el listado está mezclado con fechas del CSV histórico.
- **Nueva OC:** Al elegir un **proveedor**, se abre el catálogo de sus refacciones sin tener que escribir. También puedes buscar por **nombre o código** sin elegir proveedor; al tocar el ítem se asigna su proveedor a la orden.
- **Cancelar OC:** Mientras no esté Recibida, usa **Cancelar Orden** (pasa a CANCELADA). No hay borrado físico hoy. Una OC **Recibida** no se puede cancelar (el stock ya entró).
- **PDF / Imprimir OC:** En el detalle de una Orden de Compra, **Descargar PDF / Imprimir** genera una hoja A4 vertical (retrato) con proveedor, líneas y totales (pedido y, si está Recibida, también recibido). Solo se imprime esa hoja — no el resto de la pantalla ni páginas en blanco al final.

## 1. Módulo Checklist: Campos Numéricos y de Texto
Las actividades del Checklist ahora son más flexibles:
- **Iniciar sin autoasignar:** Al **crear** o **abrir** el checklist del día no se asigna técnico: puedes verlo en solo lectura. Para editarlo y firmarlo pulsa **Iniciar checklist** (te asigna a ti). Si otro técnico ya lo inició, verás «Asignado a …» y no podrás editar ni enviar. En el listado, **Continuar** aparece solo si eres el técnico asignado; si no, **Ver**.
- **Traspasar responsabilidad:** Si eres el técnico asignado de un checklist en borrador (sin traspaso pendiente), usa **Traspasar** y elige a otro usuario. El destinatario ve un aviso para **Aceptar** o **Rechazar**; hasta que acepte solo puede verlo en lectura. Tú puedes seguir editando o **Cancelar traspaso** mientras esté pendiente. Al aceptar, pasa a ser el técnico asignado (puedes Continuar / Firmar). Hay notificación in-app al ofrecer, aceptar, rechazar o cancelar.
- **Tipo por tarea (Catálogo):** En Configuración → Catálogo de Checklist, cada pregunta tiene un selector **Check / Número / Texto**. Check usa OK/Falla/N/A; Número y Texto muestran un campo para capturar lecturas. El cambio aplica a los checklists nuevos.
- **Columnas / máquinas:** En el mismo catálogo, el campo **Columnas** define cuántas líneas (L1, L2…) tendrá el formulario (1 a 12). Si agregas una máquina, aumenta el número; el siguiente checklist diario ya mostrará la columna nueva. Los checklists ya creados conservan el número con el que se generaron.
- **Campos Mixtos:** Además de los clásicos checks (✔️/❌), algunas actividades específicas (como temperatura o lecturas de agua) mostrarán un pequeño campo de texto.
- **Uso:** Simplemente haz clic en la línea correspondiente y teclea el valor numérico (ej. 45.5) o un texto corto. El sistema guardará la información tal como si fuese un check tradicional.
- **Envío completo obligatorio:** No puedes firmar y enviar si falta algún check o lectura (número/texto) en alguna línea. Si marcas una **cruz (falla)** en una fila, la **observación de esa fila es obligatoria**. Con palomita o N/A, la observación vacía se rellena sola con **N/A** al enviar.
- **Imprimir / PDF:** Solo cuando el checklist ya está **enviado/firmado** o **revisado** (no en borrador). El PDF se genera en **una hoja A4 vertical** con la matriz completa.
- **Incumplimiento (autocierre):** Al pasar la medianoche (hora México), si el checklist del día no se envió (o ni siquiera se creó), queda en estado **Incumplimiento** y **ya no se puede editar ni enviar**. Si no tenía técnico, un **Administrador** puede asignarle uno (el estado sigue en Incumplimiento). Solo el **técnico asignado** puede **Solicitar continuar**; un **Administrador** debe **Aprobar** (o Rechazar). Al aprobar se reabre en borrador para completarlo y enviarlo con normalidad.
- **Recordatorio Telegram:** Si el checklist del día no se crea o no se envía, el sistema avisa por Telegram en horario laboral (por defecto 10:00, 14:00 y 16:00, hora México).
- **Configuración:** Para restaurar el listado estándar (con temperaturas en Número y lecturas de agua en Texto), ve a Configuración → Catálogo de Checklist y pulsa **"Restaurar por Defecto"**.

## 2. Módulo Inventario: Mejoras y Restricciones
Se han mejorado las reglas del almacén para prevenir errores y mejorar la fluidez:
- **Stock inicial al crear:** Al dar de alta un repuesto puedes indicar un **Stock inicial**. Si es mayor a 0, el sistema crea automáticamente un movimiento de **entrada** con motivo `Levantamiento de inventario (stock inicial)` (queda en el historial). En **editar**, el stock es solo lectura: para cambiarlo usa **Registrar movimiento** (entrada/salida).
- **Cantidades Flexibles (Decimales y Enteros):** Al registrar movimientos puedes usar cantidades decimales (ej. 0.5 litros o metros) tecleando el valor. Por otro lado, usar los botones (+/-) ajustará la cantidad de 1 en 1 (enteros).
- **Acceso Ágil para Técnicos:** El botón "Registrar Movimiento" se encuentra disponible directamente en la vista principal de Repuestos, sin necesidad de cambiar a la pestaña de historial. En celular, **Nuevo** / **Excel** / **Movimiento** comparten la misma fila y tamaño; en escritorio los tres botones tienen altura y ancho mínimos iguales. En el **detalle del repuesto**, el botón naranja **Registrar movimiento** también lo ven Técnico y Gestionador (no solo Admin): por defecto solo puedes registrar **salidas (OUT)**; si tu rol tiene el permiso **Registrar Entradas de Inventario**, el mismo modal permite **entradas (IN)**.
- **Guardado Silencioso:** Los registros de movimientos, así como las creaciones de repuestos, ahora se sincronizan en segundo plano sin mostrar pantallas de carga molestas.
- **Validación de Stock Mínimo:** El sistema ya no permite configurar un stock mínimo igual a 0.
- **Bloqueo de Inventario Negativo:** Si intentas sacar más piezas de las que existen actualmente, el sistema bloqueará la operación con una alerta.
- **Movimientos sin conexión:** Puedes registrar **salidas (OUT)** y **entradas (IN)** sin señal; se guardan en el dispositivo y se aplican al recuperar conexión (sin duplicar el mismo movimiento).
- **Área táctil:** En Inventario, los botones de escaneo QR y las acciones de cada fila (movimiento / QR / editar) tienen un área mínima amplia para dedo.
- **Ubicación Automática:** Si creas un nuevo repuesto o importas un CSV sin definir lugar, el sistema lo agrupará bajo la ubicación "Sin Asignación".
- **Ver Detalle desde Categorías, Ubicaciones y Proveedores:** Al abrir el detalle de una Categoría, Ubicación o Proveedor, la lista de "Repuestos Asociados" ahora es clickeable: selecciona cualquier repuesto de esa lista para abrir su ficha completa de detalle, igual que si lo hubieras abierto desde la pestaña de "Repuestos".
- **Navegar entre repuestos:** Con la ficha de un repuesto abierta (desde la lista de Inventario), usa las flechas ← → del teclado o los botones del encabezado para pasar al anterior/siguiente según el filtro y orden actuales. Mientras editas un campo de texto las flechas no cambian de ítem.
- **Exportar Excel:** En la pestaña Repuestos, el botón **Excel** descarga un `.xlsx` con los ítems según el filtro y orden actuales (código, nombre, categoría, ubicación, proveedor, stock, mínimo, etc.).
- **Búsqueda y QR en Ubicaciones:** La pestaña "Ubicaciones" ahora tiene barra de búsqueda (por nombre o código) y botón de escaneo QR, igual que la pestaña de Repuestos. Cada tarjeta de ubicación incluye un botón "Ver / Imprimir QR" para generar el código de esa ubicación física; al escanearlo se abre automáticamente el detalle con todos los repuestos que contiene.
- **Stock Crítico accionable:** La tarjeta superior indica la cantidad de ítems bajo mínimo. Haz clic en ella para filtrar la lista (puedes quitar el filtro con la pastilla). Con permiso **Gestionar compras**, usa **Generar borrador OC** para crear borradores de Orden de Compra agrupados por proveedor. Ya no hace falta el filtro duplicado junto a la búsqueda ni descargar una lista .txt.

## 3. Módulo Calendario (Roster)
- **Corrección de Incidencias:** Se ha resuelto el problema que impedía guardar incidencias como (Falta, TXT, Vacaciones, etc.). Ahora basta con elegir la incidencia de la lista desplegable en el día del empleado y el sistema guardará la excepción inmediatamente.

## 4. Módulo Inicio

Pantalla de resumen operativo (antes mezclada con el listado de órdenes). Es la pantalla de entrada al abrir el sistema en una sesión nueva.
- **Líneas paradas:** Chips L1–L5 y detalle de OT correctivas o preventivas abiertas con **¿Paró máquina?** = Sí (`machine_stopped`). Si no hay ninguna, el panel lo indica en verde. Toca una OT para abrirla en Órdenes.
- **Racha sin paro:** Días naturales sin un evento de paro correctivo en L1–L5 (preventivos no cuentan). Al reportar un nuevo paro correctivo en esas líneas, la racha vuelve a 0. El panel muestra también el **récord** (mayor racha histórica entre eventos de paro) y mensajes breves de ánimo; si la racha actual iguala o supera el récord, el texto es de celebración. Las fechas y horas que llegan por importación CSV/Sheets se interpretan siempre en **hora de planta (México)**, así que la racha y el récord son los mismos en el servidor y en cualquier equipo local.
- **Sala de control (Administrador / Gestionador):** Franja superior con conteos de **Urgentes abiertas**, **Sin asignar**, **SLA en riesgo** y **SLA vencido**. Cada tarjeta abre **Órdenes de Trabajo** ya filtrada. El título de la pestaña del navegador muestra `(N) GTZ CMMS` cuando hay críticas, y puedes activar/desactivar **Sonido al llegar OT críticas** (por defecto encendido; se guarda en el navegador).
- **Escáner QR:** Al leer un código suena un bip corto. Las etiquetas nuevas usan prefijo `GTZ-ASSET` / `GTZ-ITEM` / `GTZ-LOCATION`; las antiguas `FIIX-*` siguen funcionando.
- **Turno actual:** Debajo de Sala de control (o al inicio del resumen), lista compacta por técnico con pendientes / en proceso / en espera y avisos SLA. Toca una fila para ir a Órdenes.
- **Pulso al actualizar cifras:** Cuando cambia un número de las tarjetas del resumen o de Sala de control (p. ej. por una OT nueva en tiempo real), la cifra late una vez de forma suave; no anima toda la tarjeta.
- **Pareto de problemas frecuentes** (correctivo) y distribución visual de mantenimiento. La gráfica de dona muestra el total en el centro y desglosa cada tipo con cantidad, porcentaje y barra comparativa; al pasar el cursor, la etiqueta del segmento se muestra al frente sin encimarse con el total central.
- **Filtro de fechas** para el resumen superior (o modo histórico si no hay rango). El selector, las tarjetas y la distribución de mantenimiento están dentro del marco **Resumen por periodo**, indicando claramente qué elementos afecta.
- **Tarjetas de estado:** **Total recibidas** es únicamente informativa y muestra la cifra general con mayor énfasis (no incluye órdenes invalidadas; la tarjeta lo indica con la leyenda «Sin contar invalidadas»). Pendientes, En Proceso, Pausadas, Finalizadas e Invalidadas sí abren **Órdenes de Trabajo** con el filtro correspondiente.
- **Órdenes finalizadas esta semana:** Debajo del resumen, un bloque visible para todos los roles con el total de la semana actual (Lunes a Domingo), gráfica por día y listado de las OT cerradas. Al hacer clic en una fila se abre su detalle.

### Notificaciones (campana)
Al seleccionar una notificación de nueva solicitud, el sistema abre directamente el detalle de esa orden en **Órdenes de Trabajo**.

### Notificaciones del dispositivo (Web Push / PWA)
Avisos del sistema operativo aunque la pestaña esté en segundo plano (nuevas OT y recordatorios/escalamientos SLA). **No sustituyen** la campana ni Telegram: son un canal extra.

- **Cómo activar:** campana (interruptor abajo) o **Configuración → Apariencia → Notificaciones del dispositivo**. El navegador pedirá permiso; hay que **aceptar**.
- **Requisitos:** sitio en **HTTPS** (o localhost). En **iPhone/iPad**: instala la app en Inicio (Compartir → Añadir a pantalla de inicio) e iOS **16.4+**; en Safari sin instalar no hay push.
- **Desactivar:** el mismo interruptor quita la suscripción de ese dispositivo. Sin opt-in no recibirás push.

## 5. Módulo de Órdenes de Trabajo

Gestión de solicitudes (listado), sin el resumen gráfico:
- **Vistas:** Vista General, Mis Órdenes e Historial.
- **Búsqueda y filtros** por estado, fecha, prioridad, equipo, **zona** (barra «Buscar equipo, folio, zona…») y ordenamiento.
- **Acciones rápidas en tarjetas (Admin / Gestionador):** Si la OT no tiene personal, toca **Sin asignar** para abrir el detalle enfocado en **Personal asignado**. El icono de **calendario** (tarjeta o columna Fecha) abre **Calendario** con esa OT lista para agendar. Los técnicos ven las etiquetas solo informativas.
- **Exportar:** botón **Excel** (.xlsx real, lista filtrada), **CSV** y **PDF**/impresión (A4 horizontal compacto: folio, título/equipo, fecha y estado; ~10–15 órdenes por hoja).
- **Foto visible en tarjetas y tabla web:** En celular, tablet y escritorio, las órdenes que incluyen una foto de la solicitud la muestran como un fondo progresivo de izquierda a derecha y un indicador de cámara. Las órdenes sin foto conservan su diseño habitual; selecciona cualquier orden para consultar la evidencia completa.
- **Atrás en celular:** Al abrir el detalle de una orden, el botón o gesto Atrás del teléfono cierra ese detalle y te deja en el listado de Órdenes de Trabajo. Solo vuelve a Inicio si esa era la pantalla anterior (por ejemplo, si entraste desde el resumen).
- **Navegación entre órdenes:** En el detalle, las flechas ← → (o los botones del encabezado) pasan a la orden anterior/siguiente según la lista filtrada y ordenada que estés viendo.
- **Evidencias:** Las fotos Antes/Después se muestran en miniaturas de tamaño fijo; toca una para ampliarla.
- **Actualización Automática:** Si alguien genera una orden desde el *Portal de Solicitantes*, ya no necesitas recargar la página; aparecerá instantáneamente.
- **Aceptar una orden como Administrador o Gestionador:** Abre una orden **Pendiente**, elige **Aceptar orden** en el desplegable de estado y sube la fotografía de evidencia “Antes”. Si no seleccionas ningún técnico, la orden se asignará automáticamente a tu usuario para que puedas atenderla.
- **Ciclo de estado (acciones claras):** Pendiente → **Aceptar y continuar** (pasa a En Proceso). En Proceso → **Pausar** o **Finalizar**. En Espera → **Reanudar**. En móvil, si ya hay foto Antes, al aceptar se guarda solo (sin diálogo extra); si falta, al subirla también se guarda. Puedes deshacer si te equivocaste antes de guardar.
- **Stock crítico:** En **Inventario** la franja rosa lista ítems al mínimo; con permiso de compras puedes **Crear borrador OC desde críticos** (uno por proveedor; omite sin proveedor o ya en OC abierta). En **Inicio** hay tarjeta de stock crítico que lleva al filtro.
- **Órdenes finalizadas:** No se pueden eliminar ni anular. En el detalle, el estado aparece como etiqueta informativa y el personal que intervino se muestra como lista (sin checkboxes). Las fechas/horas de inicio y fin se muestran en hora de planta (**America/Mexico_City**). Si la OT se importó con fecha de finalización, al pasar a Finalizado **no se pisa** esa hora.
- **Asignación opcional al aceptar:** Los Administradores y Gestionadores conservan visible la sección **Personal asignado** mientras la orden está abierta. La lista incluye **Técnicos y Gestionadores** activos. Pueden seleccionar uno o varios antes de guardar; si dejan la lista vacía, se aplica la autoasignación descrita arriba. Lo mismo aplica al crear OT y a **Asignar…** (masivo).
- **Vista para Técnicos:** Los técnicos pueden atender las órdenes que tengan asignadas, pero no pueden modificar la asignación de personal.
- **Interfaz móvil:** Preferencia de cada usuario (Técnico, Gestionador o Administrador) en el menú lateral → **Interfaz móvil**. En celular activa barra inferior (Mis OT, Escanear, Inventario, Inicio) y botones grandes en órdenes. En técnicos está on por defecto; en admin/gestionador hay que activarla.
- **Funciona sin conexión:** Aceptar, pausar, finalizar o reanudar una orden se guarda en el dispositivo aunque no haya señal (Wi-Fi/datos) y se sincroniza solo en cuanto vuelve la conexión. También puedes **editar y enviar el checklist diario** sin señal (crear el checklist del día sí requiere conexión la primera vez). En Inventario, las **salidas (OUT)** se encolan sin señal; las **entradas (IN)** requieren conexión. Al sincronizar bien verás un aviso verde breve («Sincronización completa (N cambios)»); si algo falla, el aviso indica cuántos fallaron y un motivo corto (p. ej. 401, 409, red) con **Reintentar** o **Descartar**. Si el aviso se queda atascado, usa **Descartar** en el propio aviso o **Configuración → Opciones de Desarrollador → Descartar cola offline** (también limpia fotos pendientes en el dispositivo). Las listas (GET) siguen cargando aunque haya cola pendiente. Si finalizas subiendo fotos sin conexión, el estado, las notas y las **fotos** se guardan en el dispositivo y se suben solas al recuperar la señal.
- **Escanear QR en celular:** si entras por `http://IP` (sin HTTPS), el navegador bloquea la cámara en vivo; usa **Elegir foto / galería**. Con HTTPS o localhost la cámara en vivo sí funciona. Al escanear una **ubicación** (p. ej. `E2-0`) o un repuesto, la app abre el detalle correspondiente en Inventario (con los repuestos de esa ubicación). En desarrollo, Vite admite el hostname local `lpet-cmms` y nombres Tailscale `*.ts.net`.
- **Servidor Ubuntu:** checklist en el README («Servidor nuevo»). Primero SSH + `git clone`; luego `./install.sh` (recomienda **S** a PM2 al reiniciar y **nginx + healthcheck**; ufw/Telegram/Tailscale opcionales; genera **VAPID** para notificaciones del dispositivo si faltan). En producción UI+API en **:3000** (`node dist/index.js` vía PM2); con nginx, **puerto 80**. Actualizaciones: `./update.sh` (conserva `.env` y `uploads/`; completa VAPID si faltaba; pregunta nginx solo en modo interactivo).
- **Alertas si el servidor cae:** Con Telegram configurado, un cron externo y una comprobación interna avisan al grupo si la API (PM2) o Postgres no responden (sin spamear: solo al caer y un recordatorio cada varias horas). Detalle en el README.
- **Notificaciones Telegram:** Tanto las órdenes creadas desde **+ Nueva Orden** como las del **Portal de Solicitudes** (`/request`) disparan alerta a Telegram cuando la opción está activada en Configuración. Las alertas de caída del servidor usan el mismo bot/grupo.
- **Opciones de Ordenamiento:**
  En los filtros superiores, puedes elegir cómo organizar tus OTs:
  - `Más recientes primero`: Las órdenes se acomodarán colocando los folios más nuevos en la parte superior.
  - `Más antiguos primero`: Verás los folios más rezagados primero.
  - `Por Prioridad`: Coloca hasta arriba aquellas marcadas como *URGENTES*.

### Portal de Solicitudes (`/request`)
Formulario público para reportar fallas. Es el mismo diseño que **+ Nueva Orden**, con estas diferencias:
- No permite asignar técnicos.
- Permite adjuntar una foto opcional (cámara o galería); no es obligatoria para enviar. En celular la foto se optimiza antes de subirla y, si el navegador se reinicia al abrir la cámara, el formulario recupera el borrador para que no pierdas lo capturado.
- El solicitante se elige de un desplegable; si no aparece tu nombre, elige **Otro (escribir nombre)...** y escríbelo.

## 6. Módulo de Personal (Directorio)

La sección de "Usuarios" se dividió para mayor control:
- **Personal Interno:** Administradores, gestionadores y técnicos que entran con contraseña.
- **Catálogo de Solicitantes:** Aquellos que solo piden mantenimiento vía portal público. 

**Nuevas características:**
- **Buscador rápido:** Escribe un nombre y la lista se reducirá automáticamente.
- **Ocultar/Ver inactivos:** Por defecto, los usuarios dados de baja no estorbarán en la lista. Puedes revelarlos con el botón de "Ver Inactivos" (icono de ojo).
- **Protección de datos:** Ya no es posible eliminar a técnicos o personal si ya tienen órdenes de trabajo o salidas de inventario a su nombre. Para quitarles acceso, solo dales clic y desmarca la casilla "Usuario Activo".

## 7. Configuración de Roles y Permisos

El menú **Configuración** aparece si el rol tiene el permiso **Ver Configuración**:
- **Administrador:** ve todas las secciones (Notificaciones, SLA, Apariencia, Desarrollador, catálogo/UOM y Roles y Permisos según otros permisos).
- **Gestionador** y **Técnico:** solo ven **Apariencia** (tema, notificaciones del dispositivo e interfaz móvil de su cuenta).

Para los administradores, modificar lo que puede hacer cada rol:
- Entra a **Configuración → Roles y Permisos**.
- Enciende o apaga los interruptores según necesites.
- **¡No hay botón de guardar!** El sistema implementa un auto-guardado automático. Un pequeño icono de carga confirmará instantáneamente que los datos se han grabado en el servidor de forma segura.

**Permisos nuevos relevantes:**
- **Ver Árbol de Fallas:** disponible para todos los roles (consulta).
- **Editar Árbol de Fallas:** solo Administrador y Gestionador pueden agregar o activar/desactivar elementos.
- **Ver Configuración:** controla el acceso al módulo; el alcance de pestañas depende del rol (ver arriba).

### Árbol de Fallas (RCA)
- Su jerarquía es **Problema → Causa → Solución**.
- Al finalizar una orden **correctiva**, el RCA es **opcional**: si el caso no está en el catálogo, deja vacío el árbol y cierra con notas/evidencia; Admin/Gestionador pueden ampliar el catálogo después. Así se evita elegir una opción incorrecta solo para poder guardar.
- En celular, selecciona primero el Problema; la pantalla avanzará automáticamente a Causa y luego a Solución.
- La franja superior muestra el paso actual y la ruta elegida. Puedes tocar un paso anterior o usar **Volver al paso anterior** para corregir la selección.
- “Solución” es el nuevo nombre visible del catálogo que internamente conserva compatibilidad con los registros históricos de remedios.

## 8. Módulo KPIs y Metas

Panel de indicadores de mantenimiento:
- **Periodos:** incluye **Esta semana**, **Semana pasada**, mes, año, últimos 12 meses e histórico. Al elegir **Esta semana**, aparece una franja de comparación vs la semana anterior (órdenes, finalizadas, MTTR, SLA, backlog).
- **Salud de planta:** Disponibilidad, MTTR (solo correctivas, en horas) y Backlog (órdenes abiertas ahora).
- **Ejecución:** OT finalizadas del periodo, tiempo de respuesta, cumplimiento de meta MTTR y retrabajo.
- **Ventana de retrabajo:** puedes elegir 3, 7, 14 o 30 días, o escribir un valor personalizado (1–90). Cuenta como retrabajo una correctiva finalizada si el mismo equipo tuvo otra correctiva cerrada dentro de esa ventana.
- **Gráfica MTTR/MTBF:** el eje horizontal son los meses/periodos; el vertical son **horas**. MTTR = tiempo medio de reparación (más bajo mejor); MTBF = tiempo medio entre fallas de flota (más alto mejor). La leyenda aparece arriba para no tapar el eje.
- **Semáforo:** cada tarjeta muestra meta, barra de avance y estado En meta / Cerca / Fuera.
- **Metas:** se configuran en horas, % u órdenes (ya no en milisegundos). Requiere permiso de gestionar KPIs.
- **Exportar Excel:** el botón **Excel** descarga un `.xlsx` del periodo con hojas Resumen, Top fallas, Costos por equipo, Técnicos y Tendencia. **Imprimir** sigue generando la vista para PDF/impresión.
- **Dashboard de técnicos:** complemento operativo a los KPIs de planta. Muestra:
  - **Carga del día:** órdenes abiertas asignadas (pendiente + en proceso + en espera).
  - **OTs pausadas** y **tiempo en espera** acumulado (reloj desde que se pausó la orden).
  - **Productividad semanal** (lunes–domingo): órdenes finalizadas y horas de labor registradas al cerrar.
  - Tabla por técnico (incluye también Fin./Proc./Pend. del periodo seleccionado) y gráfica top 8 de la semana.
- **Calendario (pendientes):** la lista lateral de OT pendientes sin programar requiere el permiso **Administrar Calendario**. En **escritorio** arrastra con el ratón sobre el día/franja; en **tablet/celular** desliza la lista con normalidad, y para agendar arrastra desde el icono **≡** de la tarjeta hacia el día (o franja) y suelta. Toca el texto de la tarjeta para abrirla. En móvil la lista está debajo del calendario. El módulo usa la misma URL del API que el resto del sistema (host del servidor), no `localhost`.
- **Usuarios en línea:** en la barra lateral, el indicador muestra quién está activo y en qué módulo se encuentra (Inicio, Órdenes de Trabajo, Inventario, etc.).
- **Nota:** el gráfico de costos representa **refacciones consumidas**, no el costo total de mantenimiento.

## 8.1 Apariencia y consistencia visual

- **Tema:** en Configuración → Apariencia puedes elegir Modo Claro, Oscuro o Sistema. Ambos temas usan la misma estructura de pantallas.
- **Notificaciones del dispositivo:** en la misma sección puedes activar avisos push del navegador/PWA (nuevas OT y SLA). Detalle en la sección de Inicio → Notificaciones del dispositivo.
- **Acciones principales:** los botones importantes usan verde emerald en todos los módulos.
- **Diseño unificado:** títulos, tarjetas, tablas y ventanas emergentes siguen el mismo patrón industrial en Inicio, Órdenes, Inventario, Activos, KPIs, Compras y demás módulos.
- **Ayudas ⓘ:** donde veas un icono de información al lado de un título o etiqueta, tócalo (tablet/celular) o haz clic (PC) para leer la explicación. Sustituye a los mensajes que en escritorio solo salían al pasar el cursor.

## 9. Módulo de Activos: Código Interno Automático (MTTO)

- **Autoasignación:** Al registrar un nuevo activo (máquina, equipo), el código interno se genera solo con el formato **`MTTO-{NNNN}-{S}-{DDD}-{T}`** (ej. `MTTO-0052-B-001-F`):
  - **NNNN:** número de 4 dígitos compartido por todos los activos con el mismo nombre de equipo (sin importar la zona).
  - **S:** letra A–E si la sección de la zona se llama exactamente A–E; si el activo no tiene sección es **X**.
  - **DDD:** índice de duplicado (001, 002…) para el mismo nombre + misma zona (la sección no reinicia la secuencia). Si solo cambias S o T al editar, se conservan NNNN y DDD.
  - **T:** **F** = Activo fijo, **C** = Controlable.
- **Tipo de activo (obligatorio):** Al crear o editar debes elegir **Activo fijo** o **Controlable**. Ese dato también forma parte del código.
- **Regeneración al editar:** Si cambias nombre, zona, sección o tipo (fijo/controlable), el código se recalcula. Si solo cambias otros campos (marca, precio, etc.), el código se conserva. Los activos antiguos con formato `ACT-XXXX` se mantienen hasta que una edición regenere el código al esquema MTTO.
- **Import CSV (Solicitudes):** Empareja activo por `Equipo:` (nombre) y zona por `Zona:` como siempre. El CSV histórico **no** trae columna de sección: los activos creados por import quedan **sin sección** (`zone_section_id` null, letra **X** en MTTO). No se inventan secciones A–E ni se exigen columnas nuevas. Puedes asignar secciones después desde Activos (detalle → **Información** → **Editar**, o el lápiz de la tabla).
- **Import CSV (Inventario ACTIVOS):** Misma generación MTTO al crear activos nuevos; el Item ID de Fiix **no** se usa como código del activo. Empareje por nombre; al editar después (sección, marca, etc.) el generador sigue las reglas de arriba.
- **Zonas y secciones:** Desde **Activos → Administrar zonas** creas/editas zonas y, si aplica, sus secciones (subzonas). Una zona puede estar en modo **Sin secciones** (activos sin sección). Si la zona tiene secciones, al crear/editar el activo eliges una. En el listado puedes filtrar por zona y, si la zona tiene secciones, también por sección. Los indicadores de líneas paradas en Inicio siguen usando los nombres de zona **L1–L5**.
- **Listado denso:** La tabla/lista de Activos usa filas compactas (como Checklist y Compras); el código MTTO se muestra en una línea (con tooltip si se recorta; el tipo F/C ya va en el código, sin chip aparte). En pantallas estrechas se ocultan columnas de menor prioridad (proveedor, marca, etc.) para evitar scroll horizontal.
- **Paginación:** El listado de Activos muestra **20** registros por página (misma lógica que Inventario → Repuestos). Al filtrar o buscar se vuelve a la página 1.

## 9.1 SLA (Acuerdo de Nivel de Servicio) y Escalamiento de Órdenes

- **Qué mide:** tres relojes por prioridad (URGENTE / NORMAL / BAJO):
  - **Respuesta:** tiempo en estado Pendiente hasta que alguien acepta la orden.
  - **Detenida:** tiempo en En Espera (desde que se pausa).
  - **Resolución:** tiempo desde la creación hasta el cierre.
- **Automatización:** cada 15 minutos el sistema revisa órdenes abiertas. Si se cruza el umbral de recordatorio o de escalamiento, envía aviso a Telegram (mismo grupo), notificaciones in-app y, si el destinatario activó push, notificación del dispositivo. El escalamiento va a roles **Gestionador** y **Administrador**.
- **Sin spam:** cada tipo de aviso (recordatorio/escalamiento × reloj) se envía **una sola vez** por orden. Al arrancar el servidor, el rezago histórico se marca en silencio (sin Telegram). Si en un ciclo aparecen más de 5 avisos nuevos, se envía **un solo resumen** al grupo en lugar de saturar con mensajes individuales.
- **Configuración:** en *Configuración → SLA (Acuerdo de Nivel de Servicio)* puedes activar/desactivar el seguimiento y editar con un formulario (por prioridad Urgente / Normal / Bajo) las horas de recordatorio, máximo y escalamiento. En el listado y detalle de la OT verás el badge **Dentro de SLA / En riesgo / Vencido**.

## 10. Importación masiva por CSV (Opciones de Desarrollador)

- **Acceso:** la contraseña maestra de esta pantalla puede definirse en `backend/.env` (`DEV_MENU_PASSWORD`) **o cambiarse desde la propia interfaz** en la tarjeta **Cambiar contraseña maestra** (pide la contraseña actual, la nueva y su confirmación). Al guardarla queda protegida como hash en la base de datos y tiene prioridad sobre el `.env`; si la base de datos llegara a vaciarse, el `.env` sigue funcionando como respaldo de emergencia. Si fallas la contraseña, **no** se cierra tu sesión de la app: verás un mensaje de error y los intentos restantes (máximo 3). Tras 3 fallos consecutivos el acceso a esta pantalla se bloquea **1 hora** (el bloqueo queda guardado en tu cuenta; un reinicio del servidor no lo borra).
- **Respaldo del servidor (único método):** El botón **Crear respaldo** genera en el servidor un dump comprimido de PostgreSQL (`pg_dump` → `fiix_….sql.gz`) y una copia de `uploads/` (fotos → `uploads_….tar.gz`). Mientras corre, muestra una **barra de progreso** con el paso actual (preparar → BD → fotos → limpieza). Ya **no** existe exportación/importación JSON. El mismo proceso corre automáticamente todos los días a las 2:15 AM y conserva los respaldos de los últimos 14 días. Por defecto guarda en `~/fiix-backups` del usuario del proceso (con PM2 puede no ser tu home: la pantalla muestra la **carpeta actual**). Fija la ruta con `BACKUP_DIR=/home/usuario/fiix-backups` en `backend/.env` si quieres forzarla. Si hay muchas fotos, el empaquetado puede tardar varios minutos. En Windows local necesitas las herramientas de cliente de PostgreSQL (`pg_dump`/`psql`) y `tar`.
- **Restaurar respaldo:** El botón **Restaurar respaldo** lista los `fiix_*.sql.gz` del servidor, pide escribir **RESTAURAR** (esto borra los datos actuales) y vuelve a cargar la BD; opcionalmente restaura también `uploads_*.tar.gz`. Los archivos vacíos o inválidos aparecen marcados como `[VACÍO]` y no se pueden restaurar (hay que crear un respaldo nuevo). Si la restauración falla, el error se muestra en el mismo diálogo y **no** se cierra la sesión; solo tras un éxito confirmado se cierra la sesión y el login muestra un aviso (los usuarios pueden haber cambiado). En Ubuntu también puedes usar `./scripts/restore.sh fiix_YYYYMMDD_HHMM.sql.gz`.
- **Vaciar base de datos:** Tras confirmar con **ELIMINAR**, se vacía la BD, se recrea el admin de emergencia y la app cierra la sesión; en el login verás un aviso con `admin@fiix.com` / `password123` (deberás cambiar la contraseña al entrar). Por defecto también vacía la carpeta `uploads/` (fotos y evidencias); puedes desmarcar «También borrar carpeta uploads (fotos)» si solo quieres borrar registros.
- **Limpiar fotos huérfanas:** En *Herramientas locales*, el botón **Limpiar fotos huérfanas** compara los archivos en `uploads/` con las rutas guardadas en la BD (activos, OT, ítems, etc.) y muestra cuántos no están referenciados. Confirmas escribiendo **LIMPIAR**; solo se borran esos archivos huérfanos (no toca firmas en base64 ni URLs externas de Fiix).
- **Contraseña temporal:** Los usuarios creados por importación CSV (o el seed con `password123`) deben cambiar la contraseña al primer inicio de sesión; aparece un modal que no se puede cerrar hasta guardar una nueva.
- **Distribución de herramientas:** La pantalla separa las acciones por propósito: Importación y respaldos, integración con Telegram, seguridad (contraseña maestra), mantenimiento local y Zona de peligro. Esto ayuda a distinguir las operaciones seguras de las destructivas.
- **Importación manual separada:** La pantalla ofrece dos operaciones independientes. **Inventario:** selecciona juntos sus 6 CSV (Categories, Location, Vendors, Items, Users e Inventory) y opcionalmente `Items_Images.zip`. **Órdenes:** selecciona únicamente `Solicitudes Mantenimiento…csv` y opcionalmente `Formulario Solicitudes_Images.zip`. Es seguro ejecutarlas por separado y en ese orden: ambas usan upsert, actualizan coincidencias y no borran los datos de la otra operación.
- **Comprobar la importación:** Al terminar verás un resumen con conteos (categorías, ubicaciones, proveedores, repuestos, usuarios, movimientos, órdenes, fotos). Contrasta esos números con las filas de cada CSV (menos encabezado). Revisa en la app: Inventario (repuestos/stock), Activos, Órdenes (folios FOL), Directorio. La importación es **upsert** (actualiza lo existente por códigos/folios); no borra datos ajenos al CSV. Antes de reimportar en producción conviene **Crear respaldo**.
- **Activos desde inventario (categoría ACTIVOS):** Tras importar Items, cada ítem cuya categoría sea **Activo / Activos** se crea o actualiza también en el módulo **Activos** (no se borran las filas de inventario). Empareja por **nombre exacto** del ítem. El **Item ID** de Fiix (p. ej. `MTTO-1081`) se queda en inventario; el activo recibe un código **MTTO-NNNN-S-DDD-T** generado por las mismas reglas que el alta manual (`generateAssetInternalCode`; sin sección → letra **X**). La **ubicación** de inventario se mapea a **zona**: `LINEA 1 ACTIVOS`…`LINEA 5 ACTIVOS` → `L1`…`L5`; `TAPANCO` → `TAPANCO`. Otras ubicaciones (p. ej. `TALLER`) se usan como nombre de zona. **Sin sección** en el CSV → `zone_section_id` null. Si subes el zip de fotos de repuestos (`Items_Images`), las fotos de ítems ACTIVOS se copian también a `uploads/assets/` y se ligan al activo (misma coincidencia por Item ID). Reimportar actualiza zona/datos del activo coincidente; **no** elimina activos viejos solo de Solicitudes — revisa duplicados a mano. En el detalle del activo (pestaña **Información**) hay **Editar** (mismo formulario que la tabla) para completar marca, modelo, sección, etc.
- **Órdenes (Solicitudes Mantenimiento):** Por cada fila se resuelve la zona (`Zona:`) y el equipo (`Equipo:`) por nombre, igual que antes. **No hay columna de sección** en el CSV histórico: los activos nuevos se crean **sin sección**. Las OT se enlazan al activo encontrado o creado; el enlace OT↔activo no depende de sección. Si el nombre del equipo coincide con un activo ya importado desde inventario ACTIVOS, se reutiliza ese registro.
- **Fechas del CSV (día/mes/año):** Las columnas de fecha de Fiix (`DateTime` en Inventario, `Marca temporal` / `FECHA INICIO` / etc. en Solicitudes) usan formato europeo `dd/mm/yyyy` (ej. `05/07/2026` = 5 de julio). El importador las interpreta así (no como mes/día estadounidense) y la pantalla de movimientos las muestra en formato México.
- **Fechas en pantalla y exportaciones:** Las fechas visibles (órdenes, OC, preventivos, PDF, CSV) usan formato México (`dd/mm/aaaa`). La **fecha esperada** de una Orden de Compra y las fechas del roster se tratan como día de calendario (no se adelantan/atrasan por zona horaria UTC).
- **Fotos de repuestos:** En la sección **Inventario**, elige primero `Items_Images.zip` y después pulsa **Importar inventario (6 CSV + zip)**. El zip suele contener una carpeta `Items_Images/` con archivos `{Item ID}.Image.{HHMMSS}.{ext}`, p. ej. `MTTO-0001.Image.163526.png` (coincide con el `Item ID` / `internal_code` del CSV). Extensiones: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`. Tras crear/actualizar los ítems el sistema descomprime el zip en un temporal, empareja por Item ID, copia cada foto a `uploads/inventory/` (mismo formato que la subida manual) y muestra «Fotos asignadas: N». Si el ítem es categoría **ACTIVOS** y ya existe el activo (mismo nombre), la foto se copia también a `uploads/assets/` y se actualiza la imagen del activo. Si no seleccionas zip, el servidor intenta `data/Items_Images/` (útil tras SCP/rsync por Tailscale). Si faltan fotos, la importación CSV no se ve afectada. Límite ~500 MB **por zip** (multer); nginx en Ubuntu debe tener `client_max_body_size 1100M` y timeouts largos (`client_body_timeout 120m`, `proxy_read_timeout 120m` en `deploy/nginx-fiix.conf`). Si falla con *Network Error*, *413* o *408*: aplica/recarga esa conf, entra por `http://HOST:3000` (sin nginx), o copia la carpeta a `data/` e importa solo CSV. Un export típico ronda ~170 MB y ~2000 fotos.
- **Fotos de órdenes (antes/después):** En la sección **Órdenes**, elige `Formulario Solicitudes_Images.zip` y después pulsa **Importar órdenes (1 CSV + zip)** seleccionando únicamente el CSV de Solicitudes. Como alternativa, deja la carpeta descomprimida en `data/Formulario Solicitudes_Images/` en el servidor. El CSV trae rutas en **FOTO ANTES** y **FOTO DESPUÉS** ligadas al **FOLIO**. **FOTO ANTES** = evidencia del técnico al atender (no la foto al levantar la solicitud); **FOTO DESPUÉS** = evidencia al finalizar. Se copian a `uploads/` como `before_image_url` / `after_image_url`. Las firmas del zip (`FIRMA CONFORMIDAD`, `FIRMA AREA LIMPIA`) **no** se importan. Si alguna celda dice «Unable to load…» o el archivo no está en el zip/carpeta, esa foto se omite sin tumbar la importación.
- **Workaround Tailscale (408):** Preferible `http://HOST:3000` para subir zips, o SCP/rsync de las carpetas a `~/fiix-cmms/data/` y luego importar solo los CSV desde Opciones de Desarrollador. Verifica nginx con `grep -E 'client_max_body_size|client_body_timeout|proxy_read_timeout' /etc/nginx/sites-available/fiix` (debe verse `1100M` y `120m`, no vacío/`1m`/`60s`).
- **Usuarios de inventario:** Si un movimiento de inventario referencia un correo que no está en el archivo de Usuarios, ese usuario se crea automáticamente como **inactivo** (rol Técnico) para no perder el historial de consumos. Luego puedes activarlo o completarlo desde el Directorio.
- **Tiempos de reparación:** Los valores de tiempo con coma de miles (por ejemplo `2,140.22` minutos) se interpretan correctamente, de modo que el MTTR y demás métricas de tiempo no se distorsionan.
- **Importar ahora desde Google Sheets (Fase 1, modo temporal):** En la misma pantalla hay un botón que lee las **7 pestañas** ya mapeadas (Categories, Location, Vendors, Items, Users, Inventory y Formulario Solicitudes) desde dos spreadsheets de Google y usa el **mismo motor** que los CSV (mismos conteos y orden). No sustituye el import CSV+zip; lo complementa. Con la casilla **Fotos desde Google Drive** activada (y `GOOGLE_DRIVE_*` en el servidor), también descarga las carpetas públicas de fotos; si no, usa zip o `data/` como antes.
  - **Acceso (temporal, sin Google Cloud):** Pon **ambos** spreadsheets en **Compartir → Cualquier persona con el enlace → Lector**. El servidor descarga cada pestaña como CSV público (`/export?format=csv&gid=…`). No hace falta cuenta de servicio ni JSON en `.env`.
  - **IDs opcionales:** `GOOGLE_SHEETS_INVENTORY_ID` y `GOOGLE_SHEETS_ORDERS_ID` en `backend/.env` (hay valores por defecto GTZ).
  - **Seguridad:** Mientras estén públicos, cualquiera con el link puede ver inventario, usuarios y OT. Cuando dejes de usar este modo, vuelve a restringir el acceso (solo personas concretas).
  - **Fotos:** Con **Fotos desde Google Drive** activa, baja las carpetas `GOOGLE_DRIVE_*`; si está apagada, usa `data/Items_Images/` o `data/Formulario Solicitudes_Images/` cuando existan.
  - **Pendiente:** actualización automática periódica y (opcional) volver a cuenta de servicio sin Sheets públicos.

## 11. Vincular Telegram (Bot Token y Chat ID)

Las alertas de nuevas solicitudes usan un **Bot Token** y un **Chat ID** de grupo. Se configuran en *Configuración → Opciones de Desarrollador* (tienen prioridad sobre el `.env`).

### Si es la primera vez
1. En Telegram habla con **@BotFather** → `/newbot` → copia el **Bot Token**.
2. Crea un grupo (ej. “MTTO Alertas”), agrega a tu equipo y **añade el bot** al grupo.
3. Obtén el **Chat ID** (número negativo):
   - Agrega temporalmente **@RawDataBot** o **@userinfobot** al grupo y copia `chat.id`, o
   - Envía un mensaje al grupo y abre `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` buscando `"chat":{"id": ...}`.
4. Pega Token y Chat ID en CMMS → Guardar → activa “Alertas por Telegram” en Notificaciones.
5. Prueba creando una orden o solicitud.
6. (Opcional, servidor Ubuntu) Con el healthcheck instalado, esas mismas credenciales sirven para avisos *«GTZ: servidor caído…»* / *«Postgres no responde»*. Conviene dejar también `TELEGRAM_*` en `backend/.env` para que el script externo pueda avisar aunque la API esté apagada.

### Si ya lo tenían y olvidaron las claves
- **Token:** @BotFather → `/mybots` → tu bot → *API Token* → *Show token* (o *Revoke* si se filtró, y actualiza CMMS).
- **Chat ID:** no recrees el grupo; con el bot dentro, usa de nuevo el bot de info o `getUpdates`. El ID del grupo no cambia.
- Si el bot salió del grupo, vuelve a agregarlo y consulta el Chat ID otra vez.

---
*Para soporte técnico adicional, revisa la sección de ayuda dentro del sistema.*
