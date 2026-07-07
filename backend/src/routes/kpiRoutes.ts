import { Router } from 'express';
import { getKPIs, updateGoals, getChartData, getCostsByAsset, getTopFailingAssets, getAssetFailureOrders } from '../controllers/kpiController';
import { authenticate, requirePermission, requireAnyPermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', authenticate, getKPIs);
router.get('/charts', authenticate, getChartData);
router.get('/costs-by-asset', authenticate, getCostsByAsset);
router.get('/top-failures', authenticate, getTopFailingAssets);
router.get('/top-failures/:assetId/orders', authenticate, getAssetFailureOrders);
router.put('/goals', requirePermission('MANAGE_KPIS'), updateGoals);

export default router;
