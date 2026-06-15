import { Router } from 'express';
import { getKPIs, updateGoals } from '../controllers/kpiController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getKPIs);
router.put('/goals', requirePermission('MANAGE_KPIS'), updateGoals);

export default router;
