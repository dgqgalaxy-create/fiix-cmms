/**
 * Contenido del Manual de Usuario.
 *
 * Cada sección explica, en lenguaje sencillo: para qué sirve el módulo,
 * qué puedes hacer, qué significan los datos que ves y buenas prácticas.
 * El manual es buscable y la sección «Glosario» se toma aparte.
 */

export type ManualIconKey =
  | 'home'
  | 'orders'
  | 'plans'
  | 'reports'
  | 'messages'
  | 'notes'
  | 'inventory'
  | 'meters'
  | 'checklists'
  | 'roster'
  | 'calendar'
  | 'purchases'
  | 'people'
  | 'assets'
  | 'rca'
  | 'stats'
  | 'performance'
  | 'workload'
  | 'contractors'
  | 'crews'
  | 'files'
  | 'settings'
  | 'portal'
  | 'data'
  | 'glossary';

export interface ManualField {
  label: string;
  meaning: string;
}

export interface ManualSection {
  id: string;
  title: string;
  icon: ManualIconKey;
  /** Una línea que resume el módulo. */
  tagline: string;
  /** Para qué sirve. */
  purpose: string;
  /** Qué puedes hacer. */
  actions: string[];
  /** Datos, etiquetas o columnas y lo que significan. */
  fields?: ManualField[];
  /** Buenas prácticas o avisos. */
  tips?: string[];
  /** Ids de secciones relacionadas. */
  related?: string[];
  /** Solo visible para administradores. */
  adminOnly?: boolean;
}

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'quick',
    title: 'Guía rápida',
    icon: 'home',
    tagline: 'Empieza en 5 pasos, sin leer todo el manual.',
    purpose:
      'GTZ CMMS sirve para que ninguna falla se pierda: se reporta, se asigna, se repara y queda registrado con evidencia, refacciones y tiempos.',
    actions: [
      '1. Da de alta tu maquinaria en Activos (nombre, zona, marca y modelo).',
      '2. Carga el personal en Personal y sus horarios en Horarios.',
      '3. Carga tus refacciones en Inventario (con mínimo y proveedor).',
      '4. Empieza a crear órdenes en Órdenes de Trabajo (o compárteles el portal público).',
      '5. Revisa cada semana Inicio, Informes y Estadística para ver qué se atendió y qué se atoró.',
    ],
    tips: [
      'La regla de oro: si no tiene foto, firma o refacción, el cierre es débil. Las banderas del tablero de Desempeño lo detectan.',
      'Los técnicos pueden trabajar desde el celular: aceptar, pausar y finalizar con fotos.',
    ],
    related: ['orders', 'inventory', 'roster', 'performance', 'glossary'],
  },
  {
    id: 'home',
    title: 'Inicio',
    icon: 'home',
    tagline: 'El tablero del día: qué hay pendiente y cómo va la semana.',
    purpose:
      'Es la primera pantalla al entrar. Resume la operación: cuántas órdenes hay por estado, cuáles están vencidas o sin asignar y cómo se movió la semana.',
    actions: [
      'Consulta las tarjetas de resumen y haz clic en cualquiera para ver la lista filtrada.',
      'Revisa la carga de técnicos y las órdenes urgentes o detenidas.',
      'Entra al cronómetro de una orden en proceso para pausarla o continuarla.',
      'Exporta el resumen del periodo a Excel si lo necesitas para una junta.',
      'Abre el informe semanal y el detalle de finalizadas de la semana.',
    ],
    fields: [
      { label: 'Total recibidas', meaning: 'Órdenes creadas en el periodo, sin contar las invalidadas.' },
      { label: 'Pendientes', meaning: 'Creadas y todavía sin iniciar; se atienden por prioridad y SLA.' },
      { label: 'En proceso', meaning: 'Con trabajo iniciado y cronómetro corriendo.' },
      { label: 'Pausadas', meaning: 'Detenidas por falta de refacción, otra actividad o autorización.' },
      { label: 'Finalizadas', meaning: 'Cerradas con evidencia; ya no se editan.' },
      { label: 'Invalidadas', meaning: 'Anuladas: no procedían o se duplicaron.' },
    ],
    tips: [
      'Si una tarjeta no cuadra con lo que ves en Órdenes, revisa el filtro de fechas y zonas del resumen.',
      'El punto de color en Órdenes indica cambios que no has revisado.',
    ],
    related: ['orders', 'reports', 'stats'],
  },
  {
    id: 'orders',
    title: 'Órdenes de trabajo',
    icon: 'orders',
    tagline: 'El corazón del sistema: reportar, asignar, reparar y cerrar con evidencia.',
    purpose:
      'Una orden de trabajo (OT) es el registro de una falla o un trabajo programado. Aquí vive su ciclo completo: quién la pidió, quién la atiende, cuánto tardó y qué se usó.',
    actions: [
      'Crear una OT con activo, zona, prioridad, tipo, solicitante y, si quieres, categoría.',
      'Aceptar la orden (pasa a En proceso y arranca el cronómetro de labor).',
      'Pausar y reanudar cuando falte refacción o te muevan a otra actividad.',
      'Finalizar con foto Antes, notas de resolución, foto Después y firmas de liberación y entrega.',
      'Registrar refacciones usadas del almacén o consumir un kit completo.',
      'Agregar costos adicionales (servicios de terceros, fletes, compras fuera de inventario).',
      'Subir archivos, comentar, relacionar órdenes (duplicada, bloquea, causada por) y ver la bitácora.',
      'Exportar a PDF y, al finalizar, registrar el árbol de fallas (Problema → Causa → Solución).',
      'Eliminar una orden definitivamente (permiso + contraseña de desarrollador + escribir ELIMINAR).',
    ],
    fields: [
      { label: 'Estados', meaning: 'Pendiente → En proceso → En espera ↔ En proceso → Finalizada. Anulada es el archivo de invalidadas.' },
      { label: 'Prioridad URG / NOR / BAJ', meaning: 'Urgente, Normal o Baja. Define tiempos de respuesta y escalamiento del SLA.' },
      { label: 'SLA', meaning: 'Semáforo de tiempos comprometidos: dentro, en riesgo o vencido.' },
      { label: 'Tiempo de labor', meaning: 'Cronómetro acumulado sin contar pausas; alimenta costos y desempeño.' },
      { label: 'Categoría', meaning: 'Clasificación libre (seguridad, mejora, proyecto…) para reportar.' },
      { label: 'Bitácora', meaning: 'Todo lo que pasó en la orden: cambios, fotos, refacciones, kit y quién lo hizo.' },
      { label: 'Cambios sin revisar', meaning: 'Punto que indica movimientos desde tu última visita; se apaga al abrirla.' },
    ],
    tips: [
      'No cierres una orden solo para quitarla de la lista: genera retrabajo y baja el indicador de resuelto a la primera.',
      'Si la reparación depende de otra área, usa En espera con motivo; el tiempo de espera no cuenta como labor.',
      'Consumir un kit descuenta todos sus repuestos de una vez y los liga a la orden; si falta uno, no descuenta ninguno.',
    ],
    related: ['inventory', 'performance', 'plans', 'rca'],
  },
  {
    id: 'plans',
    title: 'Planes preventivos',
    icon: 'plans',
    tagline: 'Mantenimiento programado por tiempo: la app crea las órdenes sola.',
    purpose:
      'Define rutinas (qué se hace, cada cuánto y a qué equipo) y el sistema genera las órdenes de trabajo automáticamente según la frecuencia.',
    actions: [
      'Crear una rutina con activo, frecuencia, prioridad y responsable.',
      'Ajustar la próxima fecha o desactivar un plan sin borrarlo.',
      'Ver qué órdenes se generarán y cuándo.',
      'Revisar el histórico de generaciones para detectar planes que no se están ejecutando.',
    ],
    fields: [
      { label: 'Frecuencia', meaning: 'Cada cuántos días, semanas o meses se genera la orden.' },
      { label: 'Próxima generación', meaning: 'Fecha en que el sistema creará la siguiente orden.' },
      { label: 'Activo / zona', meaning: 'Equipo y área donde se ejecutará la rutina.' },
    ],
    tips: [
      'Los planes por uso real (horómetro) se configuran en Medidores, no aquí.',
      'Si un plan genera órdenes que nadie atiende, revisa la carga del equipo antes de acortar la frecuencia.',
    ],
    related: ['meters', 'orders', 'workload'],
  },
  {
    id: 'reports',
    title: 'Informes',
    icon: 'reports',
    tagline: 'El resumen de la semana y el histórico de todo el año.',
    purpose:
      'Sirve para comunicar resultados: qué se levantó, qué se cerró, cuánto se tardó y qué se dejó pendiente, en un formato listo para imprimir o compartir.',
    actions: [
      'Abrir el informe semanal con el resumen por estado y por técnico.',
      'Consultar el histórico acumulado de años anteriores.',
      'Exportar a PDF o Excel para enviarlo a dirección.',
    ],
    fields: [
      { label: 'Finalizadas', meaning: 'Órdenes cerradas en el periodo del informe.' },
      { label: 'Pendientes al cierre', meaning: 'Lo que quedó abierto al terminar la semana.' },
      { label: 'Tiempos', meaning: 'Promedios de respuesta, reparación y ciclo.' },
    ],
    tips: [
      'Compara dos semanas seguidas para distinguir un mal día de una tendencia.',
      'El informe por sí solo no califica personas: para eso usa Desempeño del equipo.',
    ],
    related: ['stats', 'performance', 'home'],
  },
  {
    id: 'messages',
    title: 'Mensajes',
    icon: 'messages',
    tagline: 'Chat interno para no perder acuerdos de la operación.',
    purpose:
      'Comunicación directa entre personas y grupos de trabajo, con archivos adjuntos, sin salir de la aplicación.',
    actions: [
      'Iniciar un chat 1:1 o crear un grupo.',
      'Enviar texto y adjuntos; reaccionar, responder y reenviar mensajes.',
      'Eliminar tus propios mensajes (soft delete: quedan marcados).',
      'Ver el contador de no leídos en el menú.',
    ],
    tips: [
      'Para decisiones que deban quedar ligadas a una orden, usa los comentarios de la OT: quedan en su bitácora.',
      'Los técnicos solo ven tus mensajes, no sus indicadores personales.',
    ],
    related: ['notes', 'orders'],
  },
  {
    id: 'notes',
    title: 'Notas y pendientes',
    icon: 'notes',
    tagline: 'Recordatorios personales y tareas que sí se pueden asignar.',
    purpose:
      'Separa dos cosas: tus notas privadas (solo tú las ves) y los pendientes operativos que asignas a otra persona.',
    actions: [
      'Crear una nota personal rápida.',
      'Crear un pendiente con fecha, prioridad y responsable; el asignado lo verá y podrá completarlo.',
      'Reabrir o posponer un pendiente (solo quien lo creó).',
      'Filtrar por pendientes, completados y avisos.',
    ],
    fields: [
      { label: 'Nota', meaning: 'Privada: solo la ves tú.' },
      { label: 'Pendiente', meaning: 'Compartido: lo ven quien lo crea y el asignado.' },
      { label: 'Aviso', meaning: 'Mensaje informativo sin acción pendiente.' },
    ],
    tips: [
      'Lo que dependa de un equipo o una reparación debe ir como orden de trabajo, no como pendiente.',
      'Usa la campana para ver vencimientos y avisos.',
    ],
    related: ['orders', 'messages'],
  },
  {
    id: 'inventory',
    title: 'Inventario',
    icon: 'inventory',
    tagline: 'Refacciones, existencias y movimientos, sin adivinar qué falta.',
    purpose:
      'Controla qué refacciones tienes, dónde están, cuánto cuestan y cuándo se consumen o se compran.',
    actions: [
      'Dar de alta repuestos con código, categoría, ubicación, proveedor, costo, mínimo y unidad.',
      'Registrar entradas y salidas; cada movimiento cambia el stock y queda en el historial.',
      'Ver «Stock bajo» para reabastecer y crear borradores de compra por proveedor.',
      'Consultar movimientos por fecha, tipo y costo; exportar a Excel.',
      'Administrar categorías, ubicaciones y proveedores (con logo).',
      'Crear kits: conjuntos de refacciones que se consumen juntos en una OT.',
      'Imprimir etiquetas QR de repuestos y escanearlas para abrirlos rápido.',
      'Buscar una imagen del repuesto en la web y guardarla como foto.',
    ],
    fields: [
      { label: 'Stock actual', meaning: 'Existencia hoy. Sube con entradas y baja con salidas o consumos de OT.' },
      { label: 'Mínimo', meaning: 'Existencia mínima deseada; al bajar de ahí entra en stock bajo.' },
      { label: 'UOM', meaning: 'Unidad: pieza, litro, metro, kilogramo…' },
      { label: 'Cantidades', meaning: 'Enteras (solo piezas) o decimales (metros, litros).' },
      { label: 'Entrada / Salida', meaning: 'IN ingresa material; OUT lo consume (por OT o ajuste).' },
      { label: 'Descontinuado', meaning: 'Ya no se compra ni se usa, pero conserva historial.' },
      { label: 'Kit', meaning: 'Grupo de repuestos que se descuentan juntos al consumirlo desde una OT.' },
    ],
    tips: [
      'Un repuesto sin proveedor no puede entrar en una compra automática: el sistema lo marca.',
      'No borres movimientos para “cuadrar” el stock: registra un ajuste con motivo; así queda rastro.',
      'El consumo desde la OT es la forma correcta de descontar material; evita movimientos sueltos.',
    ],
    related: ['purchases', 'orders', 'glossary'],
  },
  {
    id: 'meters',
    title: 'Medidores',
    icon: 'meters',
    tagline: 'Mantenimiento por uso real: horómetros, odómetros y contadores.',
    purpose:
      'Registra cuánto ha trabajado un equipo y dispara órdenes de trabajo cuando llega a un umbral, en lugar de esperar una fecha.',
    actions: [
      'Crear un medidor por activo y unidad (horas, kilómetros, ciclos).',
      'Capturar lecturas periódicas; el sistema guarda el histórico y la última lectura.',
      'Configurar disparadores: al llegar o superar X, crear una OT automática.',
      'Revisar qué disparadores están activos y a qué umbral.',
    ],
    fields: [
      { label: 'Última lectura', meaning: 'Valor más reciente registrado.' },
      { label: 'Umbral', meaning: 'Valor que, al alcanzarse, dispara la orden.' },
      { label: 'Condición', meaning: 'Mayor o igual / menor o igual al umbral.' },
    ],
    tips: [
      'Registra lecturas con regularidad: un medidor sin lecturas no puede disparar nada.',
      'Los planes por tiempo siguen en Planes preventivos; este módulo es por uso.',
    ],
    related: ['plans', 'assets', 'orders'],
  },
  {
    id: 'checklists',
    title: 'Checklist diario',
    icon: 'checklists',
    tagline: 'La rutina diaria por línea, firmada y lista para imprimir.',
    purpose:
      'Estandariza la inspección diaria de las líneas de producción: qué revisar, quién lo hizo y qué se encontró.',
    actions: [
      'Capturar el checklist del día marcando Cumple, No cumple o N/A por punto.',
      'Agregar observaciones y fotos donde haga falta.',
      'Firmar y finalizar; el líder de mantenimiento puede revisarlo.',
      'Imprimir el checklist finalizado en formato carta.',
      'Consultar el histórico por fecha, técnico y estado.',
    ],
    fields: [
      { label: 'Borrador', meaning: 'En captura; solo el técnico puede editarlo.' },
      { label: 'Finalizado', meaning: 'Firmado y cerrado; ya se puede imprimir.' },
      { label: 'Revisado', meaning: 'Revisado por el líder de mantenimiento.' },
      { label: 'No cumple', meaning: 'Punto con problema: genera aviso para dar seguimiento.' },
    ],
    tips: [
      'Un “No cumple” repetido en la misma línea es señal de un problema de fondo: revisa el histórico.',
      'El checklist diario no sustituye una OT: si requiere reparación, crea la orden.',
    ],
    related: ['orders', 'plans'],
  },
  {
    id: 'roster',
    title: 'Horarios y turnos',
    icon: 'roster',
    tagline: 'Quién trabaja qué día y en qué turno (mixto y 4x4).',
    purpose:
      'Es el calendario del personal. Define patrones de turno, faltas, vacaciones y horas extra; alimenta el cálculo de utilización y de carga de trabajo.',
    actions: [
      'Asignar un patrón a cada persona: Mixto, 4x4 fijo o 4x4 rotatorio.',
      'Registrar excepciones por día: vacaciones, falta, permiso, tiempo extra, festivo.',
      'Importar el calendario desde Excel o capturarlo a mano.',
      'Ver la vista semanal (matriz) o mensual y el resumen de horas.',
      'Consultar el resumen semanal por persona: horas programadas, extra, faltas y deudas de tiempo.',
    ],
    fields: [
      { label: 'Mixto', meaning: 'Lunes a viernes de día y sábado medio día; domingo descanso.' },
      { label: '4x4 fijo', meaning: 'Cuatro días de trabajo y cuatro de descanso, siempre en el mismo turno.' },
      { label: '4x4 rotatorio', meaning: 'Dos días, dos noches y cuatro de descanso.' },
      { label: 'Códigos D / N / M', meaning: 'Día, noche y mixto; se usan en el calendario y en los reportes.' },
      { label: 'Excepción', meaning: 'Cambio puntual que tiene prioridad sobre el patrón.' },
      { label: 'Horas extra', meaning: 'Tiempo adicional registrado; se refleja en el resumen semanal.' },
    ],
    tips: [
      'Si un técnico aparece “sin horario”, su utilización no se puede calcular: asígnale patrón o turnos.',
      'La carga de trabajo y el desempeño usan este calendario; mantenlo al día cuando haya cambios de plantilla.',
    ],
    related: ['workload', 'performance', 'people'],
  },
  {
    id: 'calendar',
    title: 'Calendario',
    icon: 'calendar',
    tagline: 'La programación de trabajos vista por día.',
    purpose:
      'Muestra las órdenes programadas en el tiempo para planear la semana y evitar que dos trabajos críticos caigan el mismo día.',
    actions: [
      'Cambiar entre vista de semana y de mes.',
      'Arrastrar una orden a otro día para reprogramarla.',
      'Abrir la orden desde el calendario.',
      'Imprimir el calendario para el pizarrón o la junta.',
    ],
    tips: [
      'Programar sin revisar la carga del técnico es la causa más común de atrasos. Revisa Carga de trabajo antes.',
      'Las órdenes vencidas aparecen como pendientes: atiéndelas o reprograma con motivo.',
    ],
    related: ['orders', 'workload', 'roster'],
  },
  {
    id: 'purchases',
    title: 'Compras',
    icon: 'purchases',
    tagline: 'Del “falta material” a la orden de compra y la recepción.',
    purpose:
      'Gestiona las órdenes de compra de refacciones y servicios: qué se pidió, a quién, cuánto cuesta y qué ya llegó.',
    actions: [
      'Crear una OC con proveedor, líneas, cantidades y precios.',
      'Aprobarla, enviarla al proveedor y después recibirla (total o parcialmente).',
      'Al recibir, el inventario se actualiza automáticamente con lo que llegó.',
      'Registrar entregas parciales sin duplicar stock.',
      'Crear un borrador de OC desde Stock bajo, agrupado por proveedor.',
      'Imprimir o exportar la OC y consultar su historial.',
    ],
    fields: [
      { label: 'Borrador', meaning: 'Compra preparada, aún no aprobada.' },
      { label: 'Aprobada', meaning: 'Autorizada para enviarse.' },
      { label: 'Enviada', meaning: 'Pedido hecho; se espera material.' },
      { label: 'Parcial', meaning: 'Llegó parte del pedido; el faltante sigue pendiente.' },
      { label: 'Recibida', meaning: 'Material completo recibido e inventariado.' },
      { label: 'Cancelada', meaning: 'Compra anulada; no se espera material.' },
      { label: 'IVA', meaning: 'Impuesto que se suma al subtotal.' },
    ],
    tips: [
      'Recibe solo lo que llegó físicamente: lo demás sigue pendiente y se verá en la OC.',
      'Una OC sin proveedor no se puede enviar; corrígelo antes de aprobar.',
    ],
    related: ['inventory', 'orders'],
  },
  {
    id: 'people',
    title: 'Personal',
    icon: 'people',
    tagline: 'Usuarios, roles, tarifas y catálogo de solicitantes.',
    purpose:
      'Administra quién entra a la app, qué puede hacer y cuánto cuesta su hora; además mantiene el catálogo de personas que solicitan trabajos.',
    actions: [
      'Crear usuarios con rol y contraseña temporal.',
      'Asignar rol y permisos (Administrador, Gestionador, Técnico, Observador).',
      'Capturar la tarifa por hora para el costo de mano de obra.',
      'Dar de baja y reactivar cuentas sin perder su historial.',
      'Administrar el catálogo de solicitantes usado en órdenes y portal.',
    ],
    fields: [
      { label: 'Administrador', meaning: 'Acceso total, incluida configuración y eliminaciones.' },
      { label: 'Gestionador', meaning: 'Opera y supervisa el mantenimiento; no cambia configuración crítica.' },
      { label: 'Técnico', meaning: 'Ve y atiende sus órdenes; interfaz móvil disponible.' },
      { label: 'Observador', meaning: 'Solo consulta y mensajes; no modifica nada.' },
      { label: 'Tarifa por hora', meaning: 'Se usa para calcular el costo de mano de obra de las órdenes.' },
    ],
    tips: [
      'No compartas la cuenta de administrador: cada quien debe tener la suya para que la auditoría sirva.',
      'La contraseña temporal obliga a cambiarla al primer ingreso.',
    ],
    related: ['settings', 'roster'],
  },
  {
    id: 'assets',
    title: 'Activos',
    icon: 'assets',
    tagline: 'El inventario de máquinas y equipos, con su historia.',
    purpose:
      'Registra la maquinaria: cómo se llama, dónde está, qué tan crítica es, cuánto vale y qué le ha pasado.',
    actions: [
      'Dar de alta un activo con nombre, marca, modelo, serie, zona y tipo.',
      'Clasificarlo con categoría, marcarlo como crítico u obsoleto.',
      'Ver su historial de órdenes, paros, medidores y refacciones.',
      'Consultar su depreciación y vida útil.',
      'Ubicarlo sobre el plano de la zona y abrir su QR.',
      'Registrar paros para alimentar MTBF y disponibilidad.',
    ],
    fields: [
      { label: 'Código MTTO', meaning: 'Se genera solo: MTTO-número-sección-duplicado-tipo.' },
      { label: 'Fijo / Controlable', meaning: 'Maquinaria principal o equipo auxiliar/herramienta.' },
      { label: 'Crítico', meaning: 'Su falla detiene producción o implica riesgo.' },
      { label: 'Zona y sección', meaning: 'Ubicación dentro de la planta.' },
      { label: 'Depreciación', meaning: 'Valor del equipo en el tiempo según vida útil y valor residual.' },
    ],
    tips: [
      'Marca como crítico solo lo que realmente detiene la operación; si todo es crítico, nada lo es.',
      'Un activo sin zona no entra en los filtros ni en el plano.',
    ],
    related: ['meters', 'orders', 'inventory'],
  },
  {
    id: 'rca',
    title: 'Árbol de fallas',
    icon: 'rca',
    tagline: 'Por qué falla y cómo se corrige: la base para mejorar.',
    purpose:
      'Clasifica las fallas en Problema → Causa → Solución. Al cerrar órdenes correctivas puedes registrar este análisis (opcional) y aquí se acumula.',
    actions: [
      'Registrar el árbol al finalizar una orden correctiva.',
      'Consultar el Pareto de fallas más frecuentes y sus causas.',
      'Usar la información para decidir planes preventivos o compras de refacción.',
    ],
    tips: [
      'Dos o tres causas bien clasificadas valen más que mil notas sueltas.',
      'El análisis es opcional al cerrar, pero es lo que permite dejar de apagar fuegos.',
    ],
    related: ['orders', 'plans', 'stats'],
  },
  {
    id: 'stats',
    title: 'Estadística',
    icon: 'stats',
    tagline: 'Los números que dicen la verdad: tiempos, costos y confiabilidad.',
    purpose:
      'Reúne los indicadores de mantenimiento para detectar problemas y justificar decisiones con datos, no con impresiones.',
    actions: [
      'Ver antigüedad de órdenes abiertas por tramos de días.',
      'Consultar disponibilidad por equipo (los 10 con menor disponibilidad).',
      'Ver consumo y costo de repuestos, y costo por equipo con mano de obra.',
      'Analizar solicitudes por mes, estado y solicitante.',
      'Abrir Indicadores (KPIs) con metas, zonas y periodo.',
      'Entrar a Desempeño del equipo y a Carga de trabajo.',
    ],
    fields: [
      { label: 'Antigüedad', meaning: 'Órdenes abiertas agrupadas por días transcurridos.' },
      { label: 'Disponibilidad', meaning: 'Porcentaje del tiempo que el equipo estuvo operando.' },
      { label: 'Consumo', meaning: 'Refacciones usadas y su costo en el periodo.' },
      { label: 'MTTR / MTBF', meaning: 'Tiempo medio de reparación y tiempo medio entre fallas.' },
      { label: 'Backlog', meaning: 'Órdenes abiertas al cierre del periodo.' },
      { label: 'Retrabajo', meaning: 'Correctivas que repiten falla en el mismo activo.' },
    ],
    tips: [
      'Cambia el periodo para distinguir tendencia de ruido.',
      'Si un indicador sale raro, revisa que las órdenes tengan fechas de inicio y cierre.',
    ],
    related: ['performance', 'workload', 'reports'],
  },
  {
    id: 'performance',
    title: 'Desempeño del equipo',
    icon: 'performance',
    tagline: 'Quién atiende de verdad y quién solo mueve papeles.',
    purpose:
      'Califica a cada técnico con datos difíciles de falsear: atención, trabajo registrado, calidad del cierre y señales de alarma.',
    actions: [
      'Ver el tablero por técnico con índice, semáforo y banderas.',
      'Cambiar el periodo (7/30/90 días) y la comparación (por turno o todo el equipo).',
      'Expandir un técnico para ver sus puntajes y qué banderas tiene.',
      'Exportar a CSV, Excel o PDF.',
      'Ajustar parámetros (solo Administrador + contraseña de desarrollador) con vista previa.',
    ],
    fields: [
      { label: 'Atención', meaning: 'Tiempo desde la asignación hasta iniciar la orden (mediana).' },
      { label: 'Utilización', meaning: 'Horas de labor contra las horas de turno del horario.' },
      { label: 'Resuelto a la primera', meaning: 'Correctivas sin reincidencia del mismo equipo.' },
      { label: 'Evidencia', meaning: 'Cierres con foto, firma, nota o refacción.' },
      { label: 'Backlog viejo', meaning: 'Órdenes asignadas que llevan días sin iniciarse.' },
      { label: 'Cierre exprés', meaning: 'Cierre en minutos, sin evidencia ni refacción.' },
      { label: 'Ping-pong', meaning: 'Orden rebotada entre técnicos.' },
      { label: 'Muestra insuficiente', meaning: 'Pocas órdenes para calificar; no se calcula índice.' },
    ],
    tips: [
      'El índice abre una conversación, no decide un sueldo.',
      'Compara contra el propio histórico y el turno; no mezcles turnos distintos.',
      'Si cambia la plantilla no hay que recalibrar: el modo relativo se adapta solo.',
    ],
    related: ['stats', 'workload', 'roster'],
  },
  {
    id: 'workload',
    title: 'Carga de trabajo',
    icon: 'workload',
    tagline: 'A quién asignar sin sobrecargar (y a quién ya no).',
    purpose:
      'Muestra cuántas órdenes abiertas tiene cada técnico, cuántas vencidas y cómo se reparte el trabajo por día, para asignar con criterio.',
    actions: [
      'Elegir periodo (7, 14 o 21 días) y filtrar por zona.',
      'Ver por técnico: abiertas, en proceso, vencidas y horas de turno.',
      'Leer el mapa diario: cada celda cuenta órdenes programadas o con fecha límite ese día.',
      'Hacer clic en el nombre para abrir la lista de sus órdenes abiertas y entrar al detalle de cualquiera sin salir del tablero.',
      'Usar el botón «Desempeño» dentro de esa lista para abrir su ficha completa.',
      'Usar la sugerencia: la persona con menor carga del equipo.',
    ],
    fields: [
      { label: 'Carga relativa', meaning: 'Sus órdenes contra el promedio del equipo; 100 % es promedio.' },
      { label: 'Horas de turno', meaning: 'Suma de horas programadas según horarios.' },
      { label: 'Vencidas', meaning: 'Órdenes con fecha límite ya pasada.' },
      { label: 'Sin asignar', meaning: 'Órdenes abiertas que todavía no tienen técnico.' },
    ],
    tips: [
      'Reparte las órdenes urgentes primero; la sugerencia no sustituye tu criterio.',
      'Si alguien aparece “sin horario”, su carga no mide capacidad real: revisa Horarios.',
    ],
    related: ['performance', 'roster', 'orders'],
  },
  {
    id: 'contractors',
    title: 'Contratistas y cuadrillas',
    icon: 'contractors',
    tagline: 'Trabajo externo y equipos internos, también con registro.',
    purpose:
      'Asigna trabajos a proveedores externos (contratistas) o a equipos internos (cuadrillas) sin perder trazabilidad, costo ni responsabilidad.',
    actions: [
      'Registrar contratistas con contacto y tarifas (hora/visita).',
      'Crear cuadrillas con sus integrantes.',
      'Asignar un contratista o una cuadrilla a una orden de trabajo.',
      'Ver el trabajo y costo asociados a cada uno.',
    ],
    tips: [
      'Si el trabajo lo hace un externo, asígnalo como contratista: así el indicador del técnico no se infla ni se castiga.',
      'Mantén actualizadas las tarifas para que el costo de la orden sea real.',
    ],
    related: ['orders', 'people', 'stats'],
  },
  {
    id: 'files',
    title: 'Archivos',
    icon: 'files',
    tagline: 'La biblioteca de documentos y evidencias.',
    purpose:
      'Guarda y encuentra archivos de la operación: manuales, procedimientos, fotos, documentos de activos y adjuntos de órdenes.',
    actions: [
      'Subir archivos y organizarlos en carpetas.',
      'Buscar y descargar documentos.',
      'Abrir los archivos ligados a una orden o a un activo.',
    ],
    tips: [
      'Para evidencias de una reparación, sube los archivos desde la orden: quedan ligados a su historial.',
      'Nombra los archivos con criterio (activo o fecha) para encontrarlos después.',
    ],
    related: ['orders', 'assets'],
  },
  {
    id: 'settings',
    title: 'Configuración',
    icon: 'settings',
    tagline: 'Cómo se comporta la app para tu planta.',
    purpose:
      'Ajusta notificaciones, SLA, apariencia, idioma, integraciones y catálogos. Algunas opciones son solo para administradores.',
    actions: [
      'Configurar notificaciones y reglas de escalamiento SLA.',
      'Cambiar apariencia (claro/oscuro) e idioma (español/inglés).',
      'Administrar aprobaciones por prioridad, tipo, criticidad o zona.',
      'Configurar Google Drive, API keys y webhooks.',
      'Crear campos personalizados para OT, activos y repuestos.',
      'Definir zona horaria, formatos de fecha/hora y unidades de medida.',
      'Configurar el portal público y las características visibles.',
      'Administrar roles, permisos y categorías de activos/OT.',
      'Editar los parámetros de Desempeño del equipo (Admin + contraseña).',
    ],
    tips: [
      'Si desactivas el SLA desaparecen sus badges y avisos: hazlo solo si no lo usas.',
      'Los cambios de configuración se reflejan al instante en las pestañas abiertas.',
    ],
    related: ['portal', 'performance', 'people'],
  },
  {
    id: 'portal',
    title: 'Portal de solicitudes',
    icon: 'portal',
    tagline: 'Que cualquiera reporte una falla sin tener cuenta.',
    purpose:
      'Página pública donde el personal de producción reporta una falla en segundos. El solicitante recibe un folio y puede seguir su estado.',
    actions: [
      'Compartir el enlace del portal con el personal de planta.',
      'Recibir solicitudes que entran como órdenes pendientes.',
      'El solicitante consulta el avance con su folio.',
      'Configurar qué campos se piden y si el seguimiento está disponible.',
    ],
    fields: [
      { label: 'Seguimiento', meaning: 'El solicitante ve en qué estado va su reporte.' },
      { label: 'Campos obligatorios', meaning: 'Lo que debe llenar para que la solicitud sea útil.' },
    ],
    tips: [
      'Pide un activo y una descripción clara: sin eso, el técnico pierde tiempo buscando.',
      'Revisa las solicitudes al menos una vez al día para que no se enfríen.',
    ],
    related: ['orders', 'settings'],
  },
  {
    id: 'data',
    title: 'Importación y respaldos',
    icon: 'data',
    tagline: 'Cargar datos y proteger la información.',
    purpose:
      'Herramientas para la puesta en marcha y para respaldar/restaurar: importar CSV o Google Sheets, descargar un respaldo y auditar lo que pasó.',
    actions: [
      'Importar inventario y órdenes desde CSV o Google Sheets (con fotos de Drive o zip).',
      'Ajustar el tope de tiempo de la importación sin tocar el servidor.',
      'Descargar un respaldo de la base y de los archivos.',
      'Restaurar un respaldo (con confirmación y contraseña).',
      'Revisar la bitácora de auditoría y exportarla.',
    ],
    fields: [
      { label: 'Tope de importación', meaning: 'Tiempo máximo del trabajo; al cumplirse se detiene y conserva lo ya importado.' },
      { label: 'Fase', meaning: 'Etapa actual del trabajo: lectura, descarga de fotos, asignación o fin.' },
      { label: 'Auditoría', meaning: 'Registro de quién hizo qué y cuándo.' },
    ],
    tips: [
      'Antes de importar, haz un respaldo: es la red de seguridad si algo no sale como esperabas.',
      'Para cargas grandes de fotos, sube el tope de importación y hazlo fuera del horario pico.',
    ],
    related: ['settings', 'inventory', 'glossary'],
    adminOnly: true,
  },
];
