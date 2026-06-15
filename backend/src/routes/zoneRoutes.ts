import { Router } from 'express';
import { getZones, createZone, deleteZone } from '../controllers/zoneController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getZones);
router.post('/', requirePermission('MANAGE_ZONES'), createZone);
router.delete('/:id', requirePermission('MANAGE_ZONES'), deleteZone);

export default router;
