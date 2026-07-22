# Manual de Usuario - FIIX CMMS (LPET)
*(Versión 1.30.5 - 21 de Julio, 2026)*

FIIX CMMS (despliegue LPET) centraliza el ciclo completo del mantenimiento: reportar una necesidad, asignar responsables, documentar tiempos y refacciones, cerrar con evidencia y convertir el historial en indicadores para tomar decisiones.

Sus pilares son **Rapidez** (menos formatos y pasos), **Trazabilidad** (responsables, fechas, firmas, consumos y evidencias) y **Control** (permisos por rol y protección de acciones críticas). El flujo recomendado es:
1. **Reportar** la solicitud con activo, zona, descripción y prioridad.
2. **Asignar** técnicos y comenzar el seguimiento.
3. **Ejecutar** el trabajo, registrando tiempos, pausas, consumos y solución.
4. **Comprobar** el cierre mediante evidencia; la información alimenta historial y KPIs.

En celular, el temario del manual aparece como una barra horizontal deslizable. Toca un tema para mostrarlo debajo con una transición de entrada de derecha a izquierda. El encabezado, el temario y el botón **Volver** permanecen fijos; únicamente se desplaza la información del tema hasta el borde inferior, con un degradado superior que aparece progresivamente.

## 0. Operación diaria
- **Tiempo real:** Los listados y catálogos se actualizan casi al momento cuando otro usuario crea, edita o elimina datos (órdenes, inventario, activos, compras, checklist, turnos, RCA, zonas, usuarios, etc.). No hace falta pulsar F5.
- **Edición concurrente de OT:** Si abres una orden de trabajo, eres el editor. Quien abra la misma orden después la verá en **solo lectura** con el mensaje «En edición por {nombre}». Al cerrar el detalle (o si se pierde la conexión ~40 s), otro puede tomarla. Si dos intentan aceptar la misma orden a la vez, el segundo recibe un aviso de conflicto y debe recargar.
- **Folios FOL-####:** Cada orden recibe un folio automático e inmutable (`FOL-0001`, `FOL-0002`…). No se edita. En importación CSV se usa la columna `FOLIO` (acepta `FOL-####` o el número).
- **Códigos de refacciones MTTO-####:** Ya se generan así al crear el repuesto y el código queda bloqueado (no editable).
- **Consumo de refacciones desde la OT:** Al finalizar una orden, en «Repuestos a descontar del almacén» agrega las piezas usadas. El sistema valida stock, descuenta en una sola operación y liga el movimiento a esa OT. En el detalle de una OT finalizada verás los repuestos consumidos y el **costo de refacciones** de esa orden.
- **Historial del activo de un vistazo:** Al abrir un activo (o escanear su QR) la pestaña **De un vistazo** muestra últimas OTs, fallas RCA frecuentes, PMs próximos/vencidos, stock crítico de repuestos del plan y costo acumulado (valor del activo + refacciones). Pasa el puntero sobre las etiquetas (icono ?) para ver la definición de RCA, PM y stock crítico.
- **Búsqueda global (Ctrl/Cmd+K):** Desde cualquier pantalla abre el buscador único para activos, repuestos, ubicaciones y folios FOL. En celular usa el icono de lupa en la barra superior.
- **Impresión masiva de QR:** En **Activos**, Inventario → **Repuestos** o Inventario → **Ubicaciones**, usa **QR masivo**, selecciona registros (incluidos todos los filtrados) e imprime una hoja con las etiquetas.
- **Detalle compacto de OT:** La ventana de detalle aprovecha mejor el ancho de pantalla, muestra campos en columnas, permite que nombres y textos largos ocupen varias líneas y presenta las fotografías completas sin recortarlas.
- **Borrador de compra desde Stock Crítico:** En Inventario, la tarjeta superior muestra cuántos ítems están bajo mínimo. Un clic filtra la lista; con permiso de compras, **Generar borrador OC** crea Órdenes de Compra en estado Borrador (una por proveedor, cantidad = lo faltante para llegar al mínimo). Los ítems sin proveedor se omiten y se listan en el aviso. Revisa y avanza el flujo en **Órdenes de Compra**.

