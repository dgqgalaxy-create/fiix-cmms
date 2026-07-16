# Manual de Usuario - LPET CMMS
*(Versión 1.11.0 - 16 de Julio, 2026)*

Bienvenido al manual de uso rápido del Sistema de Gestión de Mantenimiento Computarizado (CMMS). A continuación, te explicamos cómo utilizar las principales funciones agregadas recientemente.

## 1. Módulo Checklist: Campos Numéricos y de Texto
Las actividades del Checklist ahora son más flexibles:
- **Campos Mixtos:** Además de los clásicos checks (✔️/❌), algunas actividades específicas (como temperatura o lecturas de agua) mostrarán un pequeño campo de texto.
- **Uso:** Simplemente haz clic en la línea correspondiente y teclea el valor numérico (ej. 45.5) o un texto corto. El sistema guardará la información tal como si fuese un check tradicional.
- **Configuración:** Para que estos campos aparezcan, asegúrate de ir a las *Opciones de Desarrollador* en el menú y hacer clic en **"Restaurar Actividades por Defecto"**.

## 2. Módulo Inventario: Mejoras y Restricciones
Se han mejorado las reglas del almacén para prevenir errores y mejorar la fluidez:
- **Cantidades Flexibles (Decimales y Enteros):** Al registrar movimientos o editar stock, ahora puedes registrar cantidades decimales (ej. 0.5 litros o metros) tecleando el valor. Por otro lado, usar los botones (+/-) ajustará la cantidad de 1 en 1 (enteros).
- **Acceso Ágil para Técnicos:** El botón "Registrar Movimiento" se encuentra disponible directamente en la vista principal de Repuestos, sin necesidad de cambiar a la pestaña de historial.
- **Guardado Silencioso:** Los registros de movimientos, así como las creaciones de repuestos, ahora se sincronizan en segundo plano sin mostrar pantallas de carga molestas.
- **Validación de Stock Mínimo:** El sistema ya no permite configurar un stock mínimo igual a 0.
- **Bloqueo de Inventario Negativo:** Si intentas sacar más piezas de las que existen actualmente, el sistema bloqueará la operación con una alerta.
- **Ubicación Automática:** Si creas un nuevo repuesto o importas un CSV sin definir lugar, el sistema lo agrupará bajo la ubicación "Sin Asignación".
- **Ver Detalle desde Categorías, Ubicaciones y Proveedores:** Al abrir el detalle de una Categoría, Ubicación o Proveedor, la lista de "Repuestos Asociados" ahora es clickeable: selecciona cualquier repuesto de esa lista para abrir su ficha completa de detalle, igual que si lo hubieras abierto desde la pestaña de "Repuestos".
- **Búsqueda y QR en Ubicaciones:** La pestaña "Ubicaciones" ahora tiene barra de búsqueda (por nombre o código) y botón de escaneo QR, igual que la pestaña de Repuestos. Cada tarjeta de ubicación incluye un botón "Ver / Imprimir QR" para generar el código de esa ubicación física; al escanearlo se abre automáticamente el detalle con todos los repuestos que contiene.

## 3. Módulo Calendario (Roster)
- **Corrección de Incidencias:** Se ha resuelto el problema que impedía guardar incidencias como (Falta, TXT, Vacaciones, etc.). Ahora basta con elegir la incidencia de la lista desplegable en el día del empleado y el sistema guardará la excepción inmediatamente.

## 4. Módulo de Órdenes de Trabajo (Dashboard)

El panel principal (Dashboard) ha sido mejorado para facilitar la visibilidad de tu carga de trabajo:
- **Actualización Automática:** Si alguien genera una orden desde el *Portal de Solicitantes*, ya no necesitas recargar la página; aparecerá instantáneamente.
- **Opciones de Ordenamiento:**
  En los filtros superiores, puedes elegir cómo organizar tus OTs:
  - `Más recientes primero`: Las órdenes se acomodarán colocando los folios más nuevos en la parte superior.
  - `Más antiguos primero`: Verás los folios más rezagados primero.
  - `Por Prioridad`: Coloca hasta arriba aquellas marcadas como *URGENTES*.

## 5. Módulo de Personal (Directorio)

La sección de "Usuarios" se dividió para mayor control:
- **Personal Interno:** Administradores, gestionadores y técnicos que entran con contraseña.
- **Catálogo de Solicitantes:** Aquellos que solo piden mantenimiento vía portal público. 

**Nuevas características:**
- **Buscador rápido:** Escribe un nombre y la lista se reducirá automáticamente.
- **Ocultar/Ver inactivos:** Por defecto, los usuarios dados de baja no estorbarán en la lista. Puedes revelarlos con el botón de "Ver Inactivos" (icono de ojo).
- **Protección de datos:** Ya no es posible eliminar a técnicos o personal si ya tienen órdenes de trabajo o salidas de inventario a su nombre. Para quitarles acceso, solo dales clic y desmarca la casilla "Usuario Activo".

## 6. Configuración de Roles y Permisos

Para los administradores, modificar lo que puede hacer cada usuario es ahora más simple:
- Entra a la sección de **Roles y Permisos**.
- Enciende o apaga los interruptores según necesites.
- **¡No hay botón de guardar!** El sistema implementa un auto-guardado automático. Un pequeño icono de carga confirmará instantáneamente que los datos se han grabado en el servidor de forma segura.

## 7. Módulo de Activos: Código Interno Automático e Inmutable

- **Autoasignación:** Al registrar un nuevo activo (máquina, equipo), ya no se escribe el "Código Interno" manualmente. El sistema lo genera solo, de forma incremental, con el formato **ACT-0001, ACT-0002, ACT-0003...**
- **Inmutable:** Una vez creado el activo, ese código ya no puede editarse ni desde el formulario de edición ni por ningún otro medio. Esto garantiza que la numeración de la planta sea siempre única y trazable, evitando duplicados o cambios accidentales.
- **Migraciones de datos:** Cualquier importación o migración masiva de activos (histórica o futura) asigna este mismo formato de código automáticamente.

---
*Para soporte técnico adicional, revisa la sección de ayuda dentro del sistema.*
