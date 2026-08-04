import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
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

/** Ventana para que el autor oculte su mensaje (soft-delete). */
const AUTHOR_DELETE_WINDOW_MS = 10 * 60 * 1000;

export type ReceiptStatus = 'sent' | 'delivered' | 'read';

async function assertParticipant(conversationId: string, userId: string) {
  return prisma.chatParticipant.findUnique({
    where: {
      conversation_id_user_id: { conversation_id: conversationId, user_id: userId },
    },
  });
}

function computeReceiptStatus(
  otherUserIds: string[],
  receipts: Array<{ user_id: string; delivered_at: Date | null; read_at: Date | null }>
): ReceiptStatus {
  if (otherUserIds.length === 0) return 'sent';
  const byUser = new Map(receipts.map((r) => [r.user_id, r]));
  const allRead = otherUserIds.every((uid) => Boolean(byUser.get(uid)?.read_at));
  if (allRead) return 'read';
  const allDelivered = otherUserIds.every((uid) => {
    const r = byUser.get(uid);
    return Boolean(r?.delivered_at || r?.read_at);
  });
  if (allDelivered) return 'delivered';
  return 'sent';
}

/** Respuesta pública: si está oculto, no se envía texto ni adjunto. */
function presentMessage(m: any, receipt_status?: ReceiptStatus) {
  if (!m) return m;
  const is_deleted = Boolean(m.deleted_at);
  const status = receipt_status ?? (m.receipt_status as ReceiptStatus | undefined) ?? 'sent';
  if (is_deleted) {
    return {
      id: m.id,
      conversation_id: m.conversation_id,
      author_id: m.author_id,
      author: m.author,
      body: '',
      attachment_url: null,
      attachment_name: null,
      created_at: m.created_at,
      deleted_at: m.deleted_at,
      is_deleted: true,
      receipt_status: status,
    };
  }
  return {
    id: m.id,
    conversation_id: m.conversation_id,
    author_id: m.author_id,
    author: m.author,
    body: m.body,
    attachment_url: m.attachment_url,
    attachment_name: m.attachment_name,
    created_at: m.created_at,
    deleted_at: null,
    is_deleted: false,
    receipt_status: status,
  };
}

function lastMessagePreview(m: any | null) {
  if (!m) return null;
  const presented = presentMessage(m);
  return {
    id: presented.id,
    body: presented.is_deleted ? 'Mensaje eliminado' : presented.body,
    author_id: presented.author_id,
    author: presented.author,
    created_at: presented.created_at,
    attachment_url: presented.attachment_url,
    is_deleted: presented.is_deleted,
  };
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
    last_message: lastMessagePreview(lastMessage),
    unread_count: unreadCount,
  };
}

async function otherParticipantIds(conversationId: string, authorId: string) {
  const parts = await prisma.chatParticipant.findMany({
    where: { conversation_id: conversationId, user_id: { not: authorId } },
    select: { user_id: true },
  });
  return parts.map((p) => p.user_id);
}

async function statusForMessage(
  messageId: string,
  conversationId: string,
  authorId: string
): Promise<ReceiptStatus> {
  const others = await otherParticipantIds(conversationId, authorId);
  const receipts = await prisma.chatMessageReceipt.findMany({
    where: { message_id: messageId, user_id: { in: others } },
    select: { user_id: true, delivered_at: true, read_at: true },
  });
  return computeReceiptStatus(others, receipts);
}

function emitReceiptUpdate(
  authorId: string,
  conversationId: string,
  messageId: string,
  receipt_status: ReceiptStatus
) {
  emitToUser(authorId, 'chat_receipt', {
    conversation_id: conversationId,
    message_id: messageId,
    receipt_status,
  });
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
          deleted_at: null,
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
            deleted_at: null,
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
      include: {
        author: { select: authorSelect },
        receipts: { select: { user_id: true, delivered_at: true, read_at: true } },
      },
      orderBy: { created_at: 'desc' },
      take,
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
    });

    const othersByAuthor = new Map<string, string[]>();
    const allOthers = await prisma.chatParticipant.findMany({
      where: { conversation_id: id },
      select: { user_id: true },
    });
    const participantIds = allOthers.map((p) => p.user_id);

    const presented = messages.reverse().map((m) => {
      const others =
        othersByAuthor.get(m.author_id) ||
        participantIds.filter((uid) => uid !== m.author_id);
      othersByAuthor.set(m.author_id, others);
      const status =
        m.author_id === userId
          ? computeReceiptStatus(others, m.receipts)
          : ('sent' as ReceiptStatus);
      return presentMessage(m, status);
    });

    res.json(presented);
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

    const others = participants.map((p) => p.user_id).filter((uid) => uid !== userId);
    if (others.length > 0) {
      await prisma.chatMessageReceipt.createMany({
        data: others.map((uid) => ({
          id: randomUUID(),
          message_id: message.id,
          user_id: uid,
        })),
        skipDuplicates: true,
      });
    }

    const presented = presentMessage(message, 'sent');
    const payload = { conversation_id: id, message: presented };
    for (const p of participants) {
      emitToUser(p.user_id, 'chat_message', payload);
      emitToUser(p.user_id, 'refresh_chat');
    }

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
        tag: `chat-${id}`,
        vibrate: [200, 100, 200],
      });
    }

    res.status(201).json(presented);
  } catch (error: any) {
    console.error('sendMessage', error);
    res.status(500).json({ error: error?.message || 'Error al enviar mensaje' });
  }
};

