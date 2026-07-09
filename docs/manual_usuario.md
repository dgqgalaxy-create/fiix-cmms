# Manual de Usuario - LPET CMMS
*(Versión 1.9.0)*

Bienvenido al manual de uso rápido del Sistema de Gestión de Mantenimiento Computarizado (CMMS). A continuación, te explicamos cómo utilizar las principales funciones agregadas recientemente.

## 1. Módulo Checklist: Campos Numéricos y de Texto
Las actividades del Checklist ahora son más flexibles:
- **Campos Mixtos:** Además de los clásicos checks (✔️/❌), algunas actividades específicas (como temperatura o lecturas de agua) mostrarán un pequeño campo de texto.
- **Uso:** Simplemente haz clic en la línea correspondiente y teclea el valor numérico (ej. 45.5) o un texto corto. El sistema guardará la información tal como si fuese un check tradicional.
- **Configuración:** Para que estos campos aparezcan, asegúrate de ir a las *Opciones de Desarrollador* en el menú y hacer clic en **"Restaurar Actividades por Defecto"**.

## 2. Módulo Inventario: Restricciones y Autocorrecciones
Se han mejorado las reglas del almacén para prevenir errores:
- **Cantidades Enteras:** Al registrar entradas o salidas, el sistema te obligará a introducir números enteros (sin decimales).
- **Bloqueo de Inventario Negativo:** Si intentas sacar más piezas de las que existen actualmente (ej. sacar 10 de un stock de 5), el sistema bloqueará la operación y mostrará un mensaje de alerta en rojo.
- **Ubicación Automática:** Si creas un nuevo repuesto o importas un CSV y olvidas asignarle una ubicación, el sistema lo agrupará automáticamente bajo la ubicación "Sin Asignación".

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

---
*Para soporte técnico adicional, revisa la sección de ayuda dentro del sistema.*
