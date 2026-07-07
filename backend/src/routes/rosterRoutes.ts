import { Router } from 'express';
import { getRoster, assignPattern, addException, removeException } from '../controllers/rosterController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getRoster);
router.post('/pattern', requirePermission('MANAGE_SHIFTS'), assignPattern);
router.post('/exception', requirePermission('MANAGE_SHIFTS'), addException);
router.delete('/exception/:id', requirePermission('MANAGE_SHIFTS'), removeException);

export default router;
