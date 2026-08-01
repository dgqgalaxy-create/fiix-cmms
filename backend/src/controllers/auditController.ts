import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import type { AuthRequest } from '../middlewares/authMiddleware';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseOptionalYmd(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  if (!YMD_RE.test(s)) return null;
  return s;
}

/** Límites inclusivos del día civil en America/Mexico_City → UTC. */
function mexicoCityDayBounds(ymd: string, endOfDay: boolean): Date {
  // Mediodía UTC como ancla; luego desplazamos con el offset real de ese día en MX.
  const probe = new Date(`${ymd}T12:00:00.000Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    timeZoneName: 'longOffset',
  }).formatToParts(probe);
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT-06:00';
  const m = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  let offsetMinutes = -6 * 60;
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    const hh = Number(m[2]);
    const mm = Number(m[3] || '0');
    offsetMinutes = sign * (hh * 60 + mm);
  }
  // Queremos ymd 00:00:00.000 (o 23:59:59.999) en México → UTC = local - offset
  // Si offset es GMT-06, Mexico = UTC-6, so UTC = local + 6h = local - offsetMinutes when offsetMinutes=-360
  // UTC = localWall - offsetMinutes*60000 where offsetMinutes is the signed offset from UTC
  // local 00:00 with offset -360 → UTC = 00:00 - (-360min) = 06:00 UTC
  const [y, mo, d] = ymd.split('-').map(Number);
  const localAsUtcMs = Date.UTC(y, mo - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return new Date(localAsUtcMs - offsetMinutes * 60_000);
}

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

/**
 * Exporta la bitácora completa (sin tope de filas) o filtrada por periodo (días civiles México).
 * Responde JSON para que el cliente genere Excel (.xlsx).
 * Query: from=YYYY-MM-DD, to=YYYY-MM-DD (ambos opcionales; si faltan → histórico completo).
 */
export const exportAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const from = parseOptionalYmd(req.query.from);
    const to = parseOptionalYmd(req.query.to);

    if (req.query.from != null && String(req.query.from).trim() && !from) {
      res.status(400).json({ error: 'from debe ser YYYY-MM-DD' });
      return;
    }
    if (req.query.to != null && String(req.query.to).trim() && !to) {
      res.status(400).json({ error: 'to debe ser YYYY-MM-DD' });
      return;
    }
    if (from && to && from > to) {
      res.status(400).json({ error: 'La fecha inicial no puede ser posterior a la final' });
      return;
    }

    const created_at: Prisma.DateTimeFilter = {};
    if (from) created_at.gte = mexicoCityDayBounds(from, false);
    if (to) created_at.lte = mexicoCityDayBounds(to, true);

    const where: Prisma.AuditLogWhereInput =
      Object.keys(created_at).length > 0 ? { created_at } : {};

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    res.json({
      from: from || null,
      to: to || null,
      count: logs.length,
      rows: logs,
    });
  } catch (error) {
    console.error('exportAuditLogs:', error);
    res.status(500).json({ error: 'Error al exportar la bitácora' });
  }
};
