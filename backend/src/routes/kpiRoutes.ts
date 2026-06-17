import { Router } from 'express';
import { getKPIs, updateGoals, getChartData, getCostsByAsset, getTopFailingAssets, getAssetFailureOrders } from '../controllers/kpiController';
import { authenticate, requirePermission, requireAnyPermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', requireAnyPermission(['VIEW_KPIS', 'MANAGE_KPIS']), getKPIs);
router.get('/charts', requireAnyPermission(['VIEW_KPIS', 'MANAGE_KPIS']), getChartData);
router.get('/costs-by-asset', requireAnyPermission(['VIEW_KPIS', 'MANAGE_KPIS']), getCostsByAsset);
router.get('/top-failures', requireAnyPermission(['VIEW_KPIS', 'MANAGE_KPIS']), getTopFailingAssets);
router.get('/top-failures/:assetId/orders', requireAnyPermission(['VIEW_KPIS', 'MANAGE_KPIS']), getAssetFailureOrders);
router.put('/goals', requirePermission('MANAGE_KPIS'), updateGoals);

export default router;