## 1. Módulo Checklist: Campos Numéricos y de Texto
Las actividades del Checklist ahora son más flexibles:
- **Tipo por tarea (Catálogo):** En Configuración → Catálogo de Checklist, cada pregunta tiene un selector **Check / Número / Texto**. Check usa OK/Falla/N/A; Número y Texto muestran un campo para capturar lecturas. El cambio aplica a los checklists nuevos.
- **Columnas / máquinas:** En el mismo catálogo, el campo **Columnas** define cuántas líneas (L1, L2…) tendrá el formulario (1 a 12). Si agregas una máquina, aumenta el número; el siguiente checklist diario ya mostrará la columna nueva. Los checklists ya creados conservan el número con el que se generaron.
- **Campos Mixtos:** Además de los clásicos checks (✔️/❌), algunas actividades específicas (como temperatura o lecturas de agua) mostrarán un pequeño campo de texto.
- **Uso:** Simplemente haz clic en la línea correspondiente y teclea el valor numérico (ej. 45.5) o un texto corto. El sistema guardará la información tal como si fuese un check tradicional.
- **Configuración:** Para restaurar el listado estándar (con temperaturas en Número y lecturas de agua en Texto), ve a Configuración → Catálogo de Checklist y pulsa **"Restaurar por Defecto"**.

## 2. Módulo Inventario: Mejoras y Restricciones
Se han mejorado las reglas del almacén para prevenir errores y mejorar la fluidez:
- **Cantidades Flexibles (Decimales y Enteros):** Al registrar movimientos o editar stock, ahora puedes registrar cantidades decimales (ej. 0.5 litros o metros) tecleando el valor. Por otro lado, usar los botones (+/-) ajustará la cantidad de 1 en 1 (enteros).
- **Acceso Ágil para Técnicos:** El botón "Registrar Movimiento" se encuentra disponible directamente en la vista principal de Repuestos, sin necesidad de cambiar a la pestaña de historial.
- **Guardado Silencioso:** Los registros de movimientos, así como las creaciones de repuestos, ahora se sincronizan en segundo plano sin mostrar pantallas de carga molestas.
- **Validación de Stock Mínimo:** El sistema ya no permite configurar un stock mínimo igual a 0.
- **Bloqueo de Inventario Negativo:** Si intentas sacar más piezas de las que existen actualmente, el sistema bloqueará la operación con una alerta.
- **Ubicación Automática:** Si creas un nuevo repuesto o importas un CSV sin definir lugar, el sistema lo agrupará bajo la ubicación "Sin Asignación".
- **Ver Detalle desde Categorías, Ubicaciones y Proveedores:** Al abrir el detalle de una Categoría, Ubicación o Proveedor, la lista de "Repuestos Asociados" ahora es clickeable: selecciona cualquier repuesto de esa lista para abrir su ficha completa de detalle, igual que si lo hubieras abierto desde la pestaña de "Repuestos".
- **Navegar entre repuestos:** Con la ficha de un repuesto abierta (desde la lista de Inventario), usa las flechas ← → del teclado o los botones del encabezado para pasar al anterior/siguiente según el filtro y orden actuales. Mientras editas un campo de texto las flechas no cambian de ítem.
- **Búsqueda y QR en Ubicaciones:** La pestaña "Ubicaciones" ahora tiene barra de búsqueda (por nombre o código) y botón de escaneo QR, igual que la pestaña de Repuestos. Cada tarjeta de ubicación incluye un botón "Ver / Imprimir QR" para generar el código de esa ubicación física; al escanearlo se abre automáticamente el detalle con todos los repuestos que contiene.
- **Stock Crítico accionable:** La tarjeta superior indica la cantidad de ítems bajo mínimo. Haz clic en ella para filtrar la lista (puedes quitar el filtro con la pastilla). Con permiso **Gestionar compras**, usa **Generar borrador OC** para crear borradores de Orden de Compra agrupados por proveedor. Ya no hace falta el filtro duplicado junto a la búsqueda ni descargar una lista .txt.

## 3. Módulo Calendario (Roster)
- **Corrección de Incidencias:** Se ha resuelto el problema que impedía guardar incidencias como (Falta, TXT, Vacaciones, etc.). Ahora basta con elegir la incidencia de la lista desplegable en el día del empleado y el sistema guardará la excepción inmediatamente.

## 4. Módulo Inicio

