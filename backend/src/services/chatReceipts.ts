import { randomUUID } from 'crypto';
import prisma from '../config/prisma';

export type ReceiptStatus = 'sent' | 'delivered' | 'read';

export function computeReceiptStatus(
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

export async function otherParticipantIds(conversationId: string, authorId: string) {
  const parts = await prisma.chatParticipant.findMany({
    where: { conversation_id: conversationId, user_id: { not: authorId } },
    select: { user_id: true },
  });
  return parts.map((p) => p.user_id);
}

export async function statusForMessage(
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

export function emitReceiptUpdate(
  authorId: string,
  conversationId: string,
  messageId: string,
  receipt_status: ReceiptStatus
) {
  // Lazy require: evita ciclo socket ↔ chatReceipts (emitToUser quedaría undefined al cargar).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { emitToUser } = require('../utils/socket') as typeof import('../utils/socket');
  emitToUser(authorId, 'chat_receipt', {
    conversation_id: conversationId,
    message_id: messageId,
    receipt_status,
  });
}

/**
 * ACK de entrega (socket): el destinatario confirma que recibió el mensaje en vivo.
 */
export async function ackChatMessageDelivered(
  userId: string,
  conversationId: string,
  messageId: string
): Promise<void> {
  const part = await prisma.chatParticipant.findUnique({
    where: {
      conversation_id_user_id: { conversation_id: conversationId, user_id: userId },
    },
  });
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

  if (existing?.delivered_at) return;

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
