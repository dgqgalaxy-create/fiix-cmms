import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { emitToUser, getIO } from '../utils/socket';
import { sendWebPushToUsers } from '../utils/webPush';

const uploadDir = path.join(__dirname, '../../uploads/chat');
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

export const chatUpload = multer({
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

const userSelect = { id: true, name: true, role: true, is_active: true };
const authorSelect = { id: true, name: true, role: true };

async function assertParticipant(conversationId: string, userId: string) {
  return prisma.chatParticipant.findUnique({
    where: {
      conversation_id_user_id: { conversation_id: conversationId, user_id: userId },
    },
  });
}

async function findDirectConversation(userA: string, userB: string) {
  const mine = await prisma.chatParticipant.findMany({
    where: { user_id: userA, conversation: { type: 'DIRECT' } },
    select: { conversation_id: true },
  });
  if (mine.length === 0) return null;
  const ids = mine.map((m) => m.conversation_id);
  const hit = await prisma.chatParticipant.findFirst({
    where: {
      user_id: userB,
      conversation_id: { in: ids },
      conversation: { type: 'DIRECT' },
    },
    select: { conversation_id: true },
  });
  return hit?.conversation_id || null;
}

function serializeConversation(
  c: any,
  myUserId: string,
  lastMessage?: any | null,
  unreadCount = 0
) {
  const others = (c.participants || [])
    .map((p: any) => p.user)
    .filter((u: any) => u && u.id !== myUserId);
  const title =
    c.type === 'GROUP'
      ? c.title || 'Grupo'
      : others[0]?.name || 'Chat directo';
  return {
    id: c.id,
    type: c.type,
    title,
    created_by_id: c.created_by_id,
    created_at: c.created_at,
    updated_at: c.updated_at,
    participants: (c.participants || []).map((p: any) => ({
      user_id: p.user_id,
      joined_at: p.joined_at,
      last_read_at: p.last_read_at,
      user: p.user,
    })),
    last_message: lastMessage
      ? {
          id: lastMessage.id,
          body: lastMessage.body,
          author_id: lastMessage.author_id,
          author: lastMessage.author,
          created_at: lastMessage.created_at,
          attachment_url: lastMessage.attachment_url,
        }
      : null,
    unread_count: unreadCount,
  };
}

export const getChatUnreadSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parts = await prisma.chatParticipant.findMany({
      where: { user_id: userId },
      select: { conversation_id: true, last_read_at: true },
    });
    let unread = 0;
    for (const p of parts) {
      const n = await prisma.chatMessage.count({
        where: {
          conversation_id: p.conversation_id,
          author_id: { not: userId },
          ...(p.last_read_at ? { created_at: { gt: p.last_read_at } } : {}),
        },
      });
      unread += n;
    }
    res.json({ unread_total: unread });
  } catch (error) {
    console.error('getChatUnreadSummary', error);
    res.status(500).json({ error: 'Error al obtener resumen de chat' });
  }
};

export const listConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parts = await prisma.chatParticipant.findMany({
      where: { user_id: userId },
      include: {
        conversation: {
          include: {
            participants: { include: { user: { select: userSelect } } },
            messages: {
              orderBy: { created_at: 'desc' },
              take: 1,
              include: { author: { select: authorSelect } },
            },
          },
        },
      },
    });

    const payload = await Promise.all(
      parts.map(async (p) => {
        const last = p.conversation.messages[0] || null;
        const unread = await prisma.chatMessage.count({
          where: {
            conversation_id: p.conversation_id,
            author_id: { not: userId },
            ...(p.last_read_at ? { created_at: { gt: p.last_read_at } } : {}),
          },
        });
        return serializeConversation(p.conversation, userId, last, unread);
      })
    );

    payload.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    res.json(payload);
  } catch (error) {
    console.error('listConversations', error);
    res.status(500).json({ error: 'Error al listar conversaciones' });
  }
};

export const createDirectConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const otherId = typeof req.body?.user_id === 'string' ? req.body.user_id : '';
    if (!otherId || otherId === userId) {
      return res.status(400).json({ error: 'Selecciona otro usuario activo' });
    }

    const other = await prisma.user.findFirst({
      where: { id: otherId, is_active: true },
      select: userSelect,
    });
    if (!other) return res.status(404).json({ error: 'Usuario no encontrado o inactivo' });

    let conversationId = await findDirectConversation(userId, otherId);
    if (!conversationId) {
      const created = await prisma.chatConversation.create({
        data: {
          type: 'DIRECT',
          created_by_id: userId,
          participants: {
            create: [{ user_id: userId }, { user_id: otherId }],
          },
        },
      });
      conversationId = created.id;
    }

    const full = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: { include: { user: { select: userSelect } } },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: { author: { select: authorSelect } },
        },
      },
    });
    res.status(201).json(serializeConversation(full, userId, full?.messages[0] || null, 0));
  } catch (error) {
    console.error('createDirectConversation', error);
    res.status(500).json({ error: 'Error al crear chat directo' });
  }
};

