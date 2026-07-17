# Hoja de Ruta y Tareas Pendientes (Living Checklist)

Este documento contiene la lista de módulos y características pendientes de desarrollar. **Se debe actualizar eliminando las tareas al completarlas** para mantenerlo siempre limpio y relevante.
*(Última actualización: 16 de Julio de 2026)*

## 🚀 Versión Actual: v1.11.10 (Actualización: 16 de Julio de 2026)

### Novedades en v1.11.10 (Importación CSV robusta)
- **Orden garantizado:** Al seleccionar los 7 CSV a la vez, el sistema los detecta por nombre y los procesa siempre en el orden correcto (Categorías → Ubicaciones → Proveedores → Items → Usuarios → Inventario → Órdenes).
- **Sin transacciones perdidas:** Los usuarios de movimientos de inventario que no vienen en `Users.csv` se crean automáticamente (inactivos), evitando descartar ~729 movimientos.
- **MTTR fiel:** Los tiempos de reparación con coma de miles (ej. `2,140.22`) se parsean correctamente, eliminando la distorsión del MTTR.

### Novedades Anteriores (v1.11.9 - KPIs recalculados + scoreboard)
- **Cálculos corregidos:** MTTR solo en correctivas (horas), backlog como stock abierto, disponibilidad solo con paros (`machine_stopped`), OT finalizadas por `completed_at`, retrabajo a 7 días, metas en horas.
- **UI industrial:** Scoreboard con salud de planta (Disponibilidad / MTTR / Backlog), semáforo de metas, gráficos y carga por técnico.

### Novedades Anteriores (v1.11.8 - KPIs: periodo vacío)
- **Selector siempre visible:** Si no hay órdenes en el periodo actual, KPIs ya no bloquea la pantalla: puedes cambiar a Año o Histórico.
- **Mensaje aclarado:** Indica que el vacío es del periodo seleccionado, no del sistema completo.

### Novedades Anteriores (v1.11.7 - Marco del Resumen por Periodo)
- **Alcance visual del filtro:** En Inicio, el selector de fechas, las tarjetas de estados y la distribución de mantenimiento están agrupados dentro de un mismo marco para mostrar claramente qué información cambia con el periodo.

### Novedades Anteriores (v1.11.6 - Distribución de Mantenimiento)
- **Visual renovado en Inicio:** La relación entre mantenimientos Preventivos, Correctivos y de Servicio ahora usa una gráfica de dona con total central, porcentajes y barras comparativas.

### Novedades Anteriores (v1.11.5 - Notificaciones al detalle + Resumen semanal)
- **Notificaciones con detalle:** Al hacer clic en una notificación de la campana se abre el detalle de esa orden (también funciona con notificaciones anteriores que traen el folio en el título).
- **Resumen semanal en Inicio:** Bloque visual de órdenes finalizadas de la semana actual (Lunes a Domingo), con total, gráfica diaria y listado rápido.

### Novedades Anteriores (v1.11.4 - Separación Inicio / Órdenes de Trabajo)
- **Módulo Inicio:** Contiene el resumen operativo (Pareto, filtro de fechas, tarjetas de estado y gráfica de relación de mantenimiento). Al hacer clic en una tarjeta se abre el listado filtrado en Órdenes de Trabajo.
- **Órdenes de Trabajo:** Queda enfocado en las solicitudes: Vista General, Mis Órdenes, Historial, búsqueda y filtros.

### Novedades Anteriores (v1.11.3 - Portal Request, Telegram y Calendarios Móviles)
- **Portal de Solicitudes unificado:** Mismo formulario que Nueva Orden (desplegable de solicitantes), sin técnicos ni foto.
- **Telegram en Nueva Orden:** Las órdenes creadas desde Órdenes de Trabajo también notifican a Telegram si está activo.
- **Calendario y Horarios en móvil/tablet:** Alturas adaptativas, toolbar responsive y mejor aprovechamiento del ancho.

### Novedades Anteriores (v1.11.2 - Permisos de RCA y Configuración)
- **Árbol de Fallas visible para todos:** Técnicos, Gestionadores y Administradores pueden consultarlo; solo Admin/Gestionador pueden editarlo.
- **Configuración para Gestionador:** El módulo de Configuración ahora aparece también para Gestionadores (sigue oculto para Técnicos).

