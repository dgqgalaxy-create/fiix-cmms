import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { emitToWorkOrderRoom, getIO } from '../utils/socket';
import { sendWebPushToUsers } from '../utils/webPush';
import { formatWorkOrderFolio } from '../utils/folio';

const uploadDir = path.join(__dirname, '../../uploads/wo-comments');
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

export const woCommentUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.startsWith('image/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'text/plain';
    if (!ok) {
      cb(new Error('Tipo de archivo no permitido'));
      return;
    }
    cb(null, true);
  },
});

const authorSelect = { id: true, name: true, role: true };

export const listWorkOrderComments = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const wo = await prisma.workOrder.findUnique({ where: { id }, select: { id: true } });
    if (!wo) return res.status(404).json({ error: 'Orden no encontrada' });

    const comments = await prisma.workOrderComment.findMany({
      where: { work_order_id: id },
      include: { author: { select: authorSelect } },
      orderBy: { created_at: 'asc' },
      take: 500,
    });
    res.json(comments);
  } catch (error) {
    console.error('listWorkOrderComments', error);
    res.status(500).json({ error: 'Error al listar comentarios' });
  }
};

export const createWorkOrderComment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id as string;
    const bodyRaw = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const file = files?.['attachment']?.[0];

    if (!bodyRaw && !file) {
      return res.status(400).json({ error: 'Escribe un mensaje o adjunta un archivo' });
    }

    const wo = await prisma.workOrder.findUnique({
      where: { id },
      select: {
        id: true,
        folio: true,
        title: true,
        created_by_id: true,
        assigned_technicians: { select: { id: true } },
      },
    });
    if (!wo) return res.status(404).json({ error: 'Orden no encontrada' });

    const attachment_url = file ? `/uploads/wo-comments/${file.filename}` : null;
    const attachment_name = file ? file.originalname : null;

    const comment = await prisma.workOrderComment.create({
      data: {
        work_order_id: id,
        author_id: userId,
        body: (bodyRaw || (file ? `(archivo) ${file.originalname}` : '')).slice(0, 4000),
        attachment_url,
        attachment_name,
      },
      include: { author: { select: authorSelect } },
    });

    emitToWorkOrderRoom(id, 'wo_comment', comment);

    const recipientIds = new Set<string>();
    recipientIds.add(wo.created_by_id);
    for (const t of wo.assigned_technicians) recipientIds.add(t.id);
    recipientIds.delete(userId);

    const ids = Array.from(recipientIds);
    if (ids.length > 0) {
      const folio = formatWorkOrderFolio(wo.folio);
      const title = `Comentario en ${folio}`;
      const message = `${comment.author.name}: ${comment.body.slice(0, 120)}`;
      const link = `/dashboard?wo=${id}`;
      await prisma.appNotification.createMany({
        data: ids.map((user_id) => ({ user_id, title, message, link })),
      });
      try {
        getIO().emit('new_notification');
      } catch {
        /* ignore */
      }
      await sendWebPushToUsers(ids, { title, body: message, url: link });
    }

    res.status(201).json(comment);
  } catch (error: any) {
    console.error('createWorkOrderComment', error);
    res.status(500).json({ error: error?.message || 'Error al crear comentario' });
  }
};
