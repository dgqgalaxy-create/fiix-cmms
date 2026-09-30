import { incidentTypes, timedTypes, intervalMinutes, timeRange, overlaps } from '../utils/rosterHours';
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';
import { parseDateInput } from '../utils/parseDateInput';
import { parseRosterWorkbook, applyRosterImport } from '../utils/rosterImport';

export const getRoster = async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;
    
    const patterns = await prisma.technicianPattern.findMany({
      include: {
        user: { select: { id: true, name: true, role: true } }
      }
    });

    const rangeStart = start ? rosterDate(start) ?? undefined : undefined;
    const rangeEnd = end ? rosterDate(end) ?? undefined : undefined;
    if ((start && !rangeStart) || (end && !rangeEnd)) { res.status(400).json({ error: 'Rango de fechas inválido.' }); return; }

    const exceptions = await prisma.technicianException.findMany({
      where: {
        date: {
          gte: rangeStart,
          lte: rangeEnd,
        }
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    const shifts = await prisma.technicianShift.findMany({
      where: {
        date: {
          gte: rangeStart,
          lte: rangeEnd,
        }
      },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { date: 'asc' }
    });

    const technicians = await prisma.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' }
    });

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      }
    });

    res.json({ patterns, exceptions, shifts, technicians, holidays });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Importa el calendario anual de turnos desde un .xlsx (reemplaza el rango importado). */
export const importRosterCalendar = async (req: Request, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file?.buffer) {
      res.status(400).json({ message: 'Adjunta el archivo .xlsx del calendario de turnos.' });
      return;
    }

    const createMissing =
      String((req.body as any)?.createMissing || '').toLowerCase() === 'true' ||
      String((req.body as any)?.createMissing || '') === '1';

    const parsed = parseRosterWorkbook(file.buffer);
    const summary = await applyRosterImport(parsed, { createMissing });

    emitRefresh('refresh_roster');
    res.json({ success: true, summary, sheetName: parsed.sheetName });
  } catch (error: any) {
    console.error('Roster import error:', error);
    const message =
      error instanceof Error ? error.message : 'Error importando el calendario de turnos.';
    res.status(400).json({ message });
  }
};