Pantalla de resumen operativo (antes mezclada con el listado de órdenes). Es la pantalla de entrada al abrir el sistema en una sesión nueva.
- **Pareto de problemas frecuentes** (correctivo) y distribución visual de mantenimiento. La gráfica de dona muestra el total en el centro y desglosa cada tipo con cantidad, porcentaje y barra comparativa.
- **Filtro de fechas** para el resumen superior (o modo histórico si no hay rango). El selector, las tarjetas y la distribución de mantenimiento están dentro del marco **Resumen por periodo**, indicando claramente qué elementos afecta.
- **Tarjetas de estado:** **Total recibidas** es únicamente informativa y muestra la cifra general con mayor énfasis. Pendientes, En Proceso, Pausadas, Finalizadas e Invalidadas sí abren **Órdenes de Trabajo** con el filtro correspondiente.
- **Órdenes finalizadas esta semana:** Debajo del resumen, un bloque visible para todos los roles con el total de la semana actual (Lunes a Domingo), gráfica por día y listado de las OT cerradas. Al hacer clic en una fila se abre su detalle.

### Notificaciones (campana)
Al seleccionar una notificación de nueva solicitud, el sistema abre directamente el detalle de esa orden en **Órdenes de Trabajo**.

## 5. Módulo de Órdenes de Trabajo

Gestión de solicitudes (listado), sin el resumen gráfico:
- **Vistas:** Vista General, Mis Órdenes e Historial.
- **Búsqueda y filtros** por estado, fecha, prioridad, equipo y ordenamiento.
- **Foto visible en tarjetas y tabla web:** En celular, tablet y escritorio, las órdenes que incluyen una foto de la solicitud la muestran como un fondo progresivo de izquierda a derecha y un indicador de cámara. Las órdenes sin foto conservan su diseño habitual; selecciona cualquier orden para consultar la evidencia completa.
- **Atrás en celular:** Al abrir el detalle de una orden, el botón o gesto Atrás del teléfono cierra ese detalle y te deja en el listado de Órdenes de Trabajo. Solo vuelve a Inicio si esa era la pantalla anterior (por ejemplo, si entraste desde el resumen).
- **Actualización Automática:** Si alguien genera una orden desde el *Portal de Solicitantes*, ya no necesitas recargar la página; aparecerá instantáneamente.
- **Aceptar una orden como Administrador o Gestionador:** Abre una orden **Pendiente**, elige **Aceptar orden** en el desplegable de estado y sube la fotografía de evidencia “Antes”. Si no seleccionas ningún técnico, la orden se asignará automáticamente a tu usuario para que puedas atenderla.
- **Ciclo de estado (acciones claras):** Pendiente → **Aceptar orden** (pasa a En Proceso). En Proceso → **Pausar** o **Finalizar**. En Espera → **Reanudar**.
- **Órdenes finalizadas:** No se pueden eliminar ni anular. En el detalle, el estado aparece como etiqueta informativa y los técnicos se muestran como lista de quienes intervinieron (sin checkboxes).
- **Asignación opcional al aceptar:** Los Administradores y Gestionadores conservan visible la sección **Técnicos Asignados** mientras la orden está abierta. Pueden seleccionar uno o varios técnicos antes de guardar; si dejan la lista vacía, se aplica la autoasignación descrita arriba.
- **Vista para Técnicos:** Los técnicos pueden atender las órdenes que tengan asignadas, pero no pueden modificar la asignación de personal.
- **Capa móvil de técnico:** En celular, el rol Técnico ve una barra inferior con **Mis OT**, Escanear QR, Inventario e Inicio. **Mis OT** abre todas tus órdenes abiertas asignadas (pendientes, en proceso y en espera). Al abrir una orden aparecen botones grandes de Aceptar / Pausar / Finalizar / Reanudar; completa evidencias y guarda. Administradores y gestionadores siguen con la interfaz completa (también en celular).
- **Funciona sin conexión:** Aceptar, pausar, finalizar o reanudar una orden se guarda en el dispositivo aunque no haya señal (Wi-Fi/datos) y se sincroniza solo en cuanto vuelve la conexión. Al sincronizar bien verás un aviso verde breve («Sincronización completa (N cambios)»); si algo falla, el aviso indica cuántos fallaron y un motivo corto (p. ej. 401, 409, red) con **Reintentar** o **Descartar**. Si el aviso se queda atascado, usa **Descartar** en el propio aviso o **Configuración → Opciones de Desarrollador → Descartar cola offline**. Las listas (GET) siguen cargando aunque haya cola pendiente. Si intentas finalizar subiendo fotos sin conexión, el sistema guarda el estado y las notas, pero pide volver a intentarlo con señal para adjuntar las imágenes.
- **Escanear QR en celular:** si entras por `http://IP` (sin HTTPS), el navegador bloquea la cámara en vivo; usa **Elegir foto / galería**. Con HTTPS o localhost la cámara en vivo sí funciona. Al escanear una **ubicación** (p. ej. `E2-0`) o un repuesto, la app abre el detalle correspondiente en Inventario (con los repuestos de esa ubicación). En desarrollo, Vite admite el hostname local `lpet-cmms` y nombres Tailscale `*.ts.net`.
- **Servidor Ubuntu:** primero SSH + `git clone` (README); luego `./install.sh` (al final pregunta PM2 startup, ufw, Telegram, **nginx + healthcheck** y Tailscale). En producción la UI y la API comparten el puerto **:3000**; con nginx opcional entras por el **puerto 80** (`http://lpet-cmms`) sin escribir `:3000`. Actualizaciones: `./update.sh` (no modifica nginx).
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

