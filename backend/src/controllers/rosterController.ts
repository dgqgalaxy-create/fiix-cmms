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

    const rangeStart = start ? parseDateInput(start as string) ?? undefined : undefined;
    const rangeEnd = end ? parseDateInput(end as string) ?? undefined : undefined;

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

export const addException = async (req: Request, res: Response) => {
  try {
    const { user_id, date, exception_type, notes } = req.body;
    
    const day = parseDateInput(date);
    if (!day) {
      res.status(400).json({ error: 'Fecha inválida' });
      return;
    }

    const exception = await prisma.technicianException.create({
      data: {
        user_id,
        date: day,
        exception_type,
        notes
      }
    });
    
    emitRefresh('refresh_roster');
    res.json(exception);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const removeException = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.technicianException.delete({ where: { id: id as string } });
    emitRefresh('refresh_roster');
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
