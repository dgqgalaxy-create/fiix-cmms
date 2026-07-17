import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { parseWorkOrderFolio } from '../utils/folio';

const LIMIT_PER_TYPE = 6;

export const globalSearch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 1) {
      res.json({ assets: [], items: [], locations: [], work_orders: [] });
      return;
    }

    const folioNum = parseWorkOrderFolio(q);

    const [assets, items, locations, work_orders] = await Promise.all([
      prisma.asset.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { internal_code: { contains: q, mode: 'insensitive' } },
            { brand: { contains: q, mode: 'insensitive' } },
            { model: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: LIMIT_PER_TYPE,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          internal_code: true,
          status: true,
          zone: { select: { name: true } },
        },
      }),
      prisma.item.findMany({
        where: {
          is_active: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { internal_code: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: LIMIT_PER_TYPE,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          internal_code: true,
          stock: true,
          uom: true,
          location: { select: { name: true } },
        },
      }),
      prisma.itemLocation.findMany({
        where: {
          is_active: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { internal_id: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: LIMIT_PER_TYPE,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, internal_id: true },
      }),
      prisma.workOrder.findMany({
        where: {
          OR: [
            ...(folioNum != null ? [{ folio: folioNum }] : []),
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: LIMIT_PER_TYPE,
        orderBy: { folio: 'desc' },
        select: {
          id: true,
          folio: true,
          title: true,
          status: true,
          asset: { select: { name: true, internal_code: true } },
        },
      }),
    ]);

    res.json({ assets, items, locations, work_orders });
  } catch (error) {
    console.error('Error in global search', error);
    res.status(500).json({ error: 'Error al buscar' });
  }
};
