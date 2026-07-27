import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { getVapidPublicKey, isWebPushConfigured } from '../utils/webPush';

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const notifications = await prisma.appNotification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 20
    });

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    const notification = await prisma.appNotification.findUnique({ where: { id } });
    if (!notification || notification.user_id !== userId) {
      res.status(404).json({ error: 'Notificación no encontrada' });
      return;
    }

    const updated = await prisma.appNotification.update({
      where: { id },
      data: { is_read: true }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    await prisma.appNotification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true }
    });

    res.json({ message: 'Todas marcadas como leídas' });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getVapidKey = async (_req: Request, res: Response): Promise<void> => {
  try {
    const publicKey = getVapidPublicKey();
    res.json({ publicKey: publicKey || '', configured: isWebPushConfigured() });
  } catch (error) {
    console.error('Error reading VAPID key:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getPushStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
    const devices = await prisma.pushSubscription.count({ where: { user_id: userId } });
    res.json({
      configured: isWebPushConfigured(),
      subscribed: devices > 0,
      devices,
    });
  } catch (error) {
    console.error('Error reading push status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const subscribePush = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const endpoint = String(req.body?.endpoint || '').trim();
    const p256dh = String(req.body?.keys?.p256dh || '').trim();
    const auth = String(req.body?.keys?.auth || '').trim();
    const userAgent = req.body?.user_agent ? String(req.body.user_agent).slice(0, 512) : null;

    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({ error: 'Suscripción incompleta (endpoint y keys requeridos)' });
      return;
    }

    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
      },
      update: {
        user_id: userId,
        p256dh,
        auth,
        user_agent: userAgent,
      },
    });

    res.json({ ok: true, id: sub.id });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const unsubscribePush = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const endpoint = req.body?.endpoint ? String(req.body.endpoint).trim() : '';

    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { user_id: userId, endpoint },
      });
    } else {
      await prisma.pushSubscription.deleteMany({ where: { user_id: userId } });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
