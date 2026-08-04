import { Router } from 'express';
import { getPurchaseOrders, createPurchaseOrder, createDraftsFromLowStock, updatePurchaseOrderStatus, updatePurchaseOrderLineCosts } from '../controllers/purchaseOrderController';
import { authenticate, requirePermission, requireWritable } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getPurchaseOrders);
router.post('/', requireWritable, requirePermission('MANAGE_PURCHASES'), createPurchaseOrder);
router.post('/draft-from-low-stock', requireWritable, requirePermission('MANAGE_PURCHASES'), createDraftsFromLowStock);
router.patch('/:id/line-costs', requireWritable, requirePermission('MANAGE_PURCHASES'), updatePurchaseOrderLineCosts);
router.patch('/:id/status', requireWritable, updatePurchaseOrderStatus);

export default router;