/** Soft-delete: solo el autor, dentro de 10 minutos. No hay UI de Admin para leer el contenido. */
export const softDeleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const conversationId = req.params.id as string;
    const messageId = req.params.messageId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const part = await assertParticipant(conversationId, userId);
    if (!part) return res.status(403).json({ error: 'No perteneces a esta conversación' });

    const msg = await prisma.chatMessage.findFirst({
      where: { id: messageId, conversation_id: conversationId },
      include: { author: { select: authorSelect } },
    });
    if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });
    if (msg.author_id !== userId) {
      return res.status(403).json({ error: 'Solo puedes eliminar tus propios mensajes' });
    }
    if (msg.deleted_at) {
      return res.json(presentMessage(msg));
    }

    const ageMs = Date.now() - new Date(msg.created_at).getTime();
    if (ageMs > AUTHOR_DELETE_WINDOW_MS) {
      return res.status(400).json({
        error: 'Solo puedes eliminar el mensaje durante los primeros 10 minutos',
      });
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { deleted_at: new Date() },
      include: { author: { select: authorSelect } },
    });

    const presented = presentMessage(updated);
    const participants = await prisma.chatParticipant.findMany({
      where: { conversation_id: conversationId },
      select: { user_id: true },
    });
    const payload = { conversation_id: conversationId, message: presented };
    for (const p of participants) {
      emitToUser(p.user_id, 'chat_message_deleted', payload);
      emitToUser(p.user_id, 'refresh_chat');
    }

    res.json(presented);
  } catch (error) {
    console.error('softDeleteMessage', error);
    res.status(500).json({ error: 'Error al eliminar el mensaje' });
  }
};

export const markConversationRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const part = await assertParticipant(id, userId);
    if (!part) return res.status(403).json({ error: 'No perteneces a esta conversación' });

    const now = new Date();
    await prisma.chatParticipant.update({
      where: {
        conversation_id_user_id: { conversation_id: id, user_id: userId },
      },
      data: { last_read_at: now },
    });

    // Marcar leídos (y entregados) solo mensajes ajenos aún no leídos por este usuario
    const othersMessages = await prisma.chatMessage.findMany({
      where: {
        conversation_id: id,
        author_id: { not: userId },
        deleted_at: null,
        OR: [
          { receipts: { none: { user_id: userId } } },
          { receipts: { some: { user_id: userId, read_at: null } } },
        ],
      },
      select: { id: true, author_id: true },
    });

    for (const msg of othersMessages) {
      await prisma.chatMessageReceipt.upsert({
        where: {
          message_id_user_id: { message_id: msg.id, user_id: userId },
        },
        create: {
          id: randomUUID(),
          message_id: msg.id,
          user_id: userId,
          delivered_at: now,
          read_at: now,
        },
        update: {
          read_at: now,
          delivered_at: now,
        },
      });
    }

    // Notificar a cada autor el nuevo estado agregado
    const authorIds = [...new Set(othersMessages.map((m) => m.author_id))];
    for (const authorId of authorIds) {
      const authored = othersMessages.filter((m) => m.author_id === authorId);
      for (const msg of authored) {
        const status = await statusForMessage(msg.id, id, authorId);
        emitReceiptUpdate(authorId, id, msg.id, status);
      }
    }

    emitToUser(userId, 'refresh_chat');
    res.json({ ok: true });
  } catch (error) {
    console.error('markConversationRead', error);
    res.status(500).json({ error: 'Error al marcar como leído' });
  }
};

/**
 * ACK de entrega (socket): el destinatario confirma que recibió el mensaje en vivo.
 */
export async function ackChatMessageDelivered(
  userId: string,
  conversationId: string,
  messageId: string
): Promise<void> {
  const part = await assertParticipant(conversationId, userId);
  if (!part) return;

  const msg = await prisma.chatMessage.findFirst({
    where: { id: messageId, conversation_id: conversationId },
    select: { id: true, author_id: true },
  });
  if (!msg || msg.author_id === userId) return;

  const now = new Date();
  const existing = await prisma.chatMessageReceipt.findUnique({
    where: {
      message_id_user_id: { message_id: messageId, user_id: userId },
    },
  });

  if (existing?.delivered_at) {
    // Ya entregado; si ya está leído no hace falta reemitir
    return;
  }

  await prisma.chatMessageReceipt.upsert({
    where: {
      message_id_user_id: { message_id: messageId, user_id: userId },
    },
    create: {
      id: randomUUID(),
      message_id: messageId,
      user_id: userId,
      delivered_at: now,
    },
    update: {
      delivered_at: now,
    },
  });

  const status = await statusForMessage(messageId, conversationId, msg.author_id);
  emitReceiptUpdate(msg.author_id, conversationId, messageId, status);
}
