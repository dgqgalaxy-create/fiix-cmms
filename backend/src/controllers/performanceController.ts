import type { Request, Response } from 'express';
import prisma from '../config/prisma';
import type { AuthRequest } from '../middlewares/authMiddleware';
import { writeAuditLog } from '../utils/auditLog';
import {
  DEFAULT_PERFORMANCE_CONFIG,
  normalizePerformanceConfig,
  type PerformanceCompare,
} from '../utils/performanceConfig';
import { computeTeamReport } from '../services/performanceService';

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** GET /api/performance/settings — parámetros vigentes (todos los roles leen). */
export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.systemSettings.findFirst({
      select: { performance_config: true, updated_at: true },
    });
    res.json({
      config: normalizePerformanceConfig(settings?.performance_config),
      updated_at: settings?.updated_at ? settings.updated_at.toISOString() : null,
      is_default: !settings?.performance_config,
    });
  } catch (error) {
    console.error('[performance] getSettings', error);
    res.status(500).json({ error: 'No se pudo cargar la configuración de desempeño' });
  }
};

/** PUT /api/performance/settings — solo Administrador + contraseña de desarrollador. */
export const saveSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'ADMINISTRADOR') {
      res.status(403).json({ error: 'Solo un administrador puede cambiar los parámetros de desempeño.' });
      return;
    }

    const config = normalizePerformanceConfig(req.body?.config ?? req.body);
    const settings = await prisma.systemSettings.findFirst();
    const before = settings?.performance_config ?? null;

    if (settings) {
      await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { performance_config: config as unknown as object },
      });
    } else {
      await prisma.systemSettings.create({
        data: { performance_config: config as unknown as object },
      });
    }

    await writeAuditLog({
      userId: req.user?.userId ?? null,
      userName: null,
      action: 'PERFORMANCE_SETTINGS_UPDATED',
      entity: 'system_settings',
      entityId: settings?.id ?? null,
      summary: `Parámetros de «Desempeño del equipo» actualizados (modo ${config.mode}, comparación ${config.compare === 'shift' ? 'por turno' : 'global'}, muestra mínima ${config.min_sample}).`,
      meta: { before: before as unknown as object, after: config as unknown as object },
    });

    res.json({ message: 'Parámetros guardados', config });
  } catch (error) {
    console.error('[performance] saveSettings', error);
    res.status(500).json({ error: 'No se pudieron guardar los parámetros de desempeño' });
  }
};

/** POST /api/performance/settings/reset — vuelve a los valores sugeridos. */
export const resetSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'ADMINISTRADOR') {
      res.status(403).json({ error: 'Solo un administrador puede restaurar los parámetros.' });
      return;
    }
    const config = normalizePerformanceConfig(DEFAULT_PERFORMANCE_CONFIG);
    const settings = await prisma.systemSettings.findFirst();
    if (settings) {
      await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { performance_config: config as unknown as object },
      });
    } else {
      await prisma.systemSettings.create({
        data: { performance_config: config as unknown as object },
      });
    }

    await writeAuditLog({
      userId: req.user?.userId ?? null,
      userName: null,
      action: 'PERFORMANCE_SETTINGS_RESET',
      entity: 'system_settings',
      entityId: settings?.id ?? null,
      summary: 'Parámetros de «Desempeño del equipo» restaurados a los valores sugeridos.',
      meta: { after: config as unknown as object },
    });

    res.json({ message: 'Valores restaurados', config });
  } catch (error) {
    console.error('[performance] resetSettings', error);
    res.status(500).json({ error: 'No se pudieron restaurar los parámetros' });
  }
};

/** POST /api/performance/team/preview — calcula con parámetros sin guardarlos. */
export const previewTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = normalizePerformanceConfig(req.body?.config);
    const days = Math.min(365, Math.max(7, Number(req.body?.period ?? config.period_days) || config.period_days));
    const compare: PerformanceCompare = req.body?.compare === 'all' ? 'all' : req.body?.compare === 'shift' ? 'shift' : config.compare;
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY_MS);
    const settings = await prisma.systemSettings.findFirst({ select: { time_zone: true } });

    const report = await computeTeamReport({
      from,
      to,
      compare,
      configOverride: config,
      timeZone: settings?.time_zone || 'America/Mexico_City',
    });
    res.json(report);
  } catch (error) {
    console.error('[performance] previewTeam', error);
    res.status(500).json({ error: 'No se pudo previsualizar el desempeño del equipo' });
  }
};

/** GET /api/performance/team — tablero comparativo. */
export const getTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.systemSettings.findFirst({
      select: { performance_config: true, time_zone: true },
    });
    const config = normalizePerformanceConfig(settings?.performance_config);

    const periodDays = Number(req.query.period ?? config.period_days);
    const days = Number.isFinite(periodDays) ? Math.min(365, Math.max(7, periodDays)) : config.period_days;

    const to = parseDate(req.query.to) ?? new Date();
    const toEnd = new Date(to.getTime() + (req.query.to ? DAY_MS - 1 : 0));
    const from = parseDate(req.query.from) ?? new Date(toEnd.getTime() - days * DAY_MS);

    const compare: PerformanceCompare = req.query.compare === 'all' ? 'all' : req.query.compare === 'shift' ? 'shift' : config.compare;

    const report = await computeTeamReport({
      from,
      to: toEnd,
      compare,
      configOverride: config,
      timeZone: settings?.time_zone || 'America/Mexico_City',
    });

    res.json(report);
  } catch (error) {
    console.error('[performance] getTeam', error);
    res.status(500).json({ error: 'No se pudo calcular el desempeño del equipo' });
  }
};
