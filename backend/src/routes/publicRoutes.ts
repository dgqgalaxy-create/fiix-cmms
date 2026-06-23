import { Router } from 'express';
import { createPublicWorkOrder } from '../controllers/workOrderController';
import prisma from '../config/prisma';

const router = Router();

// Endpoint for public work order creation
router.post('/requests', createPublicWorkOrder);

// Endpoints to populate the public form dropdowns without auth
router.get('/zones', async (req, res) => {
  try {
    const zones = await prisma.zone.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(zones);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching zones' });
  }
});

router.get('/assets', async (req, res) => {
  try {
    const { zone_id } = req.query;
    const where = zone_id ? { zone_id: String(zone_id) } : {};
    const assets = await prisma.asset.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, internal_code: true }
    });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching assets' });
  }
});

router.get('/requesters', async (req, res) => {
  try {
    const requesters = await prisma.workOrder.findMany({
      where: { requester_name: { not: null } },
      select: { requester_name: true },
      distinct: ['requester_name']
    });
    const names = requesters.map(r => r.requester_name).filter(Boolean);
    res.json(names);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching requesters' });
  }
});

export default router;