El módulo **Configuración** está disponible para **Administrador** y **Gestionador**. Los Técnicos no lo ven en el menú.

Para los administradores, modificar lo que puede hacer cada usuario es ahora más simple:
- Entra a **Configuración → Roles y Permisos**.
- Enciende o apaga los interruptores según necesites.
- **¡No hay botón de guardar!** El sistema implementa un auto-guardado automático. Un pequeño icono de carga confirmará instantáneamente que los datos se han grabado en el servidor de forma segura.

**Permisos nuevos relevantes:**
- **Ver Árbol de Fallas:** disponible para todos los roles (consulta).
- **Editar Árbol de Fallas:** solo Administrador y Gestionador pueden agregar o activar/desactivar elementos.
- **Ver Configuración:** disponible para Administrador y Gestionador.

### Árbol de Fallas (RCA)
- Su jerarquía es **Problema → Causa → Solución**.
- Al finalizar una orden **correctiva**, el RCA es **opcional**: si el caso no está en el catálogo, deja vacío el árbol y cierra con notas/evidencia; Admin/Gestionador pueden ampliar el catálogo después. Así se evita elegir una opción incorrecta solo para poder guardar.
- En celular, selecciona primero el Problema; la pantalla avanzará automáticamente a Causa y luego a Solución.
- La franja superior muestra el paso actual y la ruta elegida. Puedes tocar un paso anterior o usar **Volver al paso anterior** para corregir la selección.
- “Solución” es el nuevo nombre visible del catálogo que internamente conserva compatibilidad con los registros históricos de remedios.

## 8. Módulo KPIs y Metas

Panel de indicadores de mantenimiento:
- **Salud de planta:** Disponibilidad, MTTR (solo correctivas, en horas) y Backlog (órdenes abiertas ahora).
- **Ejecución:** OT finalizadas del periodo, tiempo de respuesta, cumplimiento de meta MTTR y retrabajo.
- **Ventana de retrabajo:** puedes elegir 3, 7, 14 o 30 días, o escribir un valor personalizado (1–90). Cuenta como retrabajo una correctiva finalizada si el mismo equipo tuvo otra correctiva cerrada dentro de esa ventana.
- **Gráfica MTTR/MTBF:** el eje horizontal son los meses/periodos; el vertical son **horas**. MTTR = tiempo medio de reparación (más bajo mejor); MTBF = tiempo medio entre fallas de flota (más alto mejor). La leyenda aparece arriba para no tapar el eje.
- **Semáforo:** cada tarjeta muestra meta, barra de avance y estado En meta / Cerca / Fuera.
- **Metas:** se configuran en horas, % u órdenes (ya no en milisegundos). Requiere permiso de gestionar KPIs.
- **Dashboard de técnicos:** complemento operativo a los KPIs de planta. Muestra:
  - **Carga del día:** órdenes abiertas asignadas (pendiente + en proceso + en espera).
  - **OTs pausadas** y **tiempo en espera** acumulado (reloj desde que se pausó la orden).
  - **Productividad semanal** (lunes–domingo): órdenes finalizadas y horas de labor registradas al cerrar.
  - Tabla por técnico (incluye también Fin./Proc./Pend. del periodo seleccionado) y gráfica top 8 de la semana.
