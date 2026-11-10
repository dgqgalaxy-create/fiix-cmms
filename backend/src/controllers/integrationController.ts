import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { generateApiKey } from '../middlewares/apiKeyAuth';
import { testWebhook } from '../services/webhookService';
import { writeAuditLog } from '../utils/auditLog';

const WEBHOOK_EVENTS = ['work_order.created', 'work_order.updated', 'work_order.comment'];

/* ------------------------------- API keys ------------------------------- */

/** GET /api/integrations/keys */
export const getApiKeys = async (_req: Request, res: Response): Promise<void> => {
  try {
    const keys = await prisma.apiKey.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        key_prefix: true,
        scopes: true,
        is_active: true,
        last_used_at: true,
        expires_at: true,
        created_at: true,
        created_by: { select: { name: true } },
      },
    });
    res.json(keys);
  } catch (error) {
    console.error('Error listando llaves de API:', error);
    res.status(500).json({ error: 'No se pudieron obtener las llaves' });
  }
};

/** POST /api/integrations/keys — devuelve la llave en claro UNA sola vez. */
export const createApiKey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name ?? '').trim().slice(0, 80);
    if (!name) {
      res.status(400).json({ error: 'Escribe un nombre para la llave.' });
      return;
    }

    const scopes: string[] = Array.isArray(req.body?.scopes)
      ? req.body.scopes.map((scope: unknown) => String(scope)).filter((scope: string) => ['read', 'write'].includes(scope))
      : ['read'];
    if (scopes.length === 0) scopes.push('read');

    const expiresInDays = Number(req.body?.expires_in_days);
    const expiresAt = Number.isFinite(expiresInDays) && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const { plain, hash, prefix } = generateApiKey();
    const created = await prisma.apiKey.create({
      data: {
        name,
        key_prefix: prefix,
        key_hash: hash,
        scopes,
        expires_at: expiresAt,
        created_by_id: req.user?.userId ?? null,
      },
    });

    await writeAuditLog({
      userId: req.user?.userId,
      action: 'CREATE_API_KEY',
      entity: 'api_key',
      entityId: created.id,
      summary: `Llave de API creada: ${name} (${scopes.join(', ')})`,
    });

    res.status(201).json({
      id: created.id,
      name: created.name,
      key: plain,
      prefix,
      scopes,
      expires_at: created.expires_at,
    });
  } catch (error) {
    console.error('Error creando llave de API:', error);
    res.status(500).json({ error: 'No se pudo crear la llave' });
  }
};

/** DELETE /api/integrations/keys/:id */
export const revokeApiKey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) {
      res.status(404).json({ error: 'Llave no encontrada' });
      return;
    }
    await prisma.apiKey.delete({ where: { id } });
    await writeAuditLog({
      userId: req.user?.userId,
      action: 'REVOKE_API_KEY',
      entity: 'api_key',
      entityId: id,
      summary: `Llave de API revocada: ${key.name}`,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error revocando llave:', error);
    res.status(500).json({ error: 'No se pudo revocar la llave' });
  }
};

/* ------------------------------- Webhooks ------------------------------- */

/** GET /api/integrations/webhooks */
export const getWebhooks = async (_req: Request, res: Response): Promise<void> => {
  try {
    const hooks = await prisma.webhook.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        deliveries: { orderBy: { created_at: 'desc' }, take: 5 },
      },
    });
    res.json(hooks.map((hook) => ({
      id: hook.id,
      url: hook.url,
      description: hook.description,
      events: hook.events,
      is_active: hook.is_active,
      last_status: hook.last_status,
      last_error: hook.last_error,
      last_sent_at: hook.last_sent_at,
      created_at: hook.created_at,
      deliveries: hook.deliveries,
    })));
  } catch (error) {
    console.error('Error listando webhooks:', error);
    res.status(500).json({ error: 'No se pudieron obtener los webhooks' });
  }
};

/** POST /api/integrations/webhooks — { url, events[], description? } */
export const createWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const url = String(req.body?.url ?? '').trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      res.status(400).json({ error: 'La URL debe iniciar con http:// o https://' });
      return;
    }
    const events = Array.isArray(req.body?.events)
      ? req.body.events.map((event: unknown) => String(event)).filter((event: string) => WEBHOOK_EVENTS.includes(event) || event === '*')
      : [];
    if (events.length === 0) {
      res.status(400).json({ error: 'Selecciona al menos un evento.' });
      return;
    }

    const secret = req.body?.secret ? String(req.body.secret).slice(0, 120) : generateApiKey().plain;
    const created = await prisma.webhook.create({
      data: {
        url,
        description: typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 200) : null,
        events,
        secret,
      },
    });

    await writeAuditLog({
      userId: req.user?.userId,
      action: 'CREATE_WEBHOOK',
      entity: 'webhook',
      entityId: created.id,
      summary: `Webhook creado: ${url} (${events.join(', ')})`,
    });

    // El secreto se muestra completo al crearlo para configurarlo en el destino.
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creando webhook:', error);
    res.status(500).json({ error: 'No se pudo crear el webhook' });
  }
};

/** PATCH /api/integrations/webhooks/:id */
export const updateWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const hook = await prisma.webhook.findUnique({ where: { id } });
    if (!hook) {
      res.status(404).json({ error: 'Webhook no encontrado' });
      return;
    }

    const data: { url?: string; description?: string | null; events?: string[]; is_active?: boolean } = {};
    if (typeof req.body?.url === 'string' && /^https?:\/\/.+/i.test(req.body.url.trim())) {
      data.url = req.body.url.trim();
    }
    if (req.body?.description !== undefined) {
      data.description = req.body.description ? String(req.body.description).trim().slice(0, 200) : null;
    }
    if (Array.isArray(req.body?.events)) {
      data.events = req.body.events.map((event: unknown) => String(event)).filter((event: string) => WEBHOOK_EVENTS.includes(event) || event === '*');
    }
    if (typeof req.body?.is_active === 'boolean') data.is_active = req.body.is_active;

    const updated = await prisma.webhook.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando webhook:', error);
    res.status(500).json({ error: 'No se pudo actualizar el webhook' });
  }
};

/** DELETE /api/integrations/webhooks/:id */
export const deleteWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.webhook.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando webhook:', error);
    res.status(500).json({ error: 'No se pudo eliminar el webhook' });
  }
};

/** POST /api/integrations/webhooks/:id/test */
export const testWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await testWebhook(req.params.id as string);
    res.json(result);
  } catch (error) {
    console.error('Error probando webhook:', error);
    res.status(500).json({ error: 'No se pudo probar el webhook' });
  }
};
