import { Router } from 'express';
import { getKits, createKit, updateKit, deleteKit, getKitAvailability } from '../controllers/kitController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getKits);
router.get('/:id/availability', getKitAvailability);

router.post('/', requireWritable, requirePermission('MANAGE_INVENTORY'), createKit);
router.put('/:id', requireWritable, requirePermission('MANAGE_INVENTORY'), updateKit);
router.delete('/:id', requireWritable, requirePermission('MANAGE_INVENTORY'), deleteKit);

export default router;
