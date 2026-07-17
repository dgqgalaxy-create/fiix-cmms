import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';

export const getRoster = async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;
    
    const patterns = await prisma.technicianPattern.findMany({
      include: {
        user: { select: { id: true, name: true, role: true } }
      }
    });

    const exceptions = await prisma.technicianException.findMany({
      where: {
        date: {
          gte: start ? new Date(start as string) : undefined,
          lte: end ? new Date(end as string) : undefined,
        }
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    const technicians = await prisma.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' }
    });

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: start ? new Date(start as string) : undefined,
          lte: end ? new Date(end as string) : undefined,
        },
      }
    });

    res.json({ patterns, exceptions, technicians, holidays });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const assignPattern = async (req: Request, res: Response) => {
  try {
    const { user_id, pattern_type, start_date } = req.body;
    
    const pattern = await prisma.technicianPattern.upsert({
      where: { user_id },
      update: { pattern_type, start_date: new Date(start_date) },
      create: { user_id, pattern_type, start_date: new Date(start_date) }
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
    
    const exception = await prisma.technicianException.create({
      data: {
        user_id,
        date: new Date(date),
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