export const assignPattern = async (req: Request, res: Response) => {
  try {
    const { user_id, pattern_type, start_date } = req.body;
    
    const start = parseDateInput(start_date);
    if (!start) {
      res.status(400).json({ error: 'Fecha de inicio inválida' });
      return;
    }

    const pattern = await prisma.technicianPattern.upsert({
      where: { user_id },
      update: { pattern_type, start_date: start },
      create: { user_id, pattern_type, start_date: start }
    });
    
    emitRefresh('refresh_roster');
    res.json(pattern);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @db.Date values are stored at UTC midnight; plant-noon bounds exclude the first day.
const rosterDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
};
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
class RosterInputError extends Error {}
const rosterError = (res: Response, error: unknown) => {
  if (error instanceof RosterInputError) { res.status(400).json({ error: error.message }); return; }
  console.error(error);
  res.status(500).json({ error: 'No se pudo guardar el horario.' });
};

export const getTimeDebts = async (_req: Request, res: Response) => {
  try {
    const debts = await prisma.technicianTimeDebt.findMany({ include: { payments: { orderBy: { date: 'asc' } } }, orderBy: { date: 'desc' } });
    res.json(debts.map(debt => {
      const paid_minutes = debt.payments.reduce((sum, item) => sum + (item.paid_minutes || 0), 0);
      return { ...debt, paid_minutes, remaining_minutes: debt.total_minutes - paid_minutes };
    }));
  } catch (error) { rosterError(res, error); }
};

export const createTimeDebt = async (req: Request, res: Response) => {
  try {
    const { user_id, date, total_minutes, notes } = req.body;
    const day = rosterDate(date);
    if (!uuid(user_id) || !day || !Number.isInteger(total_minutes) || total_minutes <= 0 || total_minutes > 525600) throw new RosterInputError('Indica persona, fecha y horas adeudadas válidas.');
    if (notes != null && (typeof notes !== 'string' || notes.length > 2000)) throw new RosterInputError('Notas inválidas (máximo 2000 caracteres).');
    const person = await prisma.user.findUnique({ where: { id: user_id } });
    if (!person?.is_active) throw new RosterInputError('Selecciona una persona activa.');
    const debt = await prisma.technicianTimeDebt.create({ data: { user_id, date: day, total_minutes, notes } });
    emitRefresh('refresh_roster');
    res.status(201).json(debt);
  } catch (error) { rosterError(res, error); }
};

export const addException = async (req: Request, res: Response) => {
  try {
    const { user_id, date, exception_type, notes, start_time, end_time, time_debt_id } = req.body;
    const day = rosterDate(date);
    if (!uuid(user_id) || !day || !incidentTypes.has(exception_type)) throw new RosterInputError('Persona, fecha o incidencia inválida.');
    if (notes != null && (typeof notes !== 'string' || notes.length > 2000)) throw new RosterInputError('Notas inválidas (máximo 2000 caracteres).');
    const timed = timedTypes.has(exception_type);
    const minutes = timed ? intervalMinutes(start_time, end_time) : null;
    if (timed && minutes === null) throw new RosterInputError('Selecciona entrada y salida distintas, en formato HH:mm.');
    const payment = exception_type === 'TIEMPO_POR_TIEMPO';
    if (payment && !uuid(time_debt_id)) throw new RosterInputError('Selecciona la deuda a la que se abonarán las horas.');
    if (!payment && time_debt_id) throw new RosterInputError('Solo Tiempo por tiempo permite abonar a una deuda.');
    if (!timed && (start_time || end_time)) throw new RosterInputError('Esta incidencia no admite horas de entrada y salida.');
    const exception = await prisma.$transaction(async tx => {
      // Serialize entries per person to prevent overlapping or duplicate payments.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user_id}::uuid FOR UPDATE`;
      const person = await tx.user.findUnique({ where: { id: user_id } });
      if (!person?.is_active) throw new RosterInputError('Selecciona una persona activa.');
      if (timed) {
        const entries = await tx.technicianException.findMany({ where: { user_id, date: { gte: new Date(day.getTime() - 86400000), lte: new Date(day.getTime() + 86400000) }, start_time: { not: null }, end_time: { not: null } } });
        const range = timeRange(day, start_time, end_time);
        if (entries.some(item => overlaps(range, timeRange(item.date, item.start_time!, item.end_time!)))) throw new RosterInputError('El horario se cruza con otro tiempo extra o abono registrado.');
      }
      if (payment) {
        const debt = await tx.technicianTimeDebt.findUnique({ where: { id: time_debt_id }, include: { payments: true } });
        if (!debt || debt.user_id !== user_id) throw new RosterInputError('La deuda no corresponde a esta persona.');
        if (day < debt.date) throw new RosterInputError('El abono no puede ser anterior a la deuda.');
        const paid = debt.payments.reduce((sum, item) => sum + (item.paid_minutes || 0), 0);
        if (paid + minutes! > debt.total_minutes) throw new RosterInputError('Las horas del abono exceden el saldo pendiente.');
      }
      return tx.technicianException.create({ data: { user_id, date: day, exception_type, notes, start_time: timed ? start_time : null, end_time: timed ? end_time : null, paid_minutes: payment ? minutes : null, time_debt_id: payment ? time_debt_id : null } });
    });
    emitRefresh('refresh_roster');
    res.json(exception);
  } catch (error) { rosterError(res, error); }
};

export const removeException = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!uuid(id)) throw new RosterInputError('Incidencia inválida.');
    await prisma.$transaction(async tx => {
      const entry = await tx.technicianException.findUnique({ where: { id } });
      if (!entry) throw new RosterInputError('La incidencia ya no existe.');
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${entry.user_id}::uuid FOR UPDATE`;
      await tx.technicianException.delete({ where: { id } });
    });
    emitRefresh('refresh_roster');
    res.json({ success: true });
  } catch (error) { rosterError(res, error); }
};
