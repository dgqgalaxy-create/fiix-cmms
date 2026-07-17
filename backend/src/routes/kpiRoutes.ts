import { Router } from 'express';
import {
  getKPIs,
  updateGoals,
  getChartData,
  getCostsByAsset,
  getTopFailingAssets,
  getAssetFailureOrders,
  getTechnicianPerformance,
} from '../controllers/kpiController';
import { authenticate, requirePermission } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getKPIs);
router.get('/charts', getChartData);
router.get('/costs-by-asset', getCostsByAsset);
router.get('/top-failures', getTopFailingAssets);
router.get('/top-failures/:assetId/orders', getAssetFailureOrders);
router.get('/technician-performance', getTechnicianPerformance);
router.put('/goals', requirePermission('MANAGE_KPIS'), updateGoals);

export default router;
