import { Router } from 'express';
import { getKPIs, updateGoals, getChartData } from '../controllers/kpiController';
import { authenticate, requirePermission, requireAnyPermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', requireAnyPermission(['VIEW_KPIS', 'MANAGE_KPIS']), getKPIs);
router.get('/charts', requireAnyPermission(['VIEW_KPIS', 'MANAGE_KPIS']), getChartData);
router.put('/goals', requirePermission('MANAGE_KPIS'), updateGoals);

export default router;
