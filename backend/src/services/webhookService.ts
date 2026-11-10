import { createHmac } from 'crypto';
import prisma from '../config/prisma';

export type WebhookEvent =
  | 'work_order.created'
  | 'work_order.updated'
  | 'work_order.comment';

const TIMEOUT_MS = 10_000;

/** Envía el payload a los webhooks suscritos (sin bloquear la operación). */
export async function emitWebhook(event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
  try {
    const hooks = await prisma.webhook.findMany({ where: { is_active: true } });
    for (const hook of hooks) {
      const events = Array.isArray(hook.events) ? (hook.events as string[]) : [];
      if (!events.includes(event) && !events.includes('*')) continue;
      void deliver(hook.id, hook.url, hook.secret, event, payload);
    }
  } catch (error) {
    console.error('No se pudieron despachar los webhooks:', error);
  }
}

async function deliver(webhookId: string, url: string, secret: string, event: string, payload: Record<string, unknown>): Promise<void> {
  const body = JSON.stringify({
    event,
    sent_at: new Date().toISOString(),
    data: payload,
  });
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  let status: number | null = null;
  let error: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GTZ-Event': event,
        'X-GTZ-Signature': `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    status = response.status;
    if (!response.ok) {
      error = `HTTP ${response.status}`;
    }
  } catch (err: any) {
    error = err?.name === 'AbortError' ? 'Tiempo de espera agotado' : (err?.message || 'Error de red');
  }

  const ok = status !== null && status >= 200 && status < 300;

  try {
    await prisma.webhookDelivery.create({
      data: { webhook_id: webhookId, event, status, ok, error },
    });
    await prisma.webhook.update({
      where: { id: webhookId },
      data: { last_status: status, last_error: error, last_sent_at: new Date() },
    });
  } catch (dbError) {
    console.error('No se pudo registrar la entrega del webhook:', dbError);
  }
}

/** POST de prueba con un payload de ejemplo. */
export async function testWebhook(webhookId: string): Promise<{ ok: boolean; status: number | null; error: string | null }> {
  const hook = await prisma.webhook.findUnique({ where: { id: webhookId } });
  if (!hook) return { ok: false, status: null, error: 'Webhook no encontrado' };
  const body = JSON.stringify({
    event: 'ping',
    sent_at: new Date().toISOString(),
    data: { message: 'Prueba desde GTZ CMMS' },
  });
  const signature = createHmac('sha256', hook.secret).update(body).digest('hex');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GTZ-Event': 'ping',
        'X-GTZ-Signature': `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ok = response.ok;
    const status = response.status;
    const error = ok ? null : `HTTP ${response.status}`;
    await recordTest(hook.id, status, ok, error);
    return { ok, status, error };
  } catch (err: any) {
    const error = err?.name === 'AbortError' ? 'Tiempo de espera agotado' : (err?.message || 'Error de red');
    await recordTest(hook.id, null, false, error);
    return { ok: false, status: null, error };
  }
}

/** Guarda el resultado de una prueba manual igual que un envío real. */
async function recordTest(webhookId: string, status: number | null, ok: boolean, error: string | null): Promise<void> {
  try {
    await prisma.webhookDelivery.create({
      data: { webhook_id: webhookId, event: 'ping', status, ok, error },
    });
    await prisma.webhook.update({
      where: { id: webhookId },
      data: { last_status: status, last_error: error, last_sent_at: new Date() },
    });
  } catch (dbError) {
    console.error('No se pudo registrar la prueba del webhook:', dbError);
  }
}
