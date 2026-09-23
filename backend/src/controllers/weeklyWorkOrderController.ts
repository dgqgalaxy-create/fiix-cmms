import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware';
import { freezeWeeklyPlan, getWeeklyReport, saveWeeklyCut } from '../services/weeklyWorkOrderService';
import { plantYmd, weeklyRange } from '../services/weeklyWorkOrderMetrics';

function readWeek(value: unknown) {
  return weeklyRange(value === undefined ? plantYmd(new Date()) : String(value)).key;
}
function fail(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/^(Fecha de semana inválida|Solo se puede|Corte no encontrado)/.test(message)) {
    res.status(400).json({ error: message });
  } else {
    console.error('Error en avance semanal', error);
    res.status(500).json({ error: 'No se pudo cargar o guardar el avance semanal.' });
  }
}
export async function weeklyReport(req: AuthRequest, res: Response) {
  try {
    const zones = typeof req.query.zoneIds === 'string' ? req.query.zoneIds.split(',').filter(Boolean) : [];
    const cut = typeof req.query.cutId === 'string' ? req.query.cutId : undefined;
    res.json(await getWeeklyReport(readWeek(req.query.week), zones, cut));
  } catch (error) { fail(res, error); }
}
export async function weeklyFreeze(req: AuthRequest, res: Response) {
  try {
    const plan = await freezeWeeklyPlan(readWeek(req.body.week), req.user!.userId);
    res.json({ week: plan.week_start });
  } catch (error) { fail(res, error); }
}
export async function weeklyCut(req: AuthRequest, res: Response) {
  try {
    const cut = await saveWeeklyCut(readWeek(req.body.week), req.user!.userId, 'MANUAL');
    res.status(201).json({ id: cut.id });
  } catch (error) { fail(res, error); }
}
