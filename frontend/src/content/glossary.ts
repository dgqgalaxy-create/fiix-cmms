/**
 * Glosario de conceptos, indicadores y parámetros de GTZ CMMS.
 *
 * Se muestra en el Manual (sección «Glosario») con búsqueda por término o
 * definición, para que el usuario final sepa a qué se refiere cada dato.
 * Los textos usan lenguaje de planta, sin siglas sin explicar.
 */

export interface GlossaryEntry {
  term: string;
  definition: string;
  /** Sinónimos o siglas que también deben encontrar la entrada. */
  aliases?: string[];
}

export interface GlossaryGroup {
  id: string;
  title: string;
  description: string;
  entries: GlossaryEntry[];
}

export const GLOSSARY: GlossaryGroup[] = [
  {
    id: 'ordenes',
    title: 'Órdenes de trabajo',
    description: 'Conceptos de la operación diaria: folios, estados, tiempos y evidencias.',
    entries: [
      {
        term: 'Folio',
        definition:
          'Número consecutivo que identifica una orden de trabajo. Sirve para buscarla, citarla en reportes y rastrearla en la bitácora.',
        aliases: ['OT', 'número de orden'],
      },
      {
        term: 'Pendiente',
        definition:
          'La orden ya existe pero nadie la ha iniciado. Al aceptarla pasa a En proceso y se registra la hora de inicio.',
      },
      {
        term: 'En proceso',
        definition:
          'El técnico ya inició el trabajo y corre el cronómetro de labor. Mientras esté así, la orden puede pausarse o finalizarse.',
      },
      {
        term: 'En espera (pausada)',
        definition:
          'Trabajo detenido por falta de refacción, otra actividad o espera de autorización. El cronómetro se detiene: ese tiempo no cuenta como labor.',
        aliases: ['pausada', 'pausado', 'en espera'],
      },
      {
        term: 'Finalizada',
        definition:
          'Trabajo terminado y cerrado con su evidencia. Ya no se puede editar ni anular; solo se puede eliminar con permiso y contraseña de desarrollador.',
        aliases: ['cerrada', 'finalizado'],
      },
      {
        term: 'Anulada',
        definition:
          'Orden invalidada (no procedía o se duplicó). Sigue visible en el archivo de Cerradas y cuenta como no atendida en los indicadores.',
        aliases: ['anulado', 'invalidada', 'cancelada'],
      },
      {
        term: 'Prioridad (URG / NOR / BAJ)',
        definition:
          'Urgente, Normal o Baja. Define el orden de atención y los tiempos de respuesta y escalamiento del SLA.',
        aliases: ['urgente', 'prioridad alta', 'prioridad baja'],
      },
      {
        term: 'Tipo de mantenimiento',
        definition:
          'Correctivo (repara una falla que ya ocurrió) o Preventivo (trabajo programado para evitar fallas). Cambia cómo se calculan MTTR, retrabajo y cumplimiento.',
        aliases: ['correctivo', 'preventivo', 'tipo de OT'],
      },
      {
        term: 'Máquina detenida',
        definition:
          'Marca que el equipo quedó fuera de producción por esta orden. Alimenta los paros por activo, la disponibilidad y el MTBF.',
        aliases: ['paro', 'línea detenida', 'máquina parada'],
      },
      {
        term: 'Tiempo de labor acumulado',
        definition:
          'Suma de tiempo efectivamente trabajado en la orden, sin contar las pausas. Se mide con el cronómetro al iniciar, pausar y reanudar.',
        aliases: ['tiempo trabajado', 'horas de labor', 'cronómetro'],
      },
      {
        term: 'Antes / Después (fotos)',
        definition:
          'Evidencia fotográfica del estado del equipo antes y después del trabajo. Sirve para demostrar que la reparación se hizo.',
        aliases: ['evidencia', 'fotos', 'antes y después'],
      },
      {
        term: 'Firma de área limpia',
        definition:
          'Firma de quien recibe la zona de trabajo limpia y libre de riesgos al terminar. Es parte de la evidencia de cierre.',
      },
      {
        term: 'Firma de entrega',
        definition:
          'Firma del solicitante o responsable del área confirmando que el equipo quedó funcionando.',
        aliases: ['firma de responsiva'],
      },
      {
        term: 'Refacciones utilizadas',
        definition:
          'Materiales del inventario consumidos por la orden. Cada consumo descuenta stock y queda ligado al costo de la orden.',
        aliases: ['refacciones', 'materiales', 'consumo'],
      },
      {
        term: 'Costo de la orden',
        definition:
          'Suma de costos capturados en la orden (mano de obra, refacciones y otros conceptos). Alimenta el indicador de costos por activo y zona.',
        aliases: ['costos', 'costo total'],
      },
      {
        term: 'Cambios sin revisar',
        definition:
          'Punto morado/azul que indica que alguien modificó la orden desde la última vez que la abriste. Se apaga al abrirla.',
        aliases: ['punto de cambios', 'sin revisar', 'aviso'],
      },
      {
        term: 'Relaciones entre órdenes',
        definition:
          'Vínculo entre una orden y otras: por ejemplo, una orden de reparación que se desprende de un preventivo o que repite la falla.',
        aliases: ['órdenes relacionadas'],
      },
    ],
  },
  {
    id: 'indicadores',
    title: 'Indicadores (KPIs)',
    description: 'Qué mide cada número del tablero de Estadística y cómo se calcula.',
    entries: [
      {
        term: 'MTTR',
        definition:
          'Tiempo medio de reparación: promedio del tiempo de reparación de las órdenes correctivas finalizadas. Más bajo es mejor.',
        aliases: ['tiempo medio de reparación'],
      },
      {
        term: 'MTBF',
        definition:
          'Tiempo medio entre fallas: promedio de horas que un equipo funciona antes de volver a fallar. Más alto es mejor.',
        aliases: ['tiempo medio entre fallas'],
      },
      {
        term: 'Disponibilidad',
        definition:
          'Porcentaje del tiempo que el equipo estuvo operando: MTBF ÷ (MTBF + MTTR) × 100. Baja cuando falla seguido o tarda en repararse.',
      },
      {
        term: 'Tiempo de respuesta',
        definition:
          'Desde que se crea la orden hasta que el técnico la inicia. Mide qué tan rápido se atiende la solicitud.',
        aliases: ['respuesta'],
      },
      {
        term: 'Cumplimiento MTTR',
        definition:
          'Porcentaje de correctivas reparadas dentro de la meta de MTTR configurada. Un 80 % significa que 8 de cada 10 cumplieron el tiempo objetivo.',
      },
      {
        term: 'Backlog',
        definition:
          'Órdenes abiertas (no finalizadas ni anuladas) al cierre del periodo. Es el trabajo pendiente acumulado.',
        aliases: ['pendientes acumulados', 'atraso'],
      },
      {
        term: 'Retrabajo / reincidencia',
        definition:
          'Porcentaje de correctivas que vuelven a fallar en el mismo activo dentro de la ventana configurada (por omisión 7 días). Indica reparaciones que no resolvieron.',
        aliases: ['reincidencia', 'retrabajo'],
      },
      {
        term: 'OT finalizadas (%)',
        definition:
          'De las órdenes creadas en el periodo, qué porcentaje ya se cerró. No cuenta las anuladas.',
      },
      {
        term: 'SLA',
        definition:
          'Acuerdo de nivel de servicio: tiempos máximos comprometidos para responder, reparar y escalar según la prioridad. Si se desactiva, desaparecen los avisos y badges.',
        aliases: ['acuerdo de nivel de servicio', 'vencido', 'en riesgo'],
      },
      {
        term: 'Dentro de SLA / En riesgo / Vencido',
        definition:
          'Dentro: aún hay margen. En riesgo: está por vencer. Vencido: se pasó la fecha u hora comprometida y debe escalarse.',
        aliases: ['badge SLA', 'semaforo SLA'],
      },
      {
        term: 'Zonas de respuesta',
        definition:
          'Filtro que limita todos los indicadores del tablero a las zonas marcadas. La rueda junto a las zonas permite mirar una sola.',
        aliases: ['filtro por zona', 'zona'],
      },
      {
        term: 'Periodo',
        definition:
          'Rango de fechas que se analiza: semana, mes, año o histórico. Cambia todos los indicadores del tablero a la vez.',
        aliases: ['fecha', 'rango'],
      },
    ],
  },
  {
    id: 'desempeno',
    title: 'Desempeño del equipo',
    description: 'Cómo se califica a cada técnico y qué significan sus señales.',
    entries: [
      {
        term: 'Atención',
        definition:
          'Mediana de tiempo entre la asignación de la orden y su inicio. Mide reactividad real del técnico.',
        aliases: ['aceptación', 'tiempo de atención'],
      },
      {
        term: 'Utilización',
        definition:
          'Horas de labor registradas entre las horas que le tocaba trabajar según su horario. Se expresa en porcentaje.',
        aliases: ['utilización', 'ocupación', 'wrench time'],
      },
      {
        term: 'Resuelto a la primera (FTF)',
        definition:
          'Porcentaje de correctivas que no generaron otra correctiva del mismo activo dentro de la ventana de reincidencia. Mide calidad del arreglo.',
        aliases: ['FTF', 'first time fix', 'resuelto a la primera'],
      },
      {
        term: 'Evidencia',
        definition:
          'Porcentaje de órdenes cerradas con foto, firma, nota o refacción registrada. Un cierre sin nada de esto es un cierre débil.',
      },
      {
        term: 'Backlog viejo',
        definition:
          'Órdenes asignadas que llevan más días sin iniciarse de lo permitido. Mide trabajo escondido o postergado.',
        aliases: ['backlog', 'órdenes viejas'],
      },
      {
        term: 'Índice de Atención Real',
        definition:
          'Calificación de 0 a 100 que combina las seis dimensiones con los pesos configurados. Verde, ámbar o rojo según los umbrales.',
        aliases: ['índice', 'calificación'],
      },
      {
        term: 'Modo relativo',
        definition:
          'Compara a cada técnico contra el resto del grupo (percentiles). Se adapta solo al número de técnicos: no requiere recalibrar.',
        aliases: ['relativa', 'percentiles'],
      },
      {
        term: 'Modo fijo',
        definition:
          'Compara contra metas numéricas que tú defines (por ejemplo FTF 75 %, utilización 60 %). Útil cuando quieres un estándar igual para todos.',
        aliases: ['fija', 'metas fijas'],
      },
      {
        term: 'Muestra insuficiente',
        definition:
          'El técnico tiene menos órdenes cerradas que el mínimo configurado. No se calcula índice para evitar conclusiones injustas.',
      },
      {
        term: 'Cierre exprés',
        definition:
          'Orden cerrada en pocos minutos, sin evidencia y sin refacción. Señal de que se cerró sin hacer el trabajo.',
        aliases: ['cierre rápido', 'cerrar por cerrar'],
      },
      {
        term: 'Ping-pong',
        definition:
          'Orden que se reasignó entre técnicos varias veces. Indica que se la pasan de uno a otro.',
        aliases: ['rebote', 'reasignaciones'],
      },
      {
        term: 'Evidencia duplicada',
        definition:
          'La misma foto se usó en varias órdenes del periodo (se compara el contenido del archivo). Señal de evidencia reciclada.',
        aliases: ['foto repetida'],
      },
      {
        term: 'Cierre de fin de turno',
        definition:
          'Cierres hechos en los últimos minutos antes de terminar el turno. Puede ser trabajo real o relleno para cerrar pendientes.',
      },
      {
        term: 'Selección de trabajo',
        definition:
          'El técnico hace más preventivas (fáciles) y menos correctivas que el promedio del equipo. Señal de elegir lo cómodo.',
        aliases: ['cherry picking', 'elegir lo fácil'],
      },
    ],
  },
  {
    id: 'inventario',
    title: 'Inventario y compras',
    description: 'Existencias, costos, unidades y órdenes de compra.',
    entries: [
      {
        term: 'Stock actual',
        definition:
          'Cantidad disponible hoy. Sube con entradas y baja con salidas; las OT descuentan al cerrar con refacciones utilizadas.',
        aliases: ['existencia', 'stock'],
      },
      {
        term: 'Mínimo',
        definition:
          'Cantidad mínima que debe existir. Cuando el stock baja de ahí, el repuesto entra en «Stock bajo» y puede generar borrador de compra.',
        aliases: ['stock mínimo', 'mínimo de inventario'],
      },
      {
        term: 'Stock bajo',
        definition:
          'Repuestos cuyo stock actual es menor o igual al mínimo definido. Es la lista para reabastecer.',
        aliases: ['bajo mínimo', 'crítico'],
      },
      {
        term: 'UOM',
        definition:
          'Unidad de medida del repuesto: pieza, metro, litro, kilogramo, etc. Define cómo se captura y descuenta la cantidad.',
        aliases: ['unidad de medida', 'unidad'],
      },
      {
        term: 'Modo de cantidad (entero / decimal)',
        definition:
          'Entero: solo unidades completas (piezas). Decimal: permite fracciones (metros, litros). Evita capturas imposibles.',
        aliases: ['qty mode', 'cantidad entera', 'cantidad decimal'],
      },
      {
        term: 'Categoría',
        definition: 'Familia del repuesto (rodamientos, eléctrico, filtros…). Agrupa búsquedas, reportes y compras.',
      },
      {
        term: 'Ubicación',
        definition: 'Lugar físico donde está guardado el repuesto (estante, almacén, zona). Facilita encontrarlo.',
      },
      {
        term: 'Proveedor',
        definition:
          'Empresa que surte el repuesto. Un repuesto sin proveedor se marca como tal porque no se puede comprar automáticamente.',
        aliases: ['vendor'],
      },
      {
        term: 'Costo de compra',
        definition:
          'Precio unitario del repuesto. Se usa para valuar inventario y calcular el costo de las refacciones consumidas.',
        aliases: ['costo unitario', 'precio'],
      },
      {
        term: 'Entrada / Salida',
        definition:
          'Entrada: ingresa material al almacén. Salida: se consume (por una OT o por ajuste). Cada movimiento deja rastro y se puede revertir.',
        aliases: ['IN', 'OUT', 'entradas', 'salidas', 'movimientos'],
      },
      {
        term: 'Descontinuado',
        definition:
          'Repuesto que ya no se usa. Se oculta de las listas normales pero conserva su historial.',
        aliases: ['inactivo', 'obsoleto'],
      },
      {
        term: 'Kit de refacciones',
        definition:
          'Conjunto de repuestos que se usan juntos (por ejemplo, un kit de mantenimiento). Muestra si hay existencia suficiente para todo el kit.',
      },
      {
        term: 'Orden de compra (OC)',
        definition:
          'Documento para pedir material al proveedor. Pasa por borrador, solicitada, parcial y recibida.',
        aliases: ['OC', 'compra'],
      },
      {
        term: 'Entrega parcial',
        definition:
          'Cuando el proveedor entrega solo una parte de la orden. El faltante sigue pendiente y la OC no se cierra hasta completar.',
      },
      {
        term: 'Borrador de OC',
        definition:
          'Compra preparada pero aún no enviada al proveedor. Se puede editar o eliminar sin afectar inventario.',
      },
      {
        term: 'IVA',
        definition: 'Impuesto que se suma al subtotal de la orden de compra para obtener el total.',
      },
    ],
  },
  {
    id: 'activos',
    title: 'Activos y zonas',
    description: 'Cómo se identifica la maquinaria y dónde está instalada.',
    entries: [
      {
        term: 'Código interno (MTTO-…)',
        definition:
          'Identificador que se genera solo al guardar: MTTO-NNNN-S-DDD-T (NNNN = nombre, S = sección A–E o X, DDD = duplicado en la misma zona, T = F fijo / C controlable).',
        aliases: ['código MTTO', 'código de activo'],
      },
      {
        term: 'Activo fijo vs controlable',
        definition:
          'Fijo: maquinaria principal (F). Controlable: equipo auxiliar o herramienta (C). Cambia el sufijo del código y cómo se agrupa.',
        aliases: ['fijo', 'controlable', 'asset kind'],
      },
      {
        term: 'Zona y sección',
        definition:
          'Zona: área de la planta (L1–L5, Empaque…). Sección A–E: división dentro de la línea. Juntas ubican el equipo con precisión.',
      },
      {
        term: 'Equipo crítico',
        definition:
          'Activo cuya falla detiene producción o es de alto riesgo. Entra en las listas de prioridad y refacciones críticas.',
        aliases: ['criticidad', 'crítico'],
      },
      {
        term: 'Paro de activo',
        definition:
          'Registro de tiempo que el equipo estuvo detenido. Alimenta MTBF y disponibilidad; se puede capturar manual o desde una OT.',
        aliases: ['downtime', 'paro'],
      },
      {
        term: 'Horómetro / medidor',
        definition:
          'Contador de uso del equipo (horas, kilómetros, ciclos). Su lectura sirve para programar mantenimiento por uso real.',
        aliases: ['medidor', 'horómetro', 'odómetro'],
      },
      {
        term: 'Árbol de fallas (RCA)',
        definition:
          'Clasificación Problema → Causa → Solución al cerrar una correctiva. Permite ver qué falla más y por qué.',
        aliases: ['RCA', 'análisis de causa raíz', 'árbol de fallas'],
      },
    ],
  },
  {
    id: 'horarios',
    title: 'Horarios y turnos',
    description: 'Patrones de trabajo, códigos de turno y cómo afectan los indicadores.',
    entries: [
      {
        term: 'Patrón de turno',
        definition:
          'Horario base de la persona: Mixto (lun–vie, 9 h; sábado 5 h), 4x4 fijo (4 días de trabajo y 4 de descanso) o 4x4 rotatorio (2 días, 2 noches, 4 descansos).',
        aliases: ['patrón', 'MIXTO', '4X4', '4x4 rotatorio'],
      },
      {
        term: 'Turno Día / Noche / Mixto',
        definition:
          'Día: 07:00–19:00 (12 h). Noche: 19:00–07:00 (12 h). Mixto: 07:00–16:00 (9 h) y sábado 07:00–12:00 (5 h).',
        aliases: ['D', 'N', 'M', 'turno día', 'turno noche', 'turno mixto'],
      },
      {
        term: 'Excepción de horario',
        definition:
          'Cambio puntual sobre el patrón: vacaciones, falta, permiso, tiempo extra, tiempo por tiempo o día festivo. Tiene prioridad sobre el patrón.',
        aliases: ['vacaciones', 'falta', 'permiso', 'tiempo extra'],
      },
      {
        term: 'Turno explícito',
        definition:
          'Turno capturado o importado para un día concreto. Tiene prioridad sobre el patrón y las excepciones.',
        aliases: ['importar horario', 'calendario'],
      },
      {
        term: 'Por qué mi utilización sale vacía',
        definition:
          'Porque no hay patrón, turno ni excepción registrados para esa persona en el periodo. Sin horario no hay horas programadas contra las que comparar.',
      },
    ],
  },
  {
    id: 'acceso',
    title: 'Acceso, roles y seguridad',
    description: 'Quién puede hacer qué y cómo se protegen las acciones delicadas.',
    entries: [
      {
        term: 'Roles',
        definition:
          'Administrador (todo), Gestionador (opera y supervisa), Técnico (atiende sus órdenes), Observador (solo consulta y mensajes).',
        aliases: ['rol', 'administrador', 'gestionador', 'técnico', 'observador'],
      },
      {
        term: 'Permisos',
        definition:
          'Autorizaciones específicas por rol (crear, editar, eliminar, comprar…). Se administran en Roles y Permisos.',
      },
      {
        term: 'Contraseña de desarrollador',
        definition:
          'Clave maestra que confirma acciones delicadas (eliminar órdenes, cambiar parámetros). Tras varios intentos fallidos se bloquea una hora.',
        aliases: ['contraseña maestra', 'clave de desarrollador'],
      },
      {
        term: 'Bitácora de auditoría',
        definition:
          'Registro de quién hizo qué y cuándo: eliminaciones, cambios de parámetros, importaciones. No se puede editar.',
        aliases: ['auditoría', 'bitácora', 'log'],
      },
      {
        term: 'API keys',
        definition:
          'Claves para que otros sistemas consulten la API (por ejemplo, un tablero externo). Solo aplican a /api/v1 y se pueden revocar.',
        aliases: ['api key', 'integración'],
      },
      {
        term: 'Portal público de solicitudes',
        definition:
          'Página abierta (/request) donde cualquier persona reporta una falla sin iniciar sesión. Se puede activar o desactivar por configuración.',
        aliases: ['portal', 'solicitudes', 'request'],
      },
    ],
  },
];
