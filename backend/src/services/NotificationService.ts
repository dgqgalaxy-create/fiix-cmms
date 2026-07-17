import prisma from '../config/prisma';
import { getIO } from '../utils/socket';
import { sendTelegramAlert } from './TelegramService';
import { formatWorkOrderFolio } from '../utils/folio';

export const triggerNewWorkOrderNotification = async (workOrder: any) => {
  const title = `Nueva Solicitud: ${formatWorkOrderFolio(workOrder.folio)}`;
  const message = `${workOrder.title} (Prioridad: ${workOrder.priority})`;
  
  // 1. Send Telegram Alert
  const telegramMessage = `🚨 <b>${title}</b>\n\n<b>Falla:</b> ${workOrder.title}\n<b>Prioridad:</b> ${workOrder.priority}\n<b>Solicitante:</b> ${workOrder.requester_name || 'N/A'}\n<b>Zona:</b> ${workOrder.zone?.name || 'N/A'}\n<b>Equipo:</b> ${workOrder.asset?.name || 'N/A'}`;
  await sendTelegramAlert(telegramMessage);

  // 2. Create In-App Notifications for Admins and Technicians
  const usersToNotify = await prisma.user.findMany({
    where: {
      is_active: true,
      role: { in: ['ADMINISTRADOR', 'GESTIONADOR', 'TECNICO'] }
    }
  });

  const notifications = usersToNotify.map(user => ({
    user_id: user.id,
    title,
    message,
    link: `/dashboard?wo=${workOrder.id}`
  }));

  if (notifications.length > 0) {
    await prisma.appNotification.createMany({ data: notifications });
  }

  // Emit event via socket for live update
  getIO().emit('new_notification');
};
