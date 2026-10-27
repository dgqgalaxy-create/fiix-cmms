import axios from 'axios';
import prisma from '../config/prisma';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface AIToolUsage {
  name: string;
  args: Record<string, unknown>;
}

export interface AIResponse {
  reply: string;
  toolsUsed: AIToolUsage[];
  model: string;
  provider: string;
}

export interface AIContext {
  userId: string;
  name: string;
  role: string;
  permissions: Record<string, boolean>;
}

const DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning:free';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEZONE = 'America/Mexico_City';

const SYSTEM_PROMPT = `Eres GTZ AI, el asistente virtual experto de mantenimiento industrial para el sistema GTZ CMMS.

Tu objetivo es asistir a técnicos, supervisores y administradores de planta en la gestión de mantenimiento. Puedes consultar información real de la base de datos mediante herramientas de solo lectura.

Datos del sistema que puedes consultar:
- Órdenes de trabajo (OTs): estados PENDIENTE, EN_PROCESO, EN_ESPERA, FINALIZADO y ANULADO; prioridades URGENTE, NORMAL y BAJO; tipos SERVICIO, PREVENTIVO y CORRECTIVO.
- Inventario y repuestos: stock actual, stock mínimo, ubicación en almacén, código interno y alertas de stock bajo.
- Activos y maquinaria: estado operativo (OPERATIVO, EN_MANTENIMIENTO, FUERA_DE_SERVICIO), criticidad, zona y sección.
- Personal y turnos: técnicos asignados y turnos cargados para una fecha.
- Guías del sistema para crear/cerrar OTs, firmas, QR, preventivos, checklist diario, reporte semanal, compras y fotos.

Reglas obligatorias:
1. Responde siempre en español, con un tono profesional, claro y conciso.
2. Usa SIEMPRE las herramientas cuando la pregunta requiera datos de la planta. No inventes folios, cantidades, nombres, fechas ni estados.
3. No tienes permitido crear, editar, cerrar, anular, borrar ni modificar datos. Si el usuario te pide una acción, explícale los pasos para realizarla dentro de la app y aclara que tú solo puedes consultar.
4. Cuando uses una herramienta, no muestres el JSON crudo. Resume los resultados en tablas o listas legibles.
5. Si no hay resultados, dilo claramente y sugiere una búsqueda alternativa.
6. Respeta el alcance de permisos del usuario. Si solo puede ver sus órdenes asignadas, no afirmes que estás mostrando toda la planta.
7. Para preguntas sobre "hoy", usa la fecha actual indicada abajo y las fechas en formato YYYY-MM-DD.
8. No reveles claves, tokens, rutas internas del servidor ni detalles técnicos de la infraestructura.`;

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_work_orders',
      description:
        'Consulta órdenes de trabajo filtrando por estado, prioridad, tipo de mantenimiento, zona, equipo, texto o rango de fechas de creación.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA', 'FINALIZADO', 'ANULADO'],
            description: 'Estado de la orden de trabajo.'
          },
          priority: {
            type: 'string',
            enum: ['URGENTE', 'NORMAL', 'BAJO'],
            description: 'Prioridad de la orden.'
          },
          maintenance_type: {
            type: 'string',
            enum: ['SERVICIO', 'PREVENTIVO', 'CORRECTIVO'],
            description: 'Tipo de mantenimiento.'
          },
          zone: {
            type: 'string',
            description: 'Nombre de la zona o línea de producción (ej. L1, Línea 2, Planta).'
          },
          machine_stopped: {
            type: 'boolean',
            description: 'Filtrar si causó paro de máquina (true/false).'
          },
          query: {
            type: 'string',
            description: 'Texto libre para buscar por título, descripción, solicitante, folio, código o nombre del equipo.'
          },
          date_from: {
            type: 'string',
            description: 'Fecha inicial de creación en formato YYYY-MM-DD.'
          },
          date_to: {
            type: 'string',
            description: 'Fecha final de creación en formato YYYY-MM-DD.'
          },
          limit: {
            type: 'number',
            description: 'Cantidad máxima de órdenes a retornar (por defecto 10, máximo 20).'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_work_order_detail',
      description: 'Obtiene el detalle completo de una orden de trabajo por su número de folio (ej. 42 o FOL-0042).',
      parameters: {
        type: 'object',
        required: ['folio'],
        properties: {
          folio: {
            type: 'number',
            description: 'Número numérico del folio de la orden de trabajo.'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_inventory',
      description: 'Busca repuestos en el inventario por nombre, código interno (MTTO-XXXX) o descripción. Puede filtrar solo stock crítico.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Texto para buscar en nombre, código o descripción del repuesto.'
          },
          low_stock_only: {
            type: 'boolean',
            description: 'Si es true, lista solo repuestos cuyo stock sea menor o igual al mínimo.'
          },
          limit: {
            type: 'number',
            description: 'Máximo número de repuestos a retornar (por defecto 10, máximo 25).'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_assets',
      description: 'Consulta los equipos y activos de la planta por estado operativo, criticidad, zona o texto.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Texto para buscar por nombre, modelo, marca o código interno del activo.'
          },
          status: {
            type: 'string',
            enum: ['OPERATIVO', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO'],
            description: 'Estado operativo del equipo.'
          },
          is_critical: {
            type: 'boolean',
            description: 'Filtrar solo activos marcados como críticos.'
          },
          zone: {
            type: 'string',
            description: 'Nombre de la zona o línea de producción.'
          },
          limit: {
            type: 'number',
            description: 'Cantidad máxima de activos a retornar (por defecto 10, máximo 20).'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_maintenance_summary',
      description: 'Obtiene un resumen cuantitativo del estado actual de la planta: órdenes abiertas, paros, vencidas, equipos fuera de servicio y repuestos con stock bajo.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_roster_today',
      description: 'Consulta el personal y técnicos asignados en turno para el día actual o una fecha específica.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Fecha en formato YYYY-MM-DD (por defecto hoy).'
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_app_guide',
      description: 'Obtiene instrucciones y guías sobre cómo realizar operaciones en el sistema GTZ CMMS.',
      parameters: {
        type: 'object',
        required: ['topic'],
        properties: {
          topic: {
            type: 'string',
            enum: ['crear_ot', 'cerrar_ot', 'firmas', 'qr', 'preventivos', 'checklist_diario', 'reporte_semanal', 'compras', 'fotos_drive'],
            description: 'Tema o procedimiento del que se solicita ayuda.'
          }
        }
      }
    }
  }
];

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const WORK_ORDER_STATUSES = ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA', 'FINALIZADO', 'ANULADO'] as const;
const PRIORITIES = ['URGENTE', 'NORMAL', 'BAJO'] as const;
const MAINTENANCE_TYPES = ['SERVICIO', 'PREVENTIVO', 'CORRECTIVO'] as const;
const ASSET_STATUSES = ['OPERATIVO', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO'] as const;

function pickEnum(value: unknown, allowed: readonly string[]): string | null {
  const candidate = asString(value);
  return candidate && allowed.includes(candidate) ? candidate : null;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asLimit(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), max);
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function configuredTimeZone(): string {
  return process.env.AI_TIMEZONE || DEFAULT_TIMEZONE;
}

function zonedParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: configuredTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour === 24 ? 0 : values.hour,
    minute: values.minute,
    second: values.second
  };
}

function timeZoneOffsetMs(date: Date): number {
  const parts = zonedParts(date);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getMilliseconds()
  );
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(dateValue: string, endOfDay = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    localCheck.getUTCFullYear() !== year ||
    localCheck.getUTCMonth() !== month - 1 ||
    localCheck.getUTCDate() !== day
  ) {
    return null;
  }

  const localAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
  let utc = localAsUtc - timeZoneOffsetMs(new Date(localAsUtc));
  // Segunda pasada para fechas cercanas a un cambio de horario.
  utc = localAsUtc - timeZoneOffsetMs(new Date(utc));
  return new Date(utc);
}

