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
  getResponseTimeZones,
  updateResponseTimeZones,
} from '../controllers/kpiController';
import { authenticate, requirePermission, requireRole } from '../middlewares/authMiddleware';

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
router.get('/response-time-zones', getResponseTimeZones);
router.put('/response-time-zones', requireRole(['ADMINISTRADOR']), updateResponseTimeZones);
router.put('/goals', requirePermission('MANAGE_KPIS'), updateGoals);

export default router;
