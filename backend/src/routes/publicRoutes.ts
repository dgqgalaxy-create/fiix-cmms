import { Router } from 'express';
import { getRequestTracking } from '../controllers/requestTrackingController';
import { createPublicWorkOrder } from '../controllers/workOrderController';
import { upload } from '../middlewares/upload';
import { createRateLimiter } from '../middlewares/rateLimit';
import prisma from '../config/prisma';

const router = Router();

/** Portal público: frena spam de solicitudes y scraping agresivo. */
const publicPostLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Demasiadas solicitudes desde esta red. Espera unos minutos e inténtalo de nuevo.',
});

const publicGetLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Demasiadas consultas. Espera un momento.',
});

// Endpoint for public work order creation (optional request_image via multipart)
router.post(
  '/requests',
  publicPostLimiter,
  upload.fields([{ name: 'request_image', maxCount: 1 }]),
  createPublicWorkOrder
);

router.get('/requests', publicGetLimiter, getRequestTracking);

// Endpoints to populate the public form dropdowns without auth
router.get('/locations', publicGetLimiter, async (_req, res) => {
  try {
    const locations = await prisma.itemLocation.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
    res.json(locations);
  } catch {
    res.status(500).json({ error: 'Error fetching locations' });
  }
});

router.get('/zones', publicGetLimiter, async (_req, res) => {
  try {
    const zones = await prisma.zone.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(zones);
  } catch {
    res.status(500).json({ error: 'Error fetching zones' });
  }
});

router.get('/assets', publicGetLimiter, async (req, res) => {
  try {
    const { zone_id } = req.query;
    const where = zone_id ? { zone_id: String(zone_id) } : {};
    const assets = await prisma.asset.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, internal_code: true },
    });
    res.json(assets);
  } catch {
    res.status(500).json({ error: 'Error fetching assets' });
  }
});

router.get('/requesters', publicGetLimiter, async (_req, res) => {
  try {
    const requesters = await prisma.requester.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    const names = requesters.map((r) => r.name);
    res.json(names);
  } catch {
    res.status(500).json({ error: 'Error fetching requesters' });
  }
});

export default router;
