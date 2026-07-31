import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';
import { validateChecklistForSubmit, rowHasFailAnomaly } from '../utils/checklistValidation';
import { getMexicoCityNow } from '../utils/checklistReminder';

const emitChecklists = () => emitRefresh('refresh_checklists');

export const MIN_CHECKLIST_COLUMNS = 1;
export const MAX_CHECKLIST_COLUMNS = 12;
const DEFAULT_CHECKLIST_COLUMNS = 5;

export function normalizeChecklistColumnCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CHECKLIST_COLUMNS;
  return Math.min(MAX_CHECKLIST_COLUMNS, Math.max(MIN_CHECKLIST_COLUMNS, Math.round(n)));
}

function asLineStatuses(value: unknown): Record<string, string | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string | null> = {};
  for (const [key, status] of Object.entries(value as Record<string, unknown>)) {
    out[String(key)] = status == null ? null : String(status);
  }
  return out;
}

async function getConfiguredColumnCount(): Promise<number> {
  const settings = await prisma.systemSettings.findFirst();
  return normalizeChecklistColumnCount(settings?.checklist_column_count ?? DEFAULT_CHECKLIST_COLUMNS);
}

/** Día civil del checklist en horario México (alineado con recordatorios Telegram). */
function getChecklistTodayDate(): Date {
  return getMexicoCityNow().asDate;
}

