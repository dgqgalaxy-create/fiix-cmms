import { Request, Response } from 'express';
import prisma from '../config/prisma';

const RELATION_TYPES = ['RELACIONADA', 'DUPLICADA', 'BLOQUEA', 'CAUSA'] as const;
type RelationType = (typeof RELATION_TYPES)[number];

/** Tipos de relación vistos desde la OT que consulta (la inversa cambia de nombre). */
const inverseLabel: Record<RelationType, string> = {
  RELACIONADA: 'RELACIONADA',
  DUPLICADA: 'DUPLICADA',
  BLOQUEA: 'BLOQUEADA_POR',
  CAUSA: 'CAUSADA_POR',
};

const summarySelect = {
  id: true,
  folio: true,
  title: true,
  status: true,
  priority: true,
  asset: { select: { id: true, name: true, internal_code: true } },
} as const;

/**
 * GET /api/work-orders/:id/relations
 * Devuelve las relaciones en ambas direcciones, ya normalizadas para la OT consultada.
 */
export const getWorkOrderRelations = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const [outgoing, incoming] = await Promise.all([
      prisma.workOrderRelation.findMany({
        where: { work_order_id: id },
        include: { related_work_order: { select: summarySelect }, created_by: { select: { name: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.workOrderRelation.findMany({
        where: { related_work_order_id: id },
        include: { work_order: { select: summarySelect }, created_by: { select: { name: true } } },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const rows = [
      ...outgoing.map((relation) => ({
        id: relation.id,
        direction: 'out' as const,
        relation_type: relation.relation_type,
        relation_label: relation.relation_type,
        note: relation.note,
        created_at: relation.created_at,
        created_by: relation.created_by?.name ?? null,
        work_order: relation.related_work_order,
        editable: true,
      })),
      ...incoming.map((relation) => ({
        id: relation.id,
        direction: 'in' as const,
        relation_type: relation.relation_type,
        relation_label: inverseLabel[relation.relation_type] ?? relation.relation_type,
        note: relation.note,
        created_at: relation.created_at,
        created_by: relation.created_by?.name ?? null,
        work_order: relation.work_order,
        // Solo el lado que la creó puede eliminarla; desde el otro lado se muestra.
        editable: false,
      })),
    ];

    res.json(rows);
  } catch (error) {
    console.error('Error listando relaciones de OT:', error);
    res.status(500).json({ error: 'No se pudieron obtener las relaciones' });
  }
};

/** POST /api/work-orders/:id/relations — { related_folio | related_work_order_id, relation_type, note } */
export const createWorkOrderRelation = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { related_work_order_id, related_folio, relation_type, note } = req.body ?? {};

    const type = String(relation_type || 'RELACIONADA').toUpperCase() as RelationType;
    if (!RELATION_TYPES.includes(type)) {
      res.status(400).json({ error: `Tipo inválido. Usa: ${RELATION_TYPES.join(', ')}` });
      return;
    }

    const current = await prisma.workOrder.findUnique({ where: { id }, select: { id: true, folio: true } });
    if (!current) {
      res.status(404).json({ error: 'Orden de trabajo no encontrada' });
      return;
    }

    let target = null;
    if (related_work_order_id) {
      target = await prisma.workOrder.findUnique({ where: { id: String(related_work_order_id) }, select: { id: true, folio: true } });
    } else if (related_folio != null && String(related_folio).trim() !== '') {
      const folio = Number(related_folio);
      if (!Number.isFinite(folio)) {
        res.status(400).json({ error: 'El folio debe ser un número.' });
        return;
      }
      target = await prisma.workOrder.findFirst({ where: { folio }, select: { id: true, folio: true } });
    }

    if (!target) {
      res.status(404).json({ error: 'No se encontró la orden que quieres relacionar.' });
      return;
    }
    if (target.id === id) {
      res.status(400).json({ error: 'No puedes relacionar una orden consigo misma.' });
      return;
    }

    const existing = await prisma.workOrderRelation.findFirst({
      where: { work_order_id: id, related_work_order_id: target.id, relation_type: type },
    });
    if (existing) {
      res.status(409).json({ error: `La orden OT-${target.folio} ya está relacionada con ese tipo.` });
      return;
    }

    const created = await prisma.workOrderRelation.create({
      data: {
        work_order_id: id,
        related_work_order_id: target.id,
        relation_type: type,
        note: typeof note === 'string' ? note.trim().slice(0, 200) || null : null,
        created_by_id: (req as any).user?.userId ?? null,
      },
      include: { related_work_order: { select: summarySelect } },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creando relación de OT:', error);
    res.status(500).json({ error: 'No se pudo crear la relación' });
  }
};

/** DELETE /api/work-orders/:id/relations/:relationId */
export const deleteWorkOrderRelation = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const relationId = req.params.relationId as string;

    const relation = await prisma.workOrderRelation.findUnique({ where: { id: relationId } });
    if (!relation || (relation.work_order_id !== id && relation.related_work_order_id !== id)) {
      res.status(404).json({ error: 'Relación no encontrada' });
      return;
    }

    await prisma.workOrderRelation.delete({ where: { id: relationId } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando relación de OT:', error);
    res.status(500).json({ error: 'No se pudo eliminar la relación' });
  }
};

/** GET /api/work-orders/:id/relations/search?folio= — autocompletar por folio. */
export const searchWorkOrdersForRelation = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const raw = String(req.query.folio ?? '').trim();
    if (!raw) {
      res.json([]);
      return;
    }

    const rows = await prisma.workOrder.findMany({
      where: {
        id: { not: id },
        ...(Number.isFinite(Number(raw))
          ? { OR: [{ folio: Number(raw) }, { title: { contains: raw, mode: 'insensitive' } }] }
          : { title: { contains: raw, mode: 'insensitive' } }),
      },
      select: summarySelect,
      take: 10,
      orderBy: { created_at: 'desc' },
    });
    res.json(rows);
  } catch (error) {
    console.error('Error buscando órdenes para relacionar:', error);
    res.status(500).json({ error: 'No se pudo buscar' });
  }
};
