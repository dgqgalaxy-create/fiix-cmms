import { Response } from 'express';
import prisma from '../config/prisma';
import type { AuthRequest } from '../middlewares/authMiddleware';

export const listAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 50;
    const entity = typeof req.query.entity === 'string' ? req.query.entity.trim() : '';

    const logs = await prisma.auditLog.findMany({
      where: entity ? { entity } : undefined,
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    res.json(logs);
  } catch (error) {
    console.error('listAuditLogs:', error);
    res.status(500).json({ error: 'Error al listar la bitácora' });
  }
};
