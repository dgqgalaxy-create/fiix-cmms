import { Router } from 'express';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';
import {
  getAssetCategories,
  createAssetCategory,
  updateAssetCategory,
  deleteAssetCategory,
  getWorkOrderCategories,
  createWorkOrderCategory,
  updateWorkOrderCategory,
  deleteWorkOrderCategory,
} from '../controllers/categoryController';

const router = Router();

router.use(authenticate);

// Lectura: cualquiera que pueda ver activos u órdenes.
router.get('/asset-categories', getAssetCategories);
router.get('/work-order-categories', getWorkOrderCategories);

// Escritura: clasificación operativa (quien administra activos u órdenes).
router.post('/asset-categories', requireWritable, requirePermission('MANAGE_ASSETS'), createAssetCategory);
router.patch('/asset-categories/:id', requireWritable, requirePermission('MANAGE_ASSETS'), updateAssetCategory);
router.delete('/asset-categories/:id', requireWritable, requirePermission('MANAGE_ASSETS'), deleteAssetCategory);

router.post('/work-order-categories', requireWritable, requirePermission('EDIT_WORK_ORDERS'), createWorkOrderCategory);
router.patch('/work-order-categories/:id', requireWritable, requirePermission('EDIT_WORK_ORDERS'), updateWorkOrderCategory);
router.delete('/work-order-categories/:id', requireWritable, requirePermission('EDIT_WORK_ORDERS'), deleteWorkOrderCategory);

export default router;