export const getTodayChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const today = getChecklistTodayDate();

    const checklist = await prisma.dailyChecklist.findFirst({
      where: {
        date: today
      },
      include: {
        technician: { select: { name: true } },
        leader: { select: { name: true } },
        rows: {
          orderBy: { order: 'asc' }
        }
      }
    });

    res.json(checklist);
  } catch (error) {
    console.error('Error fetching today checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTodayChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const today = getChecklistTodayDate();
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if it already exists
    const existing = await prisma.dailyChecklist.findFirst({
      where: { date: today }
    });

    if (existing) {
      return res.status(400).json({ error: 'Checklist for today already exists' });
    }

    // Get activities
    const activities = await prisma.checklistActivity.findMany({
      where: { is_active: true },
      orderBy: { order: 'asc' }
    });

    const columnCount = await getConfiguredColumnCount();

    const checklist = await prisma.dailyChecklist.create({
      data: {
        date: today,
        status: 'DRAFT',
        column_count: columnCount,
        rows: {
          create: activities.map(act => ({
            activity_name: act.name,
            order: act.order,
            field_type: act.field_type,
            line_statuses: {},
          }))
        }
      },
      include: {
        technician: { select: { name: true } },
        rows: {
          orderBy: { order: 'asc' }
        }
      }
    });

    emitChecklists();
    res.json(checklist);
  } catch (error) {
    console.error('Error creating today checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Reclama el checklist DRAFT: asigna technician_id al usuario actual. */
export const startChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.dailyChecklist.findUnique({
      where: { id },
      include: {
        technician: { select: { name: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Checklist no encontrado' });
    }

    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Solo se puede iniciar un checklist en borrador' });
    }

    if (existing.technician_id && existing.technician_id !== userId) {
      return res.status(409).json({
        error: `Este checklist ya fue iniciado por ${existing.technician?.name || 'otro técnico'}`,
      });
    }

    if (existing.technician_id === userId) {
      const same = await prisma.dailyChecklist.findUnique({
        where: { id },
        include: {
          technician: { select: { name: true } },
          leader: { select: { name: true } },
          rows: { orderBy: { order: 'asc' } },
        },
      });
      return res.json(same);
    }

    const checklist = await prisma.dailyChecklist.update({
      where: { id },
      data: { technician_id: userId },
      include: {
        technician: { select: { name: true } },
        leader: { select: { name: true } },
        rows: { orderBy: { order: 'asc' } },
      },
    });

    emitChecklists();
    res.json(checklist);
  } catch (error) {
    console.error('Error starting checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateChecklistRow = async (req: AuthRequest, res: Response) => {
  try {
    const rowId = req.params.rowId as string;
    const userId = req.user?.userId;
    const { observations, line, status, line_statuses } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.dailyChecklistRow.findUnique({
      where: { id: rowId },
      include: {
        checklist: { select: { column_count: true, status: true, technician_id: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Fila no encontrada' });
      return;
    }

    if (existing.checklist.status !== 'DRAFT') {
      res.status(400).json({ error: 'El checklist ya no es editable' });
      return;
    }

    if (!existing.checklist.technician_id) {
      res.status(403).json({
        error: 'Debes pulsar «Iniciar checklist» antes de editar.',
      });
      return;
    }

    if (existing.checklist.technician_id !== userId) {
      res.status(403).json({
        error: 'Solo el técnico que inició este checklist puede editarlo.',
      });
      return;
    }

    const data: { observations?: string | null; line_statuses?: Record<string, string | null> } = {};
    if (observations !== undefined) data.observations = observations;

    let nextStatuses = asLineStatuses(existing.line_statuses);

    if (line_statuses !== undefined) {
      nextStatuses = asLineStatuses(line_statuses);
    }

    // Legacy L1_status..L5_status payloads
    for (let i = 1; i <= 5; i++) {
      const key = `L${i}_status`;
      if (req.body[key] !== undefined) {
        nextStatuses[String(i)] = req.body[key] == null ? null : String(req.body[key]);
      }
    }

    if (line !== undefined) {
      const lineNum = Number(line);
      if (!Number.isFinite(lineNum) || lineNum < 1 || lineNum > existing.checklist.column_count) {
        res.status(400).json({ error: `Línea inválida. Usa 1–${existing.checklist.column_count}.` });
        return;
      }
      nextStatuses[String(lineNum)] = status == null || status === '' ? null : String(status);
    }

    if (line !== undefined || line_statuses !== undefined || [1, 2, 3, 4, 5].some((i) => req.body[`L${i}_status`] !== undefined)) {
      data.line_statuses = nextStatuses;
    }

    const row = await prisma.dailyChecklistRow.update({
      where: { id: rowId },
      data
    });

    emitChecklists();
    res.json(row);
  } catch (error) {
    console.error('Error updating checklist row', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.dailyChecklist.findUnique({
      where: { id },
      include: { rows: { orderBy: { order: 'asc' } } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Checklist no encontrado' });
    }

    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: 'El checklist ya fue enviado o revisado' });
    }

    if (!existing.technician_id) {
      return res.status(403).json({
        error: 'Debes pulsar «Iniciar checklist» antes de enviar.',
      });
    }

    if (existing.technician_id !== userId) {
      return res.status(403).json({
        error: 'Solo el técnico que inició este checklist puede enviarlo.',
      });
    }

    const validation = validateChecklistForSubmit(
      existing.rows,
      existing.column_count ?? DEFAULT_CHECKLIST_COLUMNS
    );

    if (!validation.ok) {
      return res.status(400).json({
        error: validation.errorMessage,
        missing: validation.missing,
      });
    }

    const checklist = await prisma.$transaction(async (tx) => {
      const cols = existing.column_count ?? DEFAULT_CHECKLIST_COLUMNS;
      for (const row of existing.rows) {
        if (rowHasFailAnomaly(row, cols)) continue;
        if (row.observations == null || String(row.observations).trim() === '') {
          await tx.dailyChecklistRow.update({
            where: { id: row.id },
            data: { observations: 'N/A' },
          });
        }
      }

      return tx.dailyChecklist.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          technician_id: userId,
        },
        include: {
          rows: { orderBy: { order: 'asc' } },
          technician: { select: { name: true } },
          leader: { select: { name: true } },
        },
      });
    });

    emitChecklists();
    res.json(checklist);
  } catch (error) {
    console.error('Error submitting checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const reviewChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const checklist = await prisma.dailyChecklist.update({
      where: { id },
      data: { 
        status: 'REVIEWED',
        leader_id: userId
      }
    });

    emitChecklists();
    res.json(checklist);
  } catch (error) {
    console.error('Error reviewing checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getChecklistHistory = async (req: AuthRequest, res: Response) => {
  try {
    const checklists = await prisma.dailyChecklist.findMany({
      orderBy: { date: 'desc' },
      take: 30, // Get last 30 days
      include: {
        technician: { select: { name: true } },
        leader: { select: { name: true } },
      }
    });
    res.json(checklists);
  } catch (error) {
    console.error('Error fetching checklist history', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getChecklistById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const checklist = await prisma.dailyChecklist.findUnique({
      where: { id },
      include: {
        technician: { select: { name: true } },
        leader: { select: { name: true } },
        rows: {
          orderBy: { order: 'asc' }
        }
      }
    });
    
    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    res.json(checklist);
  } catch (error) {
    console.error('Error fetching checklist by id', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==========================================
// CONFIGURACIÓN DE ACTIVIDADES DEL CHECKLIST
// ==========================================

export const getChecklistConfig = async (_req: Request, res: Response) => {
  try {
    const column_count = await getConfiguredColumnCount();
    res.json({
      column_count,
      min: MIN_CHECKLIST_COLUMNS,
      max: MAX_CHECKLIST_COLUMNS,
    });
  } catch (error) {
    console.error('Error fetching checklist config', error);
    res.status(500).json({ error: 'Error al obtener la configuración del checklist' });
  }
};

export const updateChecklistConfig = async (req: Request, res: Response) => {
  try {
    if (req.body.column_count === undefined) {
      res.status(400).json({ error: 'Indica column_count' });
      return;
    }

    const column_count = normalizeChecklistColumnCount(req.body.column_count);
    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: { checklist_column_count: column_count },
      });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { checklist_column_count: column_count },
      });
    }

    emitChecklists();
    res.json({
      column_count: settings.checklist_column_count,
      min: MIN_CHECKLIST_COLUMNS,
      max: MAX_CHECKLIST_COLUMNS,
    });
  } catch (error) {
    console.error('Error updating checklist config', error);
    res.status(500).json({ error: 'Error al guardar la configuración del checklist' });
  }
};

export const getActivities = async (req: Request, res: Response) => {
  try {
    const activities = await prisma.checklistActivity.findMany({
      orderBy: { order: 'asc' }
    });
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener las actividades' });
  }
};

export const createActivity = async (req: Request, res: Response) => {
  try {
    const { name, is_active, field_type } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: 'El nombre es obligatorio' });
      return;
    }

    const allowedTypes = ['CHECKBOX', 'NUMBER', 'TEXT'];
    const resolvedType = allowedTypes.includes(field_type) ? field_type : 'CHECKBOX';

    // Find highest order
    const maxOrder = await prisma.checklistActivity.findFirst({
      orderBy: { order: 'desc' }
    });
    const nextOrder = maxOrder ? maxOrder.order + 1 : 1;

    const activity = await prisma.checklistActivity.create({
      data: {
        name: name.trim(),
        order: nextOrder,
        field_type: resolvedType,
        is_active: is_active !== undefined ? is_active : true
      }
    });
    emitChecklists();
    res.json(activity);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al crear la actividad' });
  }
};

export const updateActivity = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, is_active, field_type } = req.body;

    const data: { name?: string; is_active?: boolean; field_type?: string } = {};
    if (name !== undefined) data.name = name;
    if (is_active !== undefined) data.is_active = is_active;
    if (field_type !== undefined) {
      if (!['CHECKBOX', 'NUMBER', 'TEXT'].includes(field_type)) {
        res.status(400).json({ error: 'Tipo de campo inválido. Usa CHECKBOX, NUMBER o TEXT.' });
        return;
      }
      data.field_type = field_type;
    }

    const activity = await prisma.checklistActivity.update({
      where: { id },
      data
    });
    emitChecklists();
    res.json(activity);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al actualizar la actividad' });
  }
};

export const deleteActivity = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.checklistActivity.delete({
      where: { id }
    });
    emitChecklists();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al eliminar la actividad' });
  }
};

