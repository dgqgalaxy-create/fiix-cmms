import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

// Public status only. Search terms never expand the returned fields.
export const requestTrackingSelect = { folio: true, status: true } satisfies Prisma.WorkOrderSelect;

export function trackingQuery(query: Request['query']) {
  const read = (key: string) => {
    const value = query[key];
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > 150) throw new Error('Parámetros de búsqueda inválidos.');
    return value.trim();
  };
  const folio = read('folio');
  const zone = read('zone');
  const requester = read('requester');
  const pageRaw = read('page') || '1';
  if (!folio && !zone && !requester) throw new Error('Busca por folio, zona o nombre del solicitante.');
  if (!/^\d+$/.test(pageRaw) || Number(pageRaw) < 1 || Number(pageRaw) > 10000) throw new Error('Página inválida.');
  const where: Prisma.WorkOrderWhereInput = {};
  if (folio) {
    const match = folio.replace(/[–—−]/g, '-').replace(/\s+/g, '').match(/^(?:(?:FOL|WO)-?)?(\d+)$/i);
    const number = match ? Number(match[1]) : 0;
    if (!Number.isSafeInteger(number) || number < 1 || number > 2147483647) throw new Error('Escribe un folio válido, por ejemplo FOL-0042.');
    where.folio = number;
  }
  if (zone) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(zone)) throw new Error('Selecciona una zona válida.');
    where.zone_id = zone;
  }
  if (requester) {
    if (requester.length < 2) throw new Error('Escribe al menos dos caracteres del nombre.');
    where.requester_name = { contains: requester, mode: 'insensitive' };
  }
  return { where, page: Number(pageRaw), pageSize: 20 };
}

export async function getRequestTracking(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  let params;
  try { params = trackingQuery(req.query); }
  catch (error) {
    res.status(400).json({ error: (error as Error).message });
    return;
  }
  try {
    const { where, page, pageSize } = params;
    const [total, requests] = await prisma.$transaction([
      prisma.workOrder.count({ where }),
      prisma.workOrder.findMany({
        where, select: requestTrackingSelect,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    res.json({ requests, total, page, pageSize });
  } catch (error) {
    console.error('Error consulting public request status:', error);
    res.status(500).json({ error: 'No se pudo consultar el estado. Intenta nuevamente.' });
  }
}
