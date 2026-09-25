import prisma from '../config/prisma';
import { emitRefresh, getIO } from './socket';
import { sendWebPushToUsers } from './webPush';

async function notifyUsers(userIds: string[], title: string, message: string, link: string) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  await prisma.appNotification.createMany({
    data: unique.map((user_id) => ({ user_id, title, message, link })),
  });
  try {
    getIO().emit('new_notification');
  } catch {
    // ignore
  }
  await sendWebPushToUsers(unique, { title, body: message, url: link });
}

/**
 * Envía recordatorios in-app + push para pendientes operativos vencidos
 * que aún no han sido avisados. Idempotente vía reminded_at.
 */
export async function runNotesReminders(now = new Date()): Promise<{ notes: number; tasks: number }> {
  const notes = 0; // Personal sticky notes never schedule notifications.

  const dueTasks = await prisma.operationalTask.findMany({
    where: {
      status: 'OPEN',
      due_at: { lte: now },
      reminded_at: null,
    },
    take: 100,
  });

  let tasks = 0;
  for (const task of dueTasks) {
    await notifyUsers(
      [task.assignee_id],
      'Pendiente vencido',
      task.title,
      '/notes'
    );
    await prisma.operationalTask.update({
      where: { id: task.id },
      data: { reminded_at: now },
    });
    tasks += 1;
  }

  if (notes > 0 || tasks > 0) {
    try {
      emitRefresh('refresh_notes');
    } catch {
      // ignore
    }
  }

  return { notes, tasks };
}
