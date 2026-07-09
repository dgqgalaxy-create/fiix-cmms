import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../config/prisma';

export const getTodayChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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

    const checklist = await prisma.dailyChecklist.create({
      data: {
        date: today,
        technician_id: userId,
        status: 'DRAFT',
        rows: {
          create: activities.map(act => ({
            activity_name: act.name,
            order: act.order,
          }))
        }
      },
      include: {
        rows: {
          orderBy: { order: 'asc' }
        }
      }
    });

    res.json(checklist);
  } catch (error) {
    console.error('Error creating today checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateChecklistRow = async (req: AuthRequest, res: Response) => {
  try {
    const rowId = req.params.rowId as string;
    const { L1_status, L2_status, L3_status, L4_status, L5_status, observations } = req.body;

    const row = await prisma.dailyChecklistRow.update({
      where: { id: rowId },
      data: { L1_status, L2_status, L3_status, L4_status, L5_status, observations }
    });

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

    const checklist = await prisma.dailyChecklist.update({
      where: { id },
      data: { 
        status: 'COMPLETED',
        technician_id: userId // ensure the person submitting is recorded
      }
    });

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
    const { name, is_active } = req.body;
    // Find highest order
    const maxOrder = await prisma.checklistActivity.findFirst({
      orderBy: { order: 'desc' }
    });
    const nextOrder = maxOrder ? maxOrder.order + 1 : 1;

    const activity = await prisma.checklistActivity.create({
      data: {
        name,
        order: nextOrder,
        is_active: is_active !== undefined ? is_active : true
      }
    });
    res.json(activity);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al crear la actividad' });
  }
};

export const updateActivity = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, is_active } = req.body;

    const activity = await prisma.checklistActivity.update({
      where: { id },
      data: { name, is_active }
    });
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

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al reordenar las actividades' });
  }
};

export const restoreDefaultActivities = async (req: Request, res: Response) => {
  try {
    const defaultActivities = [
      'Sistema de vacío (verificar presiones, ruido, sobrecalentamiento, humo)',
      'Verificar que los equipos y periféricos estén completos',
      'Verificar presión y caudal del sistema de agua (líneas generales y auxiliares)',
      'Verificar los niveles de agua a las tinas de enfriamiento del cañón',
      'Nivel de agua en bomba de anillo líquido',
      'Inspección visual de todos los tableros eléctricos (puertas, ventiladores, lámparas)',
      'Verificar correcto funcionamiento de las turbinas de alimentación de las máquinas',
      'Verificar enfriamiento de minisplits en cuartos de control principales',
      'Revisión de niveles de anticongelante a intercambiadores de calor de calandras',
      'Revisión del correcto funcionamiento de los molinos de refil',
      'Verificar funcionamiento del sistema de autollenado para silicón o antiestático',
      'Inspección de presencia de fugas de aceite en todos los sistemas hidráulicos',
      'Inspección de presencia de fugas de aire en todos los sistemas neumáticos',
      'Verificar ruidos o sonidos anormales de baleros, rodillos, chumaceras y motores',
      'Temperatura del estator del motor principal',
      'Temperatura de la tapa frontal del motor principal',
      'Temperatura de caja del balero de carga en las revolvedoras y lubricar balero inferior',
      'Verificar nivel de agua en torres de enfriamiento, purgas habilitadas y tanque de salmuera',
      'Verificación de fugas en sellos mecánicos de bombas y tuberías en general',
      'Verificación del correcto funcionamiento de los compresores, purgar',
      'Tomar lecturas del estado del agua de las torres de enfriamiento',
      'Verificación del estado y limpieza del área de residuos peligrosos',
      'Revisar correcto funcionamiento del equipo de osmosis inversa y nivel de agua',
      'Revisión de orden y limpieza del cuarto de productos químicos',
      'Revisión de orden y limpieza del taller',
      'Revisar equipos tengan sus guardas (acrílicos, tapas, rejas) instaladas',
      'Revisión visual del cable del polipasto (que no se encuentren filamentos rotos)',
      'Revisar las canaletas de cableado cuenten con sus tapas puestas y fijas'
    ];

    await prisma.checklistActivity.deleteMany({});
    
    await prisma.checklistActivity.createMany({
      data: defaultActivities.map((name, index) => ({
        name,
        order: index + 1,
        is_active: true
      }))
    });

    const newActivities = await prisma.checklistActivity.findMany({
      orderBy: { order: 'asc' }
    });

    res.json(newActivities);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al restaurar las actividades' });
  }
};