- **Calendario (pendientes):** la lista lateral de OT pendientes sin programar requiere el permiso **Administrar Calendario**. El módulo usa la misma URL del API que el resto del sistema (host del servidor), no `localhost`.
- **Nota:** el gráfico de costos representa **refacciones consumidas**, no el costo total de mantenimiento.

## 8.1 Apariencia y consistencia visual

- **Tema:** en Configuración → Apariencia puedes elegir Modo Claro, Oscuro o Sistema. Ambos temas usan la misma estructura de pantallas.
- **Acciones principales:** los botones importantes usan verde emerald en todos los módulos.
- **Diseño unificado:** títulos, tarjetas, tablas y ventanas emergentes siguen el mismo patrón industrial en Inicio, Órdenes, Inventario, Activos, KPIs, Compras y demás módulos.

## 9. Módulo de Activos: Código Interno Automático e Inmutable

- **Autoasignación:** Al registrar un nuevo activo (máquina, equipo), ya no se escribe el "Código Interno" manualmente. El sistema lo genera solo, de forma incremental, con el formato **ACT-0001, ACT-0002, ACT-0003...**
- **Inmutable:** Una vez creado el activo, ese código ya no puede editarse ni desde el formulario de edición ni por ningún otro medio. Esto garantiza que la numeración de la planta sea siempre única y trazable, evitando duplicados o cambios accidentales.
- **Migraciones de datos:** Cualquier importación o migración masiva de activos (histórica o futura) asigna este mismo formato de código automáticamente.

## 9.1 SLA (Acuerdo de Nivel de Servicio) y Escalamiento de Órdenes

- **Qué mide:** tres relojes por prioridad (URGENTE / NORMAL / BAJO):
  - **Respuesta:** tiempo en estado Pendiente hasta que alguien acepta la orden.
  - **Detenida:** tiempo en En Espera (desde que se pausa).
  - **Resolución:** tiempo desde la creación hasta el cierre.
- **Automatización:** cada 15 minutos el sistema revisa órdenes abiertas. Si se cruza el umbral de recordatorio o de escalamiento, envía aviso a Telegram (mismo grupo) y notificaciones in-app. El escalamiento va a roles **Gestionador** y **Administrador**.
- **Sin spam:** cada tipo de aviso (recordatorio/escalamiento × reloj) se envía **una sola vez** por orden. Al arrancar el servidor, el rezago histórico se marca en silencio (sin Telegram). Si en un ciclo aparecen más de 5 avisos nuevos, se envía **un solo resumen** al grupo en lugar de saturar con mensajes individuales.
- **Configuración:** en *Configuración → SLA (Acuerdo de Nivel de Servicio)* puedes activar/desactivar el seguimiento y editar con un formulario (por prioridad Urgente / Normal / Bajo) las horas de recordatorio, máximo y escalamiento. En el listado y detalle de la OT verás el badge **Dentro de SLA / En riesgo / Vencido**.

## 10. Importación masiva por CSV (Opciones de Desarrollador)