### Novedades Anteriores (v1.11.1 - Autoasignación de Órdenes)
- **Autoasignación para Administradores y Gestionadores:** Al aceptar una orden sin seleccionar técnicos, se asigna automáticamente al usuario que la aceptó.
- **Atención Directa:** Administradores y Gestionadores pueden atender solicitudes y subir la evidencia “Antes” como cualquier técnico, sin perder los controles de asignación.
- **Corrección de Asignaciones con Evidencia:** La lista de técnicos seleccionada se conserva correctamente cuando la orden se guarda junto con una fotografía.

### Novedades en v1.9.1 (Mejoras en Inventario y UX)
- **Acceso Ágil para Técnicos:** Habilitado el registro de movimientos para técnicos directamente desde la vista de Repuestos.
- **Actualizaciones Silenciosas:** El guardado y registro de inventario ya no interrumpe la interfaz con pantallas de carga, trabajando en segundo plano.
- **Stock y Movimientos Flexibles:** Ahora es posible registrar fracciones o decimales (ej. litros, metros) al escribir en el campo de cantidad. El control de botones (+ y -) sigue operando en números enteros.
- **Etiqueta Dinámica en Dashboard:** La tarjeta de "Totales Recibidas" en Dashboard ahora especifica dinámicamente el periodo mostrado (Mes Actual, Semana Actual, etc).
- **Validación Robusta:** El stock mínimo permitido es ahora mayor a 0, evitando configuraciones erróneas.

### Novedades Anteriores (v1.9.0)
- Checklists dinámicos con soporte para campos mixtos (texto y número).
- Corrección del guardado de incidencias en el calendario (Roster).
- Habilitada la validación para impedir la salida de inventario por cantidades mayores al stock existente.
- Asignación predeterminada a "Sin Asignación" en inventario.

### Novedades Anteriores (v1.7.5 - Configuración Dinámica y Correcciones)
- **Configuración de Telegram Dinámica:** Se movió la configuración del Bot de Telegram (Token y Chat ID) del archivo `.env` a la base de datos, con una nueva interfaz en "Opciones de Desarrollador" para facilitar la instalación "marca blanca" en nuevas fábricas.
- **Importación CSV de Solicitantes:** Corrección en el módulo de importación masiva. Ahora, al subir el CSV de Órdenes de Trabajo, el sistema alimenta y crea automáticamente los registros faltantes en el Catálogo de Solicitantes.

### Novedades Anteriores (v1.7.4 - Documentación y UI Premium)
- **Manual de Usuario Interactivo:** Reescritura completa del manual con diseño de tarjetas, insignias, navegación lateral sticky, y descripciones a fondo de la lógica interna (WebSockets, alertas de reorden).
- **Opciones de Desarrollador (Manual):** Documentación explícita sobre el "Botón Rojo" de borrado (TRUNCATE CASCADE) restringida dinámicamente a Administradores.
- **Versión en Login:** Se inyectó dinámicamente la variable `APP_VERSION` en la pantalla de inicio de sesión.
- **Ajustes Visuales:** Corrección del efecto "ventana flotante" en contenedores para mejor integración con el Layout principal.

### Novedades Anteriores (v1.7.3 - Checklists y Horarios)
- **Checklist Diario:** Módulo para registro de estado de máquinas, protegido a solo un checklist por día.
- **Módulo de Horarios (Roster):** Calendario de personal con patrones de turnos y excepciones por drag & drop.
- **Impresión Especializada:** Reglas CSS avanzadas para exportar el calendario de horarios a PDF ocultando barras y botones.
- **Días Festivos:** Integración y sombreado automático de los días festivos en México en el calendario.
- **Permisos Simplificados:** Supresión de permisos de sólo lectura para hacer los tableros de KPIs y Horarios públicos a toda la empresa, protegiendo únicamente las mutaciones.

### Novedades en v1.7.2 (Documentación)
- **Actualización de Contexto Global:** Se renovó el documento de arquitectura para reflejar todos los módulos terminados y la convención de separación entre `data` y `docs`.

