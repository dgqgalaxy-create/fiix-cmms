import { Router } from 'express';
import {
  getKPIs,
  updateGoals,
  getChartData,
  getCostsByAsset,
  getTopFailingAssets,
  getAssetFailureOrders,
  getTechnicianPerformance,
  getMttrMtbfByLine,
  getLineAssetsMttrMtbf,
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
router.get('/by-line', getMttrMtbfByLine);
router.get('/by-line/:line/assets', getLineAssetsMttrMtbf);
router.put('/goals', requirePermission('MANAGE_KPIS'), updateGoals);

export default router;