- **Acceso:** la contraseña maestra de esta pantalla puede definirse en `backend/.env` (`DEV_MENU_PASSWORD`) **o cambiarse desde la propia interfaz** en la tarjeta **Cambiar contraseña maestra** (pide la contraseña actual, la nueva y su confirmación). Al guardarla queda protegida como hash en la base de datos y tiene prioridad sobre el `.env`; si la base de datos llegara a vaciarse, el `.env` sigue funcionando como respaldo de emergencia.
- **Respaldo del servidor (único método):** El botón **Crear respaldo** genera en el servidor un dump comprimido de PostgreSQL (`pg_dump`) y una copia de `uploads/` (fotos, firmas, evidencias). Ya **no** existe exportación/importación JSON. El mismo proceso corre automáticamente todos los días a las 2:15 AM y conserva los respaldos de los últimos 14 días. Por defecto guarda en `~/fiix-backups` (en Windows: `%USERPROFILE%\fiix-backups`). En el servidor Ubuntu no hace falta nada extra; en Windows local necesitas las herramientas de cliente de PostgreSQL (`pg_dump`/`psql`) y `tar`.
- **Restaurar respaldo:** El botón **Restaurar respaldo** lista los `fiix_*.sql.gz` del servidor, pide escribir **RESTAURAR** (esto borra los datos actuales) y vuelve a cargar la BD; opcionalmente restaura también `uploads_*.tar.gz`. Los archivos vacíos o inválidos aparecen marcados como `[VACÍO]` y no se pueden restaurar (hay que crear un respaldo nuevo). Si la restauración falla, el error se muestra en el mismo diálogo y **no** se cierra la sesión; solo tras un éxito confirmado se cierra la sesión y el login muestra un aviso (los usuarios pueden haber cambiado). En Ubuntu también puedes usar `./scripts/restore.sh fiix_YYYYMMDD_HHMM.sql.gz`.
- **Vaciar base de datos:** Tras confirmar con **ELIMINAR**, se vacía la BD, se recrea el admin de emergencia y la app cierra la sesión; en el login verás un aviso con `admin@fiix.com` / `password123` (deberás cambiar la contraseña al entrar).
- **Contraseña temporal:** Los usuarios creados por importación CSV (o el seed con `password123`) deben cambiar la contraseña al primer inicio de sesión; aparece un modal que no se puede cerrar hasta guardar una nueva.
- **Distribución de herramientas:** La pantalla separa las acciones por propósito: Importación y respaldos, integración con Telegram, seguridad (contraseña maestra), mantenimiento local y Zona de peligro. Esto ayuda a distinguir las operaciones seguras de las destructivas.
- **Selección conjunta:** Puedes seleccionar los 7 archivos CSV a la vez; no importa el orden en que los elijas. El sistema los reconoce por su nombre y los carga siempre en el orden correcto (Categorías → Ubicaciones → Proveedores → Items → Usuarios → Inventario → Órdenes de Trabajo) para respetar las dependencias entre tablas.
- **Fotos de repuestos:** Opcionalmente, antes de pulsar **Seleccionar los CSV**, elige un archivo **.zip** con las fotos del export Fiix (desde tu laptop; no hace falta subir la carpeta al servidor por SSH). El zip suele contener una carpeta `Items_Images/` con archivos `{Item ID}.Image.{HHMMSS}.{ext}`, p. ej. `MTTO-0001.Image.163526.png` (coincide con el `Item ID` / `internal_code` del CSV). Extensiones: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`. Tras crear/actualizar los ítems el sistema descomprime el zip en un temporal, empareja por Item ID, copia cada foto a `uploads/inventory/` (mismo formato que la subida manual) y muestra «Fotos asignadas: N». Si no seleccionas zip o faltan fotos, la importación CSV no se ve afectada. Límite práctico ~500 MB (nginx `client_max_body_size` y multer); un export típico ronda ~170 MB y ~2000 fotos.
- **Fotos de órdenes (antes/después):** Igual que los repuestos, puedes seleccionar `Formulario Solicitudes_Images.zip`. El CSV trae rutas en **FOTO ANTES** y **FOTO DESPUÉS** ligadas al **FOLIO**; el sistema copia esas imágenes a `uploads/` y las guarda en la OT (`before_image_url` / `after_image_url`). Las firmas del zip (`FIRMA CONFORMIDAD`, `FIRMA AREA LIMPIA`) **no** se importan. Si alguna celda dice «Unable to load…» o el archivo no está en el zip, esa foto se omite sin tumbar la importación.
- **Usuarios de inventario:** Si un movimiento de inventario referencia un correo que no está en el archivo de Usuarios, ese usuario se crea automáticamente como **inactivo** (rol Técnico) para no perder el historial de consumos. Luego puedes activarlo o completarlo desde el Directorio.
- **Tiempos de reparación:** Los valores de tiempo con coma de miles (por ejemplo `2,140.22` minutos) se interpretan correctamente, de modo que el MTTR y demás métricas de tiempo no se distorsionan.

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
6. (Opcional, servidor Ubuntu) Con el healthcheck instalado, esas mismas credenciales sirven para avisos *«FIIX: servidor caído…»* / *«Postgres no responde»*. Conviene dejar también `TELEGRAM_*` en `backend/.env` para que el script externo pueda avisar aunque la API esté apagada.

### Si ya lo tenían y olvidaron las claves
- **Token:** @BotFather → `/mybots` → tu bot → *API Token* → *Show token* (o *Revoke* si se filtró, y actualiza CMMS).
- **Chat ID:** no recrees el grupo; con el bot dentro, usa de nuevo el bot de info o `getUpdates`. El ID del grupo no cambia.
- Si el bot salió del grupo, vuelve a agregarlo y consulta el Chat ID otra vez.

---
*Para soporte técnico adicional, revisa la sección de ayuda dentro del sistema.*
