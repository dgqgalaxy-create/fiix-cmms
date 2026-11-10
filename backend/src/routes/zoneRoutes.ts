import { Router } from 'express';
import {
  getZones,
  createZone,
  updateZone,
  deleteZone,
  createZoneSection,
  updateZoneSection,
  deleteZoneSection,
} from '../controllers/zoneController';
import {
  authenticate,
  requireAnyPermission,
  requireRole,
  requirePermission,
} from '../middlewares/authMiddleware';
const router = Router();

const manageZonesOrAssets = requireAnyPermission(['MANAGE_ZONES', 'MANAGE_ASSETS']);

router.use(authenticate);

router.get('/', getZones);
router.post('/', manageZonesOrAssets, createZone);
router.patch('/:id', manageZonesOrAssets, updateZone);
router.delete('/:id', requirePermission('MANAGE_ZONES'), deleteZone);

router.post('/:id/sections', manageZonesOrAssets, createZoneSection);
router.patch('/sections/:sectionId', manageZonesOrAssets, updateZoneSection);
router.delete('/sections/:sectionId', manageZonesOrAssets, deleteZoneSection);

export default router;