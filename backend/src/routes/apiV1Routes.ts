import { Router } from 'express';
import prisma from '../config/prisma';
import { authenticateApiKey, requireScope } from '../middlewares/apiKeyAuth';
import { emitWebhook } from '../services/webhookService';

const router = Router();

router.use(authenticateApiKey);

/** GET /api/v1 — descripción de la API (para probar la llave). */
router.get('/', (_req, res) => {
  res.json({
    name: 'GTZ CMMS API',
    version: '1',
    endpoints: [
      'GET /api/v1/work-orders?status=&limit=',
      'GET /api/v1/work-orders/:folio',
      'POST /api/v1/work-orders',
      'GET /api/v1/assets',
      'GET /api/v1/items',
    ],
  });
});

/** GET /api/v1/work-orders */
router.get('/work-orders', requireScope('read'), async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const orders = await prisma.workOrder.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { folio: 'desc' },
      take: limit,
      select: {
        id: true,
        folio: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        maintenance_type: true,
        created_at: true,
        completed_at: true,
        asset: { select: { id: true, internal_code: true, name: true } },
        zone: { select: { id: true, name: true } },
      },
    });
    res.json({ data: orders, count: orders.length });
  } catch (error) {
    console.error('API v1 work-orders:', error);
    res.status(500).json({ error: 'No se pudieron obtener las órdenes' });
  }
});

/** GET /api/v1/work-orders/:folio */
router.get('/work-orders/:folio', requireScope('read'), async (req, res) => {
  try {
    const folio = Number(req.params.folio);
    if (!Number.isFinite(folio)) {
      res.status(400).json({ error: 'El folio debe ser numérico' });
      return;
    }
    const order = await prisma.workOrder.findFirst({
      where: { folio },
      include: {
        asset: { select: { id: true, internal_code: true, name: true } },
        zone: { select: { id: true, name: true } },
        assigned_technicians: { select: { id: true, name: true } },
      },
    });
    if (!order) {
      res.status(404).json({ error: 'Orden no encontrada' });
      return;
    }
    res.json(order);
  } catch (error) {
    console.error('API v1 work-order:', error);
    res.status(500).json({ error: 'No se pudo obtener la orden' });
  }
});

/** POST /api/v1/work-orders — crea una solicitud desde otro sistema. */
router.post('/work-orders', requireScope('write'), async (req, res) => {
  try {
    const title = String(req.body?.title ?? '').trim();
    const assetId = String(req.body?.asset_id ?? '').trim();
    if (!title || !assetId) {
      res.status(400).json({ error: 'Se requieren title y asset_id' });
      return;
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true, zone_id: true } });
    if (!asset) {
      res.status(404).json({ error: 'El activo no existe' });
      return;
    }
    const admin = await prisma.user.findFirst({ where: { role: 'ADMINISTRADOR' }, select: { id: true } });
    if (!admin) {
      res.status(500).json({ error: 'No hay usuario administrador para registrar la orden' });
      return;
    }

    const created = await prisma.workOrder.create({
      data: {
        title,
        description: typeof req.body?.description === 'string' ? req.body.description : null,
        asset_id: asset.id,
        zone_id: asset.zone_id,
        created_by_id: admin.id,
        status: 'PENDIENTE',
        priority: (['BAJO', 'NORMAL', 'URGENTE'].includes(String(req.body?.priority).toUpperCase())
          ? String(req.body.priority).toUpperCase()
          : 'NORMAL') as any,
        maintenance_type: (['SERVICIO', 'PREVENTIVO', 'CORRECTIVO'].includes(String(req.body?.maintenance_type).toUpperCase())
          ? String(req.body.maintenance_type).toUpperCase()
          : 'CORRECTIVO') as any,
        requester_name: typeof req.body?.requester_name === 'string' ? req.body.requester_name.slice(0, 120) : null,
      },
      select: { id: true, folio: true, title: true, status: true, created_at: true },
    });

    void emitWebhook('work_order.created', created as any);
    res.status(201).json(created);
  } catch (error) {
    console.error('API v1 create work-order:', error);
    res.status(500).json({ error: 'No se pudo crear la orden' });
  }
});

/** GET /api/v1/assets */
router.get('/assets', requireScope('read'), async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const assets = await prisma.asset.findMany({
      orderBy: { internal_code: 'asc' },
      take: limit,
      select: {
        id: true,
        internal_code: true,
        name: true,
        status: true,
        is_critical: true,
        zone: { select: { name: true } },
      },
    });
    res.json({ data: assets, count: assets.length });
  } catch (error) {
    console.error('API v1 assets:', error);
    res.status(500).json({ error: 'No se pudieron obtener los activos' });
  }
});

/** GET /api/v1/items */
router.get('/items', requireScope('read'), async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const items = await prisma.item.findMany({
      orderBy: { internal_code: 'asc' },
      take: limit,
      select: {
        id: true,
        internal_code: true,
        name: true,
        stock: true,
        minimum_inventory: true,
        purchase_cost: true,
        is_active: true,
      },
    });
    res.json({ data: items, count: items.length });
  } catch (error) {
    console.error('API v1 items:', error);
    res.status(500).json({ error: 'No se pudieron obtener los repuestos' });
  }
});

export default router;
