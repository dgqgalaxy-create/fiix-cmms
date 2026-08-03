import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { emitRefresh, getIO } from '../utils/socket';
import { sendWebPushToUsers } from '../utils/webPush';

const emitNotes = () => emitRefresh('refresh_notes');

const uploadDir = path.join(__dirname, '../../uploads/announcements');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

export const announcementUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Solo se permiten imágenes'));
      return;
    }
    cb(null, true);
  },
});

async function notifyAllActiveUsers(title: string, message: string, link: string, exceptUserId?: string) {
  const users = await prisma.user.findMany({
    where: { is_active: true, ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}) },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.appNotification.createMany({
    data: ids.map((user_id) => ({ user_id, title, message, link })),
  });
  try {
    getIO().emit('new_notification');
  } catch {
    /* socket may not be ready */
  }
  await sendWebPushToUsers(ids, { title, body: message, url: link });
}

export const listAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const isAdmin = req.user?.role === 'ADMINISTRADOR';
    const includeInactive = isAdmin && String(req.query.include_inactive || '') === '1';

    const rows = await prisma.globalAnnouncement.findMany({
      where: includeInactive ? {} : { is_active: true },
      include: {
        created_by: { select: { id: true, name: true } },
        reads: {
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { seen_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    const activeUserCount = await prisma.user.count({ where: { is_active: true } });

    const payload = rows.map((a) => {
      const seenByMe = a.reads.some((r) => r.user_id === userId);
      const base = {
        id: a.id,
        title: a.title,
        body: a.body,
        image_url: a.image_url,
        created_by_id: a.created_by_id,
        created_by: a.created_by,
        is_active: a.is_active,
        created_at: a.created_at,
        updated_at: a.updated_at,
        seen_by_me: seenByMe,
        seen_count: a.reads.length,
        audience_count: activeUserCount,
      };
      if (isAdmin) {
        return {
          ...base,
          readers: a.reads.map((r) => ({
            id: r.user.id,
            name: r.user.name,
            role: r.user.role,
            seen_at: r.seen_at,
          })),
        };
      }
      return base;
    });

    res.json(payload);
  } catch (error) {
    console.error('listAnnouncements', error);
    res.status(500).json({ error: 'Error al listar avisos' });
  }
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user?.role !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Solo un Administrador puede publicar avisos globales' });
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(400).json({ error: 'El título es obligatorio' });

    const body =
      typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 8000) || null : null;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const imageFile = files?.['image']?.[0];
    const image_url = imageFile ? `/uploads/announcements/${imageFile.filename}` : null;

    const announcement = await prisma.globalAnnouncement.create({
      data: {
        title: title.slice(0, 200),
        body,
        image_url,
        created_by_id: userId,
      },
      include: {
        created_by: { select: { id: true, name: true } },
      },
    });

    // El creador ya lo "vio"
    await prisma.globalAnnouncementRead.create({
      data: { announcement_id: announcement.id, user_id: userId },
    });

    await notifyAllActiveUsers(
      'Nuevo aviso global',
      announcement.title,
      '/notes?tab=avisos',
      userId
    );

    emitNotes();
    res.status(201).json({
      ...announcement,
      seen_by_me: true,
      seen_count: 1,
      readers: [],
    });
  } catch (error: any) {
    console.error('createAnnouncement', error);
    res.status(500).json({ error: error?.message || 'Error al crear aviso' });
  }
};

export const markAnnouncementSeen = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const announcement = await prisma.globalAnnouncement.findFirst({
      where: { id, is_active: true },
      select: { id: true },
    });
    if (!announcement) return res.status(404).json({ error: 'Aviso no encontrado' });

    await prisma.globalAnnouncementRead.upsert({
      where: {
        announcement_id_user_id: { announcement_id: id, user_id: userId },
      },
      create: { announcement_id: id, user_id: userId },
      update: {},
    });

    emitNotes();
    res.json({ ok: true });
  } catch (error) {
    console.error('markAnnouncementSeen', error);
    res.status(500).json({ error: 'Error al marcar aviso como visto' });
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user?.role !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Solo un Administrador puede eliminar avisos' });
    }

    const existing = await prisma.globalAnnouncement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Aviso no encontrado' });

    await prisma.globalAnnouncement.update({
      where: { id },
      data: { is_active: false },
    });

    emitNotes();
    res.json({ ok: true });
  } catch (error) {
    console.error('deleteAnnouncement', error);
    res.status(500).json({ error: 'Error al eliminar aviso' });
  }
};

export async function countUnreadAnnouncements(userId: string): Promise<number> {
  const active = await prisma.globalAnnouncement.findMany({
    where: { is_active: true },
    select: { id: true },
  });
  if (active.length === 0) return 0;
  const seen = await prisma.globalAnnouncementRead.findMany({
    where: {
      user_id: userId,
      announcement_id: { in: active.map((a) => a.id) },
    },
    select: { announcement_id: true },
  });
  const seenSet = new Set(seen.map((s) => s.announcement_id));
  return active.filter((a) => !seenSet.has(a.id)).length;
}