export const createGroupConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
    if (!title) return res.status(400).json({ error: 'El título del grupo es obligatorio' });

    let userIds: string[] = Array.isArray(req.body?.user_ids) ? req.body.user_ids : [];
    userIds = [...new Set(userIds.filter((id) => typeof id === 'string' && id !== userId))];
    if (userIds.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos un participante' });
    }

    const active = await prisma.user.findMany({
      where: { id: { in: userIds }, is_active: true },
      select: { id: true },
    });
    if (active.length === 0) {
      return res.status(400).json({ error: 'Ningún participante activo válido' });
    }

    const memberIds = [...new Set([userId, ...active.map((u) => u.id)])];
    const created = await prisma.chatConversation.create({
      data: {
        type: 'GROUP',
        title,
        created_by_id: userId,
        participants: { create: memberIds.map((uid) => ({ user_id: uid })) },
      },
      include: {
        participants: { include: { user: { select: userSelect } } },
      },
    });

    res.status(201).json(serializeConversation(created, userId, null, 0));
  } catch (error) {
    console.error('createGroupConversation', error);
    res.status(500).json({ error: 'Error al crear grupo' });
  }
};

export const addGroupParticipants = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const conv = await prisma.chatConversation.findUnique({ where: { id } });
    if (!conv || conv.type !== 'GROUP') {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }
    if (conv.created_by_id !== userId && req.user?.role !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Solo el creador o un Admin pueden añadir miembros' });
    }

    let userIds: string[] = Array.isArray(req.body?.user_ids) ? req.body.user_ids : [];
    userIds = [...new Set(userIds.filter((x) => typeof x === 'string'))];
    const active = await prisma.user.findMany({
      where: { id: { in: userIds }, is_active: true },
      select: { id: true },
    });

    for (const u of active) {
      await prisma.chatParticipant.upsert({
        where: {
          conversation_id_user_id: { conversation_id: id, user_id: u.id },
        },
        create: { conversation_id: id, user_id: u.id },
        update: {},
      });
    }

    await prisma.chatConversation.update({
      where: { id },
      data: { updated_at: new Date() },
    });

    const full = await prisma.chatConversation.findUnique({
      where: { id },
      include: { participants: { include: { user: { select: userSelect } } } },
    });
    res.json(serializeConversation(full, userId, null, 0));
  } catch (error) {
    console.error('addGroupParticipants', error);
    res.status(500).json({ error: 'Error al añadir participantes' });
  }
};

export const listMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const part = await assertParticipant(id, userId);
    if (!part) return res.status(403).json({ error: 'No perteneces a esta conversación' });

    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const take = Math.min(Number(req.query.limit) || 50, 100);

    const messages = await prisma.chatMessage.findMany({
      where: { conversation_id: id },
      include: { author: { select: authorSelect } },
      orderBy: { created_at: 'desc' },
      take,
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
    });

    res.json(messages.reverse());
  } catch (error) {
    console.error('listMessages', error);
    res.status(500).json({ error: 'Error al listar mensajes' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const part = await assertParticipant(id, userId);
    if (!part) return res.status(403).json({ error: 'No perteneces a esta conversación' });

    const bodyRaw = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const file = files?.['attachment']?.[0];
    if (!bodyRaw && !file) {
      return res.status(400).json({ error: 'Escribe un mensaje o adjunta un archivo' });
    }

    const attachment_url = file ? `/uploads/chat/${file.filename}` : null;
    const attachment_name = file ? file.originalname : null;

    const message = await prisma.chatMessage.create({
      data: {
        conversation_id: id,
        author_id: userId,
        body: (bodyRaw || (file ? `(archivo) ${file.originalname}` : '')).slice(0, 8000),
        attachment_url,
        attachment_name,
      },
      include: { author: { select: authorSelect } },
    });

    await prisma.chatConversation.update({
      where: { id },
      data: { updated_at: new Date() },
    });

    await prisma.chatParticipant.update({
      where: {
        conversation_id_user_id: { conversation_id: id, user_id: userId },
      },
      data: { last_read_at: new Date() },
    });

    const participants = await prisma.chatParticipant.findMany({
      where: { conversation_id: id },
      select: { user_id: true },
    });

    const payload = { conversation_id: id, message };
    for (const p of participants) {
      emitToUser(p.user_id, 'chat_message', payload);
      emitToUser(p.user_id, 'refresh_chat');
    }

    const others = participants.map((p) => p.user_id).filter((uid) => uid !== userId);
    if (others.length > 0) {
      const title = 'Nuevo mensaje';
      const preview = message.body.slice(0, 120);
      const link = `/messages?c=${id}`;
      await prisma.appNotification.createMany({
        data: others.map((user_id) => ({
          user_id,
          title,
          message: `${message.author.name}: ${preview}`,
          link,
        })),
      });
      try {
        getIO().emit('new_notification');
      } catch {
        /* ignore */
      }
      await sendWebPushToUsers(others, {
        title,
        body: `${message.author.name}: ${preview}`,
        url: link,
      });
    }

    res.status(201).json(message);
  } catch (error: any) {
    console.error('sendMessage', error);
    res.status(500).json({ error: error?.message || 'Error al enviar mensaje' });
  }
};

export const markConversationRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const part = await assertParticipant(id, userId);
    if (!part) return res.status(403).json({ error: 'No perteneces a esta conversación' });

    await prisma.chatParticipant.update({
      where: {
        conversation_id_user_id: { conversation_id: id, user_id: userId },
      },
      data: { last_read_at: new Date() },
    });
    emitToUser(userId, 'refresh_chat');
    res.json({ ok: true });
  } catch (error) {
    console.error('markConversationRead', error);
    res.status(500).json({ error: 'Error al marcar como leído' });
  }
};