### Novedades en v1.7.1 (Mantenimiento y Optimización)
- **Limpieza de Código (Dead Code):** Eliminación de variables no utilizadas e importaciones fantasma para optimizar memoria.
- **Refactorización de Hooks en React:** Prevención de renderizados en cascada y flujos de red ineficientes.
- **Seguridad en Logs:** Depuración y silenciamiento de impresiones de consola que exponían información en backend y frontend.
- **Correcciones Tipográficas:** Remoción de código CSS fugado (`dark:text-slate-300`) en los subtítulos de múltiples páginas.

### Novedades Anteriores (v1.7.0)
- **Directorio de Personal & Catálogo de Solicitantes:** Separación del personal interno del catálogo público.
- **Auto-Guardado en Permisos:** La interfaz de configuración de roles ahora guarda instantáneamente (sin botones).
- **Actualización Silenciosa:** Sincronización en tiempo real vía WebSockets para nuevas Órdenes de Trabajo del portal público.
- **Filtros Avanzados en Dashboard:**
  - Opción para buscar usuarios rápidamente.
  - Ordenamiento de OTs con base a `Folio` numérico para mayor exactitud.
  - Ocultamiento inteligente de usuarios "Dados de Baja".
- **Prevención de Eliminación:** Bloqueo de borrado para técnicos que tengan historiales o movimientos de inventario ligados.

## [x] Módulo 7: Mantenimiento Preventivo (PMs)
- [x] Crear interfaz para definir "Rutinas de Mantenimiento" o plantillas.
- [x] Implementar disparadores basados en tiempo (ej. cada 30 días) o medidores.
- [x] Tarea en el servidor (Cron Job) que revise diariamente qué mantenimientos deben generarse y los cree como Órdenes de Trabajo automáticamente.

## [x] Módulo 8: Analíticas y Reportes Gráficos (Dashboard Avanzado)
- [x] Gráficas de Tiempo Medio de Reparación (MTTR) y Tiempo Medio Entre Fallas (MTBF).
- [x] Reportes de Costos de Mantenimiento desglosados por Máquina y por Fecha.
- [x] Exportación de reportes gerenciales en PDF/Excel.

## [x] Módulo 9: Sistema Integral de Órdenes de Compra (POs)
- [x] Convertir la actual "Lista de compras .txt" en Órdenes de Compra digitales reales guardadas en la base de datos.
- [x] Flujo de estados: "Borrador" -> "Solicitado" -> "Recibido".
- [x] Alimentación automática del inventario al marcar un PO como "Recibido".

## [ ] Mejoras Transversales Futuras (Backlog)
- [x] **Migración de Órdenes e Inventario:** Importación exitosa de los archivos CSV históricos.
- [ ] **Checklists avanzados y LOTO:** Pasos obligatorios dentro de la Orden de Trabajo y firmas de bloqueo de energías peligrosas.
- [x] **Notificaciones y Escalamiento:** Avisar por Email/Push/WhatsApp a técnicos y escalar SLAs vencidos a gerentes.
- [ ] **Control de Medidores (CBM):** Registro histórico de horómetros y detonación automática de PMs por uso real.
- [x] **Soporte PWA (Offline):** Que la app funcione sin conexión a internet y sincronice datos en segundo plano.
- [x] **Gestión con Códigos QR:** Escaneo físico en máquinas para abrir historiales y escaneo en estantes para el control rápido de refacciones.
- [x] **Árbol de Fallas (RCA):** Clasificación obligatoria de Problema -> Causa -> Remedio para generar análisis Pareto de fallas comunes.
- [x] **Calendario de Carga de Trabajo / Turnos (Roster):** Vista interactiva para gestionar y asignar turnos, días festivos y faltas del personal (Completado en v1.7.3).
- [ ] **Portal de Contratistas:** Acceso limitado para proveedores externos donde puedan reportar sus trabajos sin ver datos sensibles.
- [ ] **Multiplanta / Multisítio:** Segregación de información para empresas con múltiples fábricas con un dashboard corporativo global.
