import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * Bitácora de una OT: une en una sola línea de tiempo lo que ya existe en la
 * base (comentarios, auditoría de cambios, repuestos y fotos) sin duplicar datos.
 */
export const getWorkOrderTimeline = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const wo = await prisma.workOrder.findUnique({
      where: { id },
      select: {
        id: true,
        folio: true,
        title: true,
        status: true,
        created_at: true,
        priority: true,
        created_by: { select: { name: true } },
        asset: { select: { name: true, internal_code: true } },
        request_image_url: true,
        before_image_url: true,
        after_image_url: true,
      },
    });

    if (!wo) {
      res.status(404).json({ error: 'Orden de trabajo no encontrada' });
      return;
    }

    const [comments, audits, txs] = await Promise.all([
      prisma.workOrderComment.findMany({
        where: { work_order_id: id },
        include: { author: { select: { name: true } } },
        orderBy: { created_at: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: { entity: { in: ['WorkOrder', 'work_order', 'WorkOrderStatus'] }, entity_id: id },
        orderBy: { created_at: 'asc' },
      }),
      prisma.inventoryTransaction.findMany({
        where: { work_order_id: id },
        include: {
          item: { select: { name: true, internal_code: true, uom: true } },
          user: { select: { name: true } },
        },
        orderBy: { created_at: 'asc' },
      }),
    ]);

    type Event = {
      id: string;
      at: string;
      kind: 'created' | 'comment' | 'status' | 'update' | 'part' | 'photo';
      title: string;
      detail?: string | null;
      actor?: string | null;
      attachment_url?: string | null;
      attachment_name?: string | null;
    };

    const events: Event[] = [];

    events.push({
      id: 'created',
      at: wo.created_at.toISOString(),
      kind: 'created',
      title: 'Orden creada',
      detail: `OT-${wo.folio} · ${wo.title}`,
      actor: wo.created_by?.name ?? null,
    });

    // Fotos de solicitud / antes / después, si existen.
    const photos: Array<[string, string | null]> = [
      ['Foto de la solicitud', wo.request_image_url],
      ['Foto del "antes"', wo.before_image_url],
      ['Foto del "después"', wo.after_image_url],
    ];
    for (const [label, url] of photos) {
      if (!url) continue;
      events.push({
        id: `photo-${label}`,
        at: wo.created_at.toISOString(),
        kind: 'photo',
        title: label,
        attachment_url: url,
      });
    }

    for (const comment of comments) {
      events.push({
        id: `comment-${comment.id}`,
        at: comment.created_at.toISOString(),
        kind: 'comment',
        title: comment.author?.name ? `Comentario de ${comment.author.name}` : 'Comentario',
        detail: comment.body,
        actor: comment.author?.name ?? null,
        attachment_url: comment.attachment_url,
        attachment_name: comment.attachment_name,
      });
    }

    for (const audit of audits) {
      const isStatus = /STATUS/i.test(audit.action);
      events.push({
        id: `audit-${audit.id}`,
        at: audit.created_at.toISOString(),
        kind: isStatus ? 'status' : 'update',
        title: isStatus ? 'Cambio de estado' : 'Actualización de la orden',
        detail: audit.summary,
        actor: audit.user_name ?? null,
      });
    }

    for (const tx of txs) {
      const sign = tx.amount > 0 ? 'entregado' : 'devuelto';
      events.push({
        id: `tx-${tx.id}`,
        at: tx.created_at.toISOString(),
        kind: 'part',
        title: `Repuesto ${sign}: ${tx.item?.name ?? '—'}`,
        detail: `${Math.abs(tx.amount)} ${tx.item?.uom ?? ''}`.trim() + (tx.reason ? ` · ${tx.reason}` : ''),
        actor: tx.user?.name ?? null,
      });
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    res.json({
      work_order: {
        id: wo.id,
        folio: wo.folio,
        title: wo.title,
        status: wo.status,
        asset: wo.asset,
      },
      events,
    });
  } catch (error) {
    console.error('Error obteniendo la bitácora de la OT:', error);
    res.status(500).json({ error: 'No se pudo obtener la bitácora de la orden' });
  }
};
