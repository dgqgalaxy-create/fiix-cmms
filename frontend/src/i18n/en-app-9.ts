/** Diccionario inglés (parte 9): costos por línea, informe semanal, portal, roles y contratistas. */
export const enApp9: Record<string, string> = {
  // Costos por línea
  'No se pudieron cargar los costos por línea.': 'Line costs could not be loaded.',
  'Exportar Excel': 'Export Excel',
  'Configurar líneas': 'Configure lines',
  'Descargar lista de refacciones (y su stock) de los equipos marcados como críticos':
    'Download the spare parts list (and stock) of equipment marked as critical',
  'Refacciones críticas': 'Critical spare parts',
  'Limpiar búsqueda': 'Clear search',
  'No se encontraron activos para «': 'No assets found for "',
  '».': '".',
  'Distribución de secciones por línea': 'Section distribution by line',
  'Valor de activos:': 'Asset value:',
  'Reparación (': 'Repair (',
  '):': '):',
  'Valor:': 'Value:',
  'Reparación:': 'Repair:',
  'refacciones': 'spare parts',
  'Estatus': 'Status',
  'OTs': 'WOs',
  'Valor': 'Value',
  'Refacciones': 'Spare parts',
  'Obsoleto': 'Obsolete',
  'Refacciones (': 'Spare parts (',
  'No hay equipos en esta sección.': 'No equipment in this section.',
  'equipos ·': 'equipment ·',
  'No hay secciones ni equipos en esta línea.': 'No sections or equipment on this line.',
  'secciones ·': 'sections ·',
  'Reparación por línea': 'Repair by line',
  'Sin líneas visibles para graficar.': 'No visible lines to chart.',
  'Configurar líneas visibles': 'Configure visible lines',
  'Ninguna': 'None',

  // Informe semanal
  'OT agrupadas por fecha de levantamiento, con su estado actualizado.':
    'WOs grouped by creation date, with their updated status.',
  'Tipo de informe': 'Report type',
  'al': 'to',
  'Hora de planta (Ciudad de México).': 'Plant time (Mexico City).',
  'CUMPLIMIENTO': 'COMPLIANCE',
  'Histórico completo': 'Full history',
  'Todas las OT registradas desde el inicio · Hora de planta (Ciudad de México).':
    'All WOs registered since the start · Plant time (Mexico City).',
  'Total levantadas': 'Total raised',
  'Solicitudes válidas · base del 100 %': 'Valid requests · 100% base',
  'Matriz estado × tipo': 'Status × type matrix',
  'Evolución mensual': 'Monthly evolution',
  'Órdenes levantadas vs finalizadas por mes.': 'Orders raised vs completed per month.',
  'Las invalidadas se muestran para seguimiento y se excluyen del cálculo de porcentajes. Una OT finalizada después conserva su día original de levantamiento.':
    'Invalidated orders are shown for tracking and excluded from percentage calculations. A WO completed later keeps its original creation day.',
  'Órdenes finalizadas': 'Completed orders',
  'Por fecha de finalización, incluidas las solicitudes levantadas en periodos anteriores.':
    'By completion date, including requests raised in earlier periods.',
  'Total:': 'Total:',
  'No hay órdenes finalizadas en este periodo.': 'No completed orders in this period.',
  'Resumen mensual por día. Cantidades en orden preventivo, correctivo y servicio.':
    'Monthly summary by day. Quantities in preventive, corrective and service order.',
  'Cada celda: Preventivo / Correctivo / Servicio.': 'Each cell: Preventive / Corrective / Service.',
  'Cantidad de órdenes por día de levantamiento, estado y tipo de mantenimiento':
    'Order count by creation day, status and maintenance type',
  'Estado de OT': 'WO status',
  'Backlog': 'Backlog',
  'OT levantadas': 'WOs raised',
  'Prev.: preventivos · Corr.: correctivos · Serv.: servicios': 'Prev.: preventive · Corr.: corrective · Serv.: service',
  'Resumen de': 'Summary of',
  'Backlog: OT levantadas ese día que siguen pendientes, en proceso o pausadas. No incluye solicitudes de otros días. OT levantadas: total de solicitudes creadas ese día, incluidas las invalidadas. Los días futuros se muestran con —.':
    'Backlog: WOs raised that day still pending, in progress or paused. Does not include requests from other days. WOs raised: total requests created that day, including invalidated ones. Future days show —.',
  'Resumen de solicitudes por día': 'Requests summary by day',
  'Tiempo de reparación: trabajo acumulado, excluyendo pausas; incluye el tramo activo de las OT en proceso.':
    'Repair time: accumulated work, excluding pauses; includes the active stretch of WOs in progress.',

  // Portal de solicitudes
  '¡Solicitud Enviada!': 'Request sent!',
  'Folio de seguimiento': 'Tracking folio',
  'Equipo / Activo': 'Equipment / asset',
  'El equipo de mantenimiento ha sido notificado y la orden se ha creado exitosamente.':
    'The maintenance team has been notified and the order was created successfully.',
  'Consultar estado de mi solicitud': 'Check my request status',
  'Crear otra solicitud': 'Create another request',
  'Portal de solicitudes desactivado': 'Request portal disabled',
  'Por el momento no se reciben solicitudes por este medio. Contacta al área de mantenimiento.':
    'No requests are being received through this channel at the moment. Contact the maintenance area.',
  'Portal de Mantenimiento': 'Maintenance portal',
  'Reporte de Fallas': 'Failure report',
  'Online': 'Online',
  'Consultar estado de una solicitud →': 'Check a request status →',
  'Busca por folio, zona o nombre del solicitante.': 'Search by folio, zone or requester name.',
  'Nueva Solicitud de Mantenimiento': 'New maintenance request',
  'Se recuperó tu borrador (útil si el navegador se reinició al abrir la cámara). Revisa los datos y la foto antes de enviar.':
    'Your draft was recovered (useful if the browser restarted when opening the camera). Review the data and the photo before submitting.',
  'Cargando solicitantes...': 'Loading requesters...',
  'Escribe tu nombre completo': 'Write your full name',
  'Foto de la falla': 'Failure photo',
  'Galería': 'Gallery',
  'Optimizando foto…': 'Optimizing photo…',

  // Roles y permisos
  'Roles y permisos': 'Roles and permissions',
  'Crea roles, define qué puede hacer cada uno y asígnalos desde la ficha del usuario.':
    'Create roles, define what each one can do and assign them from the user record.',
  'Nuevo rol': 'New role',
  'Base:': 'Base:',
  'Eliminar rol': 'Delete role',
  'Roles base': 'Base roles',
  'Administrador, Gestionador, Técnico y Observador no se pueden eliminar (sí editar). El rol base define el comportamiento heredado del sistema.':
    'Administrator, Manager, Technician and Observer cannot be deleted (but can be edited). The base role defines the inherited system behavior.',
  'Buscar permiso…': 'Search permission…',
  'Los cambios aplican a los': 'Changes apply to the',
  'usuario(s) con este rol.': 'user(s) with this role.',
  'Elige un rol de la izquierda para configurar sus permisos.':
    'Choose a role on the left to configure its permissions.',
  'Ej. Supervisor de turno': 'e.g. Shift supervisor',
  'Rol base': 'Base role',
  'Gestionador': 'Manager',
  'Administrador': 'Administrator',
  'Observador': 'Observer',
  'El rol base conserva el comportamiento del sistema (por ejemplo, solo el Administrador puede eliminar zonas). Después ajustas los permisos uno por uno.':
    'The base role keeps the system behavior (for example, only the Administrator can delete zones). Then you adjust permissions one by one.',
  'Crear rol': 'Create role',
  '¿Eliminar «': 'Delete "',

  'Árbol de Fallas': 'Failure tree',

  // Contratistas
  'Contratistas': 'Contractors',
  'Proveedores de servicios de mantenimiento: especialidad, tarifas y contratos.':
    'Maintenance service providers: specialty, rates and contracts.',
  'Nuevo contratista': 'New contractor',
  'Buscar por nombre o especialidad…': 'Search by name or specialty…',
  'Aún no hay contratistas': 'No contractors yet',
  'Registra a los proveedores que hacen trabajos externos (eléctrico, mecánico, calibración…).':
    'Register the providers who do external work (electrical, mechanical, calibration…).',
  'Contacto:': 'Contact:',
  'Tel:': 'Tel:',
  'Hora:': 'Hour:',
  'Visita:': 'Visit:',
  'Contrato hasta': 'Contract until',
  'orden(es) asignada(s)': 'assigned order(s)',
  'Contacto': 'Contact',
  'Especialidad': 'Specialty',
  'Eléctrica, mecánica…': 'Electrical, mechanical…',
  'Correo': 'Email',
  'Tarifa por hora (MXN)': 'Hourly rate (MXN)',
  'Tarifa por visita (MXN)': 'Visit rate (MXN)',
  'Inicio de contrato': 'Contract start',
  'Fin de contrato': 'Contract end',
};