function formatDateOnly(date: Date | null | undefined): string | null {
  return date ? date.toISOString().split('T')[0] ?? null : null;
}

function formatZonedDate(date: Date): string {
  const parts = zonedParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function formatZonedDateTime(date: Date): string {
  const parts = zonedParts(date);
  return `${formatZonedDate(date)} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function localDayRange(value: string): { start: Date; end: Date } | null {
  const start = zonedDateTimeToUtc(value);
  const end = zonedDateTimeToUtc(value, true);
  return start && end ? { start, end } : null;
}

function startOfMonthInTimeZone(date: Date): Date {
  const firstDay = `${formatZonedDate(date).slice(0, 7)}-01`;
  return zonedDateTimeToUtc(firstDay) || date;
}

function isPermissionEnabled(ctx: AIContext, permission: string): boolean {
  return ctx.permissions[permission] === true;
}

function canViewAllWorkOrders(ctx: AIContext): boolean {
  return isPermissionEnabled(ctx, 'VIEW_ALL_WORK_ORDERS');
}

function canViewInventoryCosts(ctx: AIContext): boolean {
  return (
    isPermissionEnabled(ctx, 'MANAGE_INVENTORY') ||
    ctx.role === 'ADMINISTRADOR' ||
    ctx.role === 'GESTIONADOR'
  );
}

function workOrderScope(ctx: AIContext): Record<string, unknown> {
  return canViewAllWorkOrders(ctx)
    ? {}
    : { assigned_technicians: { some: { id: ctx.userId } } };
}

function formatFolio(folio: number): string {
  return `FOL-${String(folio).padStart(4, '0')}`;
}

interface GuideMap {
  [key: string]: string;
}

const GUIDES: GuideMap = {
  crear_ot:
    'Para crear una OT: pulsa "+ Nueva Orden" en la barra superior o en Órdenes de Trabajo. Selecciona el activo o la zona, define la prioridad (usa URGENTE si hay paro), el tipo (Correctivo, Preventivo o Servicio) y marca si causa paro de máquina. Puedes adjuntar una foto inicial y asignar técnicos.',
  cerrar_ot:
    'Para cerrar una OT: abre la orden en proceso y pulsa "Finalizar". Registra las notas de resolución, el tiempo invertido, adjunta la foto final y solicita las firmas de entrega. Si la orden está en pausa, primero debes reanudarla.',
  firmas:
    'Firmas digitales: al finalizar la OT se solicitan dos firmas. 1) Área Limpia y Segura: el técnico confirma que dejó el área ordenada. 2) Entrega y Recepción: el solicitante o supervisor valida el trabajo recibido.',
  qr:
    'Códigos QR: cada activo y repuesto tiene un código QR único. Puedes escanearlo con la cámara desde el botón "Escanear QR" de la barra móvil para abrir la ficha del equipo o verificar el stock.',
  preventivos:
    'Planes Preventivos: en el módulo "Planes Preventivos" se programan tareas recurrentes por días, semanas, meses o fecha fija. El sistema genera automáticamente las órdenes preventivas cuando corresponde.',
  checklist_diario:
    'Checklist Diario: cada día se genera una planilla de inspección para los técnicos con actividades de verificación visual y funcional (Check, Número o Texto). El líder revisa y aprueba el checklist al cierre.',
  reporte_semanal:
    'Informe Semanal: en "/weekly-report" puedes consultar el acumulado de solicitudes por día, la gráfica de finalizaciones (Preventivo, Correctivo o Servicio), el backlog y exportarlo a PDF.',
  compras:
    'Módulo de Compras: permite generar solicitudes de compra para reponer repuestos o adquirir servicios externos, asociar cotizaciones en PDF, registrar proveedores y calcular IVA.',
  fotos_drive:
    'Fotos de OT y proveedores: puedes subir fotos locales (hasta 12 MB) o sincronizarlas automáticamente mediante carpetas públicas de Google Drive configuradas en Opciones de Desarrollador → Integraciones.'
};

// Ejecutores de las herramientas. Todas las consultas son de solo lectura.
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AIContext
): Promise<unknown> {
  switch (name) {
    case 'get_work_orders': {
      const and: Record<string, unknown>[] = [];
      const scope = workOrderScope(ctx);
      if (Object.keys(scope).length) and.push(scope);

      const rawStatus = asString(args.status);
      const rawPriority = asString(args.priority);
      const rawMaintenanceType = asString(args.maintenance_type);
      const status = pickEnum(rawStatus, WORK_ORDER_STATUSES);
      const priority = pickEnum(rawPriority, PRIORITIES);
      const maintenanceType = pickEnum(rawMaintenanceType, MAINTENANCE_TYPES);
      const zone = asString(args.zone);
      const query = asString(args.query);
      const machineStopped = asBoolean(args.machine_stopped);

      if (rawStatus && !status) {
        return { error: `Estado inválido. Usa uno de: ${WORK_ORDER_STATUSES.join(', ')}.` };
      }
      if (rawPriority && !priority) {
        return { error: `Prioridad inválida. Usa una de: ${PRIORITIES.join(', ')}.` };
      }
      if (rawMaintenanceType && !maintenanceType) {
        return {
          error: `Tipo de mantenimiento inválido. Usa uno de: ${MAINTENANCE_TYPES.join(', ')}.`
        };
      }

      if (status) and.push({ status });
      if (priority) and.push({ priority });
      if (maintenanceType) and.push({ maintenance_type: maintenanceType });
      if (machineStopped !== undefined) and.push({ machine_stopped: machineStopped });

      if (zone) {
        and.push({
          OR: [
            { zone: { name: { contains: zone, mode: 'insensitive' } } },
            { asset: { name: { contains: zone, mode: 'insensitive' } } },
            { asset: { internal_code: { contains: zone, mode: 'insensitive' } } }
          ]
        });
      }

      if (query) {
        const folioMatch = query.match(/^FOL-?(\d+)$/i);
        const folioNumber = folioMatch
          ? Number(folioMatch[1])
          : /^\d+$/.test(query)
            ? Number(query)
            : null;
        and.push({
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { requester_name: { contains: query, mode: 'insensitive' } },
            { asset: { name: { contains: query, mode: 'insensitive' } } },
            { asset: { internal_code: { contains: query, mode: 'insensitive' } } },
            ...(folioNumber !== null ? [{ folio: folioNumber }] : [])
          ]
        });
      }

      const rawDateFrom = asString(args.date_from);
      const rawDateTo = asString(args.date_to);
      const dateFromRange = rawDateFrom ? localDayRange(rawDateFrom) : null;
      const dateToRange = rawDateTo ? localDayRange(rawDateTo) : null;
      if (rawDateFrom && !dateFromRange) {
        return { error: 'date_from debe ser una fecha válida en formato YYYY-MM-DD.' };
      }
      if (rawDateTo && !dateToRange) {
        return { error: 'date_to debe ser una fecha válida en formato YYYY-MM-DD.' };
      }
      if (dateFromRange || dateToRange) {
        const createdAt: Record<string, Date> = {};
        if (dateFromRange) createdAt.gte = dateFromRange.start;
        if (dateToRange) createdAt.lte = dateToRange.end;
        and.push({ created_at: createdAt });
      }

      const where = and.length ? { AND: and } : {};
      const limit = asLimit(args.limit, 10, 20);
      const [total, orders] = await Promise.all([
        prisma.workOrder.count({ where }),
        prisma.workOrder.findMany({
          where,
          take: limit,
          orderBy: { created_at: 'desc' },
          select: {
            folio: true,
            title: true,
            status: true,
            priority: true,
            maintenance_type: true,
            machine_stopped: true,
            created_at: true,
            scheduled_date: true,
            due_date: true,
            completed_at: true,
            asset: { select: { internal_code: true, name: true } },
            zone: { select: { name: true } },
            assigned_technicians: { select: { name: true } }
          }
        })
      ]);

      return {
        alcance: canViewAllWorkOrders(ctx) ? 'Toda la planta' : 'Solo órdenes asignadas al usuario',
        total_coincidencias: total,
        mostrando: orders.length,
        ordenes: orders.map((o) => ({
          folio: formatFolio(o.folio),
          titulo: o.title,
          estado: o.status,
          prioridad: o.priority,
          tipo: o.maintenance_type,
          paro_maquina: o.machine_stopped,
          equipo: o.asset ? `${o.asset.internal_code} - ${o.asset.name}` : 'Sin equipo',
          zona: o.zone?.name || 'N/A',
          tecnicos: o.assigned_technicians.map((t) => t.name).join(', ') || 'Sin asignar',
          fecha_creacion: formatZonedDate(o.created_at),
          fecha_programada: formatDateOnly(o.scheduled_date),
          fecha_limite: formatDateOnly(o.due_date),
          fecha_termino: o.completed_at ? formatZonedDate(o.completed_at) : null
        }))
      };
    }

    case 'get_work_order_detail': {
      const folioMatch = String(args.folio ?? '').match(/(\d+)/);
      const folioNum = folioMatch ? Number(folioMatch[1]) : NaN;
      if (!Number.isInteger(folioNum) || folioNum <= 0) {
        return { error: 'El folio debe incluir un número entero positivo (ej. 42 o FOL-0042).' };
      }

      const order = await prisma.workOrder.findFirst({
        where: { folio: folioNum, ...workOrderScope(ctx) },
        include: {
          asset: { select: { internal_code: true, name: true, model: true, brand: true } },
          zone: { select: { name: true } },
          created_by: { select: { name: true } },
          assigned_technicians: { select: { name: true } },
          failure_problem: { select: { name: true } },
          failure_cause: { select: { name: true } },
          failure_remedy: { select: { name: true } },
          inventory_transactions: {
            where: { amount: { lt: 0 } },
            select: {
              amount: true,
              unit_cost: true,
              item: { select: { internal_code: true, name: true, uom: true } }
            },
            orderBy: { created_at: 'asc' }
          }
        }
      });

      if (!order) {
        return {
          message: canViewAllWorkOrders(ctx)
            ? `No se encontró ninguna orden con folio ${formatFolio(folioNum)}.`
            : `No se encontró la orden ${formatFolio(folioNum)} entre tus órdenes asignadas.`
        };
      }

      return {
        folio: formatFolio(order.folio),
        titulo: order.title,
        descripcion: order.description || 'Sin descripción',
        estado: order.status,
        prioridad: order.priority,
        tipo: order.maintenance_type,
        paro_maquina: order.machine_stopped,
        motivo_espera: order.hold_reason || null,
        notas_resolucion: order.resolution_notes || null,
        equipo: order.asset
          ? `${order.asset.internal_code} - ${order.asset.name} (${order.asset.brand} ${order.asset.model})`
          : null,
        zona: order.zone?.name || null,
        solicitante: order.requester_name || order.created_by.name,
        tecnicos_asignados: order.assigned_technicians.map((t) => t.name).join(', ') || 'Sin asignar',
        problema: order.failure_problem?.name || null,
        causa_raiz: order.failure_cause?.name || null,
        solucion_remedio: order.failure_remedy?.name || null,
        tiempo_acumulado_minutos: Math.round(Number(order.accumulated_time_ms || 0) / 60000),
        fecha_creacion: formatZonedDateTime(order.created_at),
        fecha_programada: formatDateOnly(order.scheduled_date),
        fecha_limite: formatDateOnly(order.due_date),
        fecha_termino: order.completed_at ? formatZonedDateTime(order.completed_at) : null,
        firma_area_limpia: Boolean(order.signature_clean_area),
        firma_entrega: Boolean(order.signature_delivery),
        repuestos_utilizados: order.inventory_transactions.map((tx) => ({
          codigo: tx.item.internal_code,
          nombre: tx.item.name,
          cantidad: Math.abs(tx.amount),
          unidad: tx.item.uom,
          costo_unitario:
            canViewInventoryCosts(ctx) && tx.unit_cost != null
              ? Number(tx.unit_cost.toFixed(2))
              : null
        }))
      };
    }

    case 'search_inventory': {
      const query = asString(args.query);
      const lowStockOnly = asBoolean(args.low_stock_only) === true;
      const limit = asLimit(args.limit, 10, 25);
      const where: Record<string, unknown> = { is_active: true };
      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { internal_code: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ];
      }

      const items = await prisma.item.findMany({
        where,
        take: lowStockOnly ? 200 : limit,
        orderBy: lowStockOnly ? { stock: 'asc' } : { name: 'asc' },
        select: {
          internal_code: true,
          name: true,
          stock: true,
          minimum_inventory: true,
          uom: true,
          purchase_cost: true,
          location: { select: { name: true, internal_id: true } },
          category: { select: { name: true } }
        }
      });

      const allResults = items.map((i) => ({
        codigo: i.internal_code,
        nombre: i.name,
        stock_actual: i.stock,
        stock_minimo: i.minimum_inventory,
        faltante: Math.max(0, Number((i.minimum_inventory - i.stock).toFixed(2))),
        unidad: i.uom,
        ubicacion: i.location ? `${i.location.internal_id} (${i.location.name})` : 'Sin asignar',
        categoria: i.category?.name || 'General',
        costo_unitario:
          canViewInventoryCosts(ctx) && i.purchase_cost != null
            ? Number(i.purchase_cost.toFixed(2))
            : null,
        alerta_stock: i.stock <= i.minimum_inventory
      }));

      const filteredResults = lowStockOnly
        ? allResults.filter((i) => i.alerta_stock)
        : allResults;
      const results = filteredResults.slice(0, limit);

      return {
        total_coincidencias: lowStockOnly
          ? filteredResults.length
          : await prisma.item.count({ where }),
        mostrando: results.length,
        repuestos: results
      };
    }

    case 'get_assets': {
      const and: Record<string, unknown>[] = [{ is_obsolete: false }];
      const rawStatus = asString(args.status);
      const status = pickEnum(rawStatus, ASSET_STATUSES);
      const query = asString(args.query);
      const zone = asString(args.zone);
      const isCritical = asBoolean(args.is_critical);

      if (rawStatus && !status) {
        return { error: `Estado de activo inválido. Usa uno de: ${ASSET_STATUSES.join(', ')}.` };
      }

      if (status) and.push({ status });
      if (isCritical !== undefined) and.push({ is_critical: isCritical });
      if (zone) and.push({ zone: { name: { contains: zone, mode: 'insensitive' } } });
      if (query) {
        and.push({
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { internal_code: { contains: query, mode: 'insensitive' } },
            { model: { contains: query, mode: 'insensitive' } },
            { brand: { contains: query, mode: 'insensitive' } }
          ]
        });
      }

      const where = { AND: and };
      const limit = asLimit(args.limit, 10, 20);
      const [total, assets] = await Promise.all([
        prisma.asset.count({ where }),
        prisma.asset.findMany({
          where,
          take: limit,
          orderBy: { internal_code: 'asc' },
          select: {
            internal_code: true,
            name: true,
            brand: true,
            model: true,
            status: true,
            is_critical: true,
            zone: { select: { name: true } },
            zone_section: { select: { name: true } }
          }
        })
      ]);

      return {
        total_coincidencias: total,
        mostrando: assets.length,
        activos: assets.map((a) => ({
          codigo: a.internal_code,
          nombre: a.name,
          marca_modelo: `${a.brand} ${a.model}`.trim(),
          estado: a.status,
          critico: a.is_critical,
          zona: a.zone?.name || 'N/A',
          seccion: a.zone_section?.name || 'N/A'
        }))
      };
    }

    case 'get_maintenance_summary': {
      const scope = workOrderScope(ctx);
      const openWhere: any = {
        ...scope,
        status: { in: ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'] }
      };
      const now = new Date();
      const monthStart = startOfMonthInTimeZone(now);
      // due_date es una fecha sin hora (medianoche UTC); comparar contra la fecha de hoy.
      const todayDateOnly = parseDateOnly(formatZonedDate(now)) || now;

      const [
        pendientes,
        enProceso,
        enEspera,
        paros,
        vencidas,
        finalizadasMes,
        equiposFuera,
        repuestosAgotados,
        repuestosBajoStock
      ] = await Promise.all([
        prisma.workOrder.count({ where: { ...scope, status: 'PENDIENTE' } }),
        prisma.workOrder.count({ where: { ...scope, status: 'EN_PROCESO' } }),
        prisma.workOrder.count({ where: { ...scope, status: 'EN_ESPERA' } }),
        prisma.workOrder.count({ where: { ...openWhere, machine_stopped: true } }),
        prisma.workOrder.count({
          where: {
            ...openWhere,
            due_date: { lt: todayDateOnly }
          }
        }),
        prisma.workOrder.count({
          where: {
            ...scope,
            status: 'FINALIZADO',
            completed_at: { gte: monthStart }
          }
        }),
        prisma.asset.count({ where: { status: 'FUERA_DE_SERVICIO', is_obsolete: false } }),
        prisma.item.count({ where: { is_active: true, stock: { lte: 0 } } }),
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "Item"
          WHERE is_active = true AND stock <= minimum_inventory
        `
      ]);

      return {
        alcance: canViewAllWorkOrders(ctx) ? 'Toda la planta' : 'Solo órdenes asignadas al usuario',
        fecha_consulta: formatZonedDateTime(now),
        ordenes_abiertas: {
          pendientes,
          en_proceso: enProceso,
          en_espera: enEspera,
          total_activas: pendientes + enProceso + enEspera,
          vencidas
        },
        finalizadas_este_mes: finalizadasMes,
        paros_de_maquina_activos: paros,
        equipos_fuera_de_servicio: equiposFuera,
        repuestos_con_stock_cero: repuestosAgotados,
        repuestos_bajo_stock: Number(repuestosBajoStock[0]?.count || 0)
      };
    }

    case 'get_roster_today': {
      const requestedDate = parseDateOnly(args.date);
      const targetDate = requestedDate || parseDateOnly(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: configuredTimeZone(),
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date())
      );
      if (!targetDate) {
        return { error: 'La fecha debe tener el formato YYYY-MM-DD.' };
      }

      const shifts = await prisma.technicianShift.findMany({
        where: { date: targetDate },
        include: {
          user: { select: { name: true, role: true } }
        },
        orderBy: { shift_code: 'asc' }
      });

      if (!shifts.length) {
        return {
          fecha: formatDateOnly(targetDate),
          total: 0,
          mensaje: 'No hay cuadrante cargado específicamente para esta fecha. Los técnicos operan según su horario base.'
        };
      }

      return {
        fecha: formatDateOnly(targetDate),
        total: shifts.length,
        turnos: shifts.map((s) => ({
          tecnico: s.user.name,
          rol: s.user.role,
          codigo_turno: s.shift_code,
          notas: s.notes || ''
        }))
      };
    }

    case 'get_app_guide': {
      const topic = asString(args.topic);
      return {
        guia: (topic && GUIDES[topic]) || 'Tema no encontrado. Consulta la sección de ayuda o el manual del sistema.'
      };
    }

    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

