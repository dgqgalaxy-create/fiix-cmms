import cron from 'node-cron';
import prisma from '../config/prisma';
import { evaluateOpenWorkOrders, silentBackfillSlaEvents } from '../services/SlaService';
import { emitRefresh } from './socket';
import { runBackup } from './backupService';
import { runDbSelfCheck } from './dbHealthCheck';

// This cron job will run every day at 00:01
export const initCronJobs = () => {
  cron.schedule('1 0 * * *', async () => {
    console.log('Running daily preventative maintenance check...');
    await checkAndGenerateMaintenanceOrders();
  });

  // Respaldo automático diario (BD + uploads) a las 2:15 AM; conserva los últimos 14 días.
  cron.schedule('15 2 * * *', async () => {
    console.log('Running scheduled backup...');
    try {
      const result = await runBackup();
      console.log(`Backup result: ${result.message}`);
    } catch (error) {
      console.error('Error running scheduled backup:', error);
    }
  });

  // Autocomprobación de Postgres cada 5 min (Node vivo, BD caída → Telegram con debounce)
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runDbSelfCheck();
    } catch (error) {
      console.error('Error in DB self-check:', error);
    }
  });

  // SLA reminders / escalations every 15 minutes (con digest si hay muchos)
  cron.schedule('*/15 * * * *', async () => {
    console.log('Running SLA evaluation...');
    try {
      const result = await evaluateOpenWorkOrders({ mode: 'notify' });
      console.log(
        `SLA check done. Open WOs: ${result.checked}, events: ${result.emitted}, messages: ${result.notified}`
      );
    } catch (error) {
      console.error('Error evaluating SLA:', error);
    }
  });

  // For development and testing, run PM once immediately on startup
  setTimeout(() => {
    console.log('Running initial PM check on startup...');
    checkAndGenerateMaintenanceOrders();
  }, 5000);

  // Arranque: baseline silencioso del rezago (sin Telegram) para no saturar el canal
  setTimeout(() => {
    console.log('Running silent SLA backfill on startup (no Telegram flood)...');
    silentBackfillSlaEvents()
      .then((result) => {
        console.log(
          `Silent SLA backfill done. Open WOs: ${result.checked}, events recorded: ${result.emitted}`
        );
      })
      .catch((error) => console.error('Error in silent SLA backfill:', error));
  }, 8000);
};

export const checkAndGenerateMaintenanceOrders = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find active plans where today >= (next_due_date - days_in_advance)
    const activePlans = await prisma.maintenancePlan.findMany({
      where: {
        is_active: true
      },
      include: {
        required_items: {
          include: { item: true }
        }
      }
    });

    // Filtramos en memoria para facilidad con fechas
    for (const plan of activePlans) {
      const triggerDate = new Date(plan.next_due_date);
      triggerDate.setDate(triggerDate.getDate() - plan.days_in_advance);
      triggerDate.setHours(0, 0, 0, 0);

      if (today.getTime() >= triggerDate.getTime()) {
        console.log(`Triggering PM Plan: ${plan.title}`);

        // Primero verificamos si ya existe una orden generada para esta fecha
        // para evitar crear múltiples órdenes si el cron corre varias veces.
        // Asumimos que si hay una orden generada en los últimos `days_in_advance` días, ya se disparó.
        const recentOrder = await prisma.workOrder.findFirst({
          where: {
            maintenance_plan_id: plan.id,
            created_at: {
              gte: triggerDate
            }
          }
        });

        if (recentOrder) {
          console.log(`Plan ${plan.id} already triggered recently. Skipping.`);
          continue;
        }

        // Crear la descripción con los repuestos
        let desc = plan.description ? plan.description + '\n\n' : '';
        if (plan.required_items.length > 0) {
          desc += '--- REPUESTOS REQUERIDOS ---\n';
          plan.required_items.forEach(req => {
            desc += `- ${req.quantity_required} x [${req.item.internal_code}] ${req.item.name}\n`;
          });
        }

        // We need an admin user to set as creator. We'll find the first admin.
        const systemAdmin = await prisma.user.findFirst({
          where: { role: 'ADMINISTRADOR' }
        });

        if (!systemAdmin) {
          console.error('No admin found to create the automatic WO.');
          continue;
        }

        // Create the Work Order
        await prisma.workOrder.create({
          data: {
            title: `[PREVENTIVO] ${plan.title}`,
            description: desc,
            asset_id: plan.asset_id,
            priority: 'NORMAL',
            maintenance_type: 'PREVENTIVO',
            status: 'PENDIENTE',
            created_by_id: systemAdmin.id,
            maintenance_plan_id: plan.id
          }
        });

        // Update the plan's next_due_date
        let next_due_date = new Date(plan.next_due_date);
        if (plan.frequency_type === 'DIAS') next_due_date.setDate(next_due_date.getDate() + plan.frequency_value);
        else if (plan.frequency_type === 'SEMANAS') next_due_date.setDate(next_due_date.getDate() + (plan.frequency_value * 7));
        else if (plan.frequency_type === 'MESES') next_due_date.setMonth(next_due_date.getMonth() + plan.frequency_value);
        else if (plan.frequency_type === 'ANUAL') next_due_date.setFullYear(next_due_date.getFullYear() + plan.frequency_value);

        await prisma.maintenancePlan.update({
          where: { id: plan.id },
          data: {
            last_triggered_at: new Date(),
            next_due_date
          }
        });

        emitRefresh('refresh_work_orders');
        emitRefresh('refresh_maintenance');
        console.log(`Successfully generated WO for PM Plan: ${plan.title}`);
      }
    }
  } catch (error) {
    console.error('Error generating maintenance orders:', error);
  }
};
