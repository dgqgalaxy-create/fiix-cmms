import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          telegram_enabled: true,
          email_enabled: false,
        },
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegram_enabled, email_enabled } = req.body;
    let settings = await prisma.systemSettings.findFirst();
    
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          telegram_enabled,
          email_enabled,
        },
      });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          telegram_enabled: telegram_enabled ?? settings.telegram_enabled,
          email_enabled: email_enabled ?? settings.email_enabled,
        },
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