export const reorderActivities = async (req: Request, res: Response) => {
  try {
    // Expects an array of { id, order }
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'Formato inválido' });
    }

    // Actualizar en serie o usar transaccion
    await prisma.$transaction(
      orderedIds.map((item: { id: string; order: number }) =>
        prisma.checklistActivity.update({
          where: { id: item.id },
          data: { order: item.order }
        })
      )
    );

    emitChecklists();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al reordenar las actividades' });
  }
};

export const restoreDefaultActivities = async (req: Request, res: Response) => {
  try {
    const defaultActivities = [
      { name: 'Sistema de vacío (verificar presiones, ruido, sobrecalentamiento, humo)', type: 'CHECKBOX' },
      { name: 'Verificar que los equipos y periféricos estén completos', type: 'CHECKBOX' },
      { name: 'Verificar presión y caudal del sistema de agua (líneas generales y auxiliares)', type: 'CHECKBOX' },
      { name: 'Verificar los niveles de agua a las tinas de enfriamiento del cañón', type: 'CHECKBOX' },
      { name: 'Nivel de agua en bomba de anillo líquido', type: 'CHECKBOX' },
      { name: 'Inspección visual de todos los tableros eléctricos (puertas, ventiladores, lámparas)', type: 'CHECKBOX' },
      { name: 'Verificar correcto funcionamiento de las turbinas de alimentación de las máquinas', type: 'CHECKBOX' },
      { name: 'Verificar enfriamiento de minisplits en cuartos de control principales', type: 'CHECKBOX' },
      { name: 'Revisión de niveles de anticongelante a intercambiadores de calor de calandras', type: 'CHECKBOX' },
      { name: 'Revisión del correcto funcionamiento de los molinos de refil', type: 'CHECKBOX' },
      { name: 'Verificar funcionamiento del sistema de autollenado para silicón o antiestático', type: 'CHECKBOX' },
      { name: 'Inspección de presencia de fugas de aceite en todos los sistemas hidráulicos', type: 'CHECKBOX' },
      { name: 'Inspección de presencia de fugas de aire en todos los sistemas neumáticos', type: 'CHECKBOX' },
      { name: 'Verificar ruidos o sonidos anormales de baleros, rodillos, chumaceras y motores', type: 'CHECKBOX' },
      { name: 'Temperatura del estator del motor principal', type: 'NUMBER' },
      { name: 'Temperatura de la tapa frontal del motor principal', type: 'NUMBER' },
      { name: 'Temperatura de caja del balero de carga en las revolvedoras y lubricar balero inferior', type: 'NUMBER' },
      { name: 'Verificar nivel de agua en torres de enfriamiento, purgas habilitadas y tanque de salmuera', type: 'CHECKBOX' },
      { name: 'Verificación de fugas en sellos mecánicos de bombas y tuberías en general', type: 'CHECKBOX' },
      { name: 'Verificación del correcto funcionamiento de los compresores, purgar', type: 'CHECKBOX' },
      { name: 'Tomar lecturas del estado del agua de las torres de enfriamiento', type: 'TEXT' },
      { name: 'Verificación del estado y limpieza del área de residuos peligrosos', type: 'CHECKBOX' },
      { name: 'Revisar correcto funcionamiento del equipo de osmosis inversa y nivel de agua', type: 'CHECKBOX' },
      { name: 'Revisión de orden y limpieza del cuarto de productos químicos', type: 'CHECKBOX' },
      { name: 'Revisión de orden y limpieza del taller', type: 'CHECKBOX' },
      { name: 'Revisar equipos tengan sus guardas (acrílicos, tapas, rejas) instaladas', type: 'CHECKBOX' },
      { name: 'Revisión visual del cable del polipasto (que no se encuentren filamentos rotos)', type: 'CHECKBOX' },
      { name: 'Revisar las canaletas de cableado cuenten con sus tapas puestas y fijas', type: 'CHECKBOX' }
    ];

    await prisma.checklistActivity.deleteMany({});
    
    await prisma.checklistActivity.createMany({
      data: defaultActivities.map((act, index) => ({
        name: act.name,
        order: index + 1,
        field_type: act.type,
        is_active: true
      }))
    });

    const newActivities = await prisma.checklistActivity.findMany({
      orderBy: { order: 'asc' }
    });

    emitChecklists();
    res.json(newActivities);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al restaurar las actividades' });
  }
};