function providerLabel(baseURL: string): string {
  if (baseURL.includes('opencode.ai')) return 'OpenCode';
  if (baseURL.includes('openrouter.ai')) return 'OpenRouter';
  return 'OpenAI compatible';
}

function isFallbackWorthyError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  const data = error.response?.data as
    | { error?: { message?: string }; message?: string }
    | undefined;
  const message = String(data?.error?.message || data?.message || error.message || '');
  if (status === 402 || status === 404 || status === 429) return true;
  if (status === 400 && /model/i.test(message)) return true;
  return /credit|rate.?limit|quota|model.*(invalid|unavailable|not found)|no endpoints/i.test(
    message
  );
}

function currentDateForPrompt(): string {
  const timeZone = configuredTimeZone();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  const time = new Intl.DateTimeFormat('es-MX', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
  return `${date} ${time} (${timeZone})`;
}

export async function chatWithAI(
  userMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userInfo: AIContext
): Promise<AIResponse> {
  if (String(process.env.AI_ENABLED ?? 'true').toLowerCase() === 'false') {
    throw new Error('El asistente de IA está deshabilitado por configuración.');
  }

  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('La API Key del asistente no está configurada en el servidor (AI_API_KEY).');
  }

  const rawBaseURL = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).trim();
  const baseURL = rawBaseURL
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/i, '');
  const model = (process.env.AI_MODEL || DEFAULT_MODEL).trim();
  const fallbackModel = (process.env.AI_FALLBACK_MODEL || '').trim();
  const provider = providerLabel(baseURL);

  if (!baseURL || !model) {
    throw new Error('La configuración del proveedor de IA está incompleta (AI_BASE_URL / AI_MODEL).');
  }

  const maxTokens = Math.min(
    Math.max(Number(process.env.AI_MAX_TOKENS) || 1400, 256),
    4096
  );
  const timeout = Math.min(
    Math.max(Number(process.env.AI_TIMEOUT_MS) || 45000, 10000),
    90000
  );
  const maxRounds = Math.min(
    Math.max(Number(process.env.AI_MAX_TOOL_ROUNDS) || 4, 1),
    6
  );
  const maxToolCalls = 12;
  let activeModel = model;
  let fallbackUsed = false;

  const userContextPrompt = `${SYSTEM_PROMPT}

Fecha y hora actual del servidor: ${currentDateForPrompt()}.
Usuario actual: ${userInfo.name} (Rol: ${userInfo.role}).
Permiso para ver todas las órdenes: ${canViewAllWorkOrders(userInfo) ? 'SÍ' : 'NO (solo sus órdenes asignadas)'}.
Permiso para ver costos de inventario: ${canViewInventoryCosts(userInfo) ? 'SÍ' : 'NO'}.`;

  const messages: any[] = [
    { role: 'system', content: userContextPrompt },
    ...userMessages.map((m) => ({ role: m.role, content: m.content }))
  ];

  const debug = process.env.AI_DEBUG === 'true';
  const toolsUsed: AIToolUsage[] = [];
  let toolCallsExecuted = 0;

  for (let round = 0; round < maxRounds; round += 1) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
    if (baseURL.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = process.env.AI_APP_URL || 'http://localhost:3000';
      headers['X-Title'] = 'GTZ CMMS AI Assistant';
    }

    if (debug) {
      console.log(`[GTZ AI] Ronda ${round + 1}/${maxRounds} → ${activeModel} (${provider})`);
    }

    let response: any;
    try {
      response = await axios.post(
        `${baseURL}/chat/completions`,
        {
          model: activeModel,
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: maxTokens
        },
        { headers, timeout }
      );
    } catch (error) {
      if (
        !fallbackUsed &&
        fallbackModel &&
        fallbackModel !== activeModel &&
        isFallbackWorthyError(error)
      ) {
        fallbackUsed = true;
        const previousModel = activeModel;
        activeModel = fallbackModel;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        console.warn(
          `[GTZ AI] El modelo ${previousModel} no está disponible (${status || 'sin estado'}). Se usará el respaldo ${fallbackModel}.`
        );
        // Repite la misma ronda con el modelo de respaldo.
        round -= 1;
        continue;
      }
      throw error;
    }

    const choice = response.data?.choices?.[0];
    const message = choice?.message;
    if (!message) {
      throw new Error('Respuesta inválida del proveedor de IA.');
    }

    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      toolCallsExecuted += message.tool_calls.length;
      if (debug) {
        console.log(
          `[GTZ AI] Herramientas solicitadas: ${message.tool_calls
            .map((call: any) => call?.function?.name)
            .join(', ')}`
        );
      }
      if (toolCallsExecuted > maxToolCalls) {
        return {
          reply:
            'La consulta requirió demasiadas operaciones sobre la base de datos. Intenta ser más específico (por ejemplo, indica una zona, un folio o un rango de fechas).',
          toolsUsed,
          model: activeModel,
          provider
        };
      }

      messages.push({
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: message.tool_calls
      });

      for (const call of message.tool_calls) {
        const fnName = String(call?.function?.name || '');
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs =
            typeof call?.function?.arguments === 'string'
              ? JSON.parse(call.function.arguments)
              : call?.function?.arguments || {};
          if (!fnArgs || typeof fnArgs !== 'object' || Array.isArray(fnArgs)) {
            fnArgs = {};
          }
        } catch {
          fnArgs = {};
        }

        toolsUsed.push({ name: fnName, args: fnArgs });

        let result: unknown;
        try {
          result = await executeTool(fnName, fnArgs, userInfo);
          if (debug) {
            console.log(`[GTZ AI] ${fnName} ejecutada correctamente.`);
          }
        } catch (error) {
          console.error(`[GTZ AI] Error ejecutando ${fnName}:`, error);
          result = {
            error:
              'No fue posible consultar esa información en este momento. Intenta de nuevo o reformula la pregunta.'
          };
        }

        messages.push({
          role: 'tool',
          tool_call_id: call?.id || fnName,
          content: JSON.stringify(result ?? null)
        });
      }

      continue;
    }

    const reply = typeof message.content === 'string' ? message.content.trim() : '';
    if (debug) {
      console.log(`[GTZ AI] Respuesta final recibida (${reply.length} caracteres).`);
    }
    return {
      reply:
        reply ||
        'No obtuve una respuesta textual del modelo. Intenta reformular la pregunta o ser más específico.',
      toolsUsed,
      model: activeModel,
      provider
    };
  }

  return {
    reply:
      'La consulta requirió varias rondas de acceso a datos y alcancé el límite. Intenta dividir la pregunta en partes más pequeñas.',
    toolsUsed,
    model: activeModel,
    provider
  };
}
