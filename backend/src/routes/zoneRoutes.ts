import { Router } from 'express';
import path from 'path';
import { createDiskUploader } from '../middlewares/upload';
import {
  getZones,
  createZone,
  updateZone,
  deleteZone,
  createZoneSection,
  updateZoneSection,
  deleteZoneSection,
  uploadZonePlan,
} from '../controllers/zoneController';
import {
  authenticate,
  requireAnyPermission,
  requireRole,
  requirePermission,
} from '../middlewares/authMiddleware';
const router = Router();

const planUploadDir = path.join(__dirname, '../../uploads/zones');
const planUpload = createDiskUploader(planUploadDir, { maxFiles: 1 });

const manageZonesOrAssets = requireAnyPermission(['MANAGE_ZONES', 'MANAGE_ASSETS']);

router.use(authenticate);

router.get('/', getZones);
router.post('/', manageZonesOrAssets, createZone);
router.patch('/:id', manageZonesOrAssets, updateZone);
router.delete('/:id', requirePermission('MANAGE_ZONES'), deleteZone);

router.post('/:id/plan', manageZonesOrAssets, planUpload.single('file'), uploadZonePlan);
router.post('/:id/sections', manageZonesOrAssets, createZoneSection);
router.patch('/sections/:sectionId', manageZonesOrAssets, updateZoneSection);
router.delete('/sections/:sectionId', manageZonesOrAssets, deleteZoneSection);

export default router;